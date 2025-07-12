'use client';

import { useEffect, useState } from 'react';
import EarningsCard from './EarningsCard';

interface EarningsData {
  symbol: string;
  company_name?: string;
  earnings_date: string;
  earnings_time?: string;
  fiscal_quarter?: string;
  fiscal_year?: number;
  estimated_eps?: number;
  reported_eps?: number;
  surprise_percent?: number;
}

interface EarningsCalendarProps {
  symbol?: string;
  symbols?: string[];
}

export default function EarningsCalendar({ symbol, symbols }: EarningsCalendarProps) {
  const [earnings, setEarnings] = useState<EarningsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEarnings = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const symbolsToFetch = symbol ? [symbol] : symbols || [];
        const promises = symbolsToFetch.map(async (sym) => {
          const response = await fetch(`/api/earnings/${sym}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch earnings for ${sym}`);
          }
          const data = await response.json();
          return data.earnings || [];
        });

        const results = await Promise.all(promises);
        const allEarnings = results.flat();
        
        // Sort by date
        allEarnings.sort((a, b) => 
          new Date(a.earnings_date).getTime() - new Date(b.earnings_date).getTime()
        );
        
        setEarnings(allEarnings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch earnings data');
      } finally {
        setLoading(false);
      }
    };

    if (symbol || (symbols && symbols.length > 0)) {
      fetchEarnings();
    }
  }, [symbol, symbols]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (earnings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          No upcoming earnings found for the selected stock(s)
        </p>
      </div>
    );
  }

  // Group earnings by date
  const groupedEarnings = earnings.reduce((acc, earning) => {
    const date = earning.earnings_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(earning);
    return acc;
  }, {} as Record<string, EarningsData[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedEarnings).map(([date, dayEarnings]) => {
        const dateObj = new Date(date);
        const isToday = new Date().toDateString() === dateObj.toDateString();
        const formattedDate = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        return (
          <div key={date}>
            <h3 className={`text-sm font-medium mb-3 ${
              isToday 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {isToday ? 'Today - ' : ''}{formattedDate}
            </h3>
            <div className="grid gap-3">
              {dayEarnings.map((earning) => (
                <EarningsCard key={`${earning.symbol}-${earning.earnings_date}`} earning={earning} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}