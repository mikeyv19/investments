'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/auth-context';
import { createClient } from '@/app/lib/supabase-browser';
import StockSearch from '@/app/components/StockSearch';
import EarningsCalendar from '@/app/components/EarningsCalendar';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load user's watchlist
  useEffect(() => {
    if (user) {
      loadWatchlist();
    }
  }, [user]);

  const loadWatchlist = async () => {
    try {
      const { data, error } = await supabase
        .from('user_watchlist')
        .select('symbol')
        .eq('user_id', user!.id)
        .order('added_at', { ascending: false });

      if (error) throw error;
      
      setWatchlist(data?.map(item => item.symbol) || []);
    } catch (error) {
      console.error('Error loading watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStockSelect = async (symbol: string) => {
    setSelectedSymbol(symbol);
    
    if (!watchlist.includes(symbol)) {
      try {
        const { error } = await supabase
          .from('user_watchlist')
          .insert({ user_id: user!.id, symbol });

        if (error) throw error;
        
        setWatchlist([symbol, ...watchlist]);
      } catch (error) {
        console.error('Error adding to watchlist:', error);
      }
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    try {
      const { error } = await supabase
        .from('user_watchlist')
        .delete()
        .eq('user_id', user!.id)
        .eq('symbol', symbol);

      if (error) throw error;
      
      setWatchlist(watchlist.filter(s => s !== symbol));
      if (selectedSymbol === symbol) {
        setSelectedSymbol('');
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Search and Watchlist */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stock Search */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Search Stocks
            </h2>
            <StockSearch onSelectStock={handleStockSelect} />
          </div>

          {/* Watchlist */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Your Watchlist
            </h2>
            {watchlist.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No stocks in your watchlist. Search and add stocks above.
              </p>
            ) : (
              <ul className="space-y-2">
                {watchlist.map((symbol) => (
                  <li
                    key={symbol}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                    onClick={() => setSelectedSymbol(symbol)}
                  >
                    <span className={`font-medium ${selectedSymbol === symbol ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                      {symbol}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWatchlist(symbol);
                      }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column - Earnings Calendar */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Earnings Calendar
            </h2>
            {selectedSymbol ? (
              <EarningsCalendar symbol={selectedSymbol} />
            ) : watchlist.length > 0 ? (
              <EarningsCalendar symbols={watchlist} />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  Search for a stock or select from your watchlist to view earnings dates
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}