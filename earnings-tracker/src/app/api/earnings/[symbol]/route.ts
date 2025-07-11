import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { polygonClient } from '@/app/lib/polygon';
import { alphaVantageClient } from '@/app/lib/alphavantage';
import { getCachedData, setCachedData } from '@/app/lib/cache';
import { EarningsData } from '@/app/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase();
    
    // Check cache first
    const cacheKey = `earnings:${symbol}`;
    const cached = await getCachedData<EarningsData>(cacheKey);
    
    if (cached) {
      return NextResponse.json(cached);
    }

    // Try to get from database
    const { data: dbData, error: dbError } = await supabase
      .from('earnings')
      .select('*')
      .eq('symbol', symbol)
      .gte('earnings_date', new Date().toISOString().split('T')[0])
      .order('earnings_date', { ascending: true })
      .limit(4);

    if (dbData && dbData.length > 0) {
      const result = {
        symbol,
        earnings: dbData,
        source: 'database'
      };
      
      // Cache for 1 hour
      await setCachedData(cacheKey, result, 1);
      return NextResponse.json(result);
    }

    // Try Polygon API
    try {
      const polygonData = await polygonClient.getEarnings(symbol);
      
      if (polygonData && polygonData.results) {
        // Store in database
        for (const earning of polygonData.results) {
          await supabase.from('earnings').upsert({
            symbol: symbol,
            company_name: earning.company_name,
            earnings_date: earning.report_date,
            earnings_time: earning.time_of_day,
            fiscal_quarter: earning.fiscal_period,
            fiscal_year: earning.fiscal_year,
            estimated_eps: earning.eps_estimate,
            reported_eps: earning.eps_actual,
            surprise_percent: earning.eps_surprise_percent
          }, {
            onConflict: 'symbol,earnings_date'
          });
        }

        const result = {
          symbol,
          earnings: polygonData.results,
          source: 'polygon'
        };
        
        // Cache for 24 hours
        await setCachedData(cacheKey, result, 24);
        return NextResponse.json(result);
      }
    } catch (polygonError) {
      console.error('Polygon API error:', polygonError);
    }

    // Fallback to Alpha Vantage
    try {
      const alphaData = await alphaVantageClient.getEarningsCalendar(symbol);
      
      if (alphaData && alphaData.length > 0) {
        // Store in database
        for (const earning of alphaData) {
          await supabase.from('earnings').upsert({
            symbol: symbol,
            company_name: earning.name,
            earnings_date: earning.reportDate,
            earnings_time: 'Unknown',
            fiscal_quarter: earning.fiscalDateEnding,
            estimated_eps: earning.estimate,
            reported_eps: earning.reportedEPS
          }, {
            onConflict: 'symbol,earnings_date'
          });
        }

        const result = {
          symbol,
          earnings: alphaData,
          source: 'alphavantage'
        };
        
        // Cache for 24 hours
        await setCachedData(cacheKey, result, 24);
        return NextResponse.json(result);
      }
    } catch (alphaError) {
      console.error('Alpha Vantage API error:', alphaError);
    }

    // No data found
    return NextResponse.json(
      { error: 'No earnings data found for this symbol' },
      { status: 404 }
    );

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}