import { NextRequest, NextResponse } from 'next/server';
import { polygonClient } from '@/app/lib/polygon';
import { getCachedData, setCachedData } from '@/app/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query || query.length < 1) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = await getCachedData(cacheKey);
    
    if (cached) {
      return NextResponse.json(cached);
    }

    // Search using Polygon API
    try {
      const results = await polygonClient.searchTickers(query);
      
      if (results && results.results) {
        // Filter to only show stocks (not ETFs, currencies, etc.)
        const stocks = results.results
          .filter((item: any) => item.market === 'stocks')
          .slice(0, 10) // Limit to 10 results
          .map((item: any) => ({
            symbol: item.ticker,
            name: item.name,
            market: item.market,
            locale: item.locale,
            primary_exchange: item.primary_exchange
          }));

        const response = {
          query,
          results: stocks,
          count: stocks.length
        };

        // Cache for 1 hour
        await setCachedData(cacheKey, response, 1);
        return NextResponse.json(response);
      }
    } catch (error) {
      console.error('Polygon search error:', error);
    }

    // If Polygon fails or returns no results
    return NextResponse.json({
      query,
      results: [],
      count: 0,
      message: 'No results found'
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}