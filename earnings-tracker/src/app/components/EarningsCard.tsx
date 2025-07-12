'use client';

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

interface EarningsCardProps {
  earning: EarningsData;
}

export default function EarningsCard({ earning }: EarningsCardProps) {
  const getTimeLabel = (time?: string) => {
    switch (time?.toUpperCase()) {
      case 'BMO':
        return { text: 'Before Market Open', color: 'text-orange-600 dark:text-orange-400' };
      case 'AMC':
        return { text: 'After Market Close', color: 'text-purple-600 dark:text-purple-400' };
      default:
        return { text: 'Time TBD', color: 'text-gray-600 dark:text-gray-400' };
    }
  };

  const timeInfo = getTimeLabel(earning.earnings_time);
  const hasReported = earning.reported_eps !== null && earning.reported_eps !== undefined;

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              {earning.symbol}
            </h4>
            {earning.fiscal_quarter && earning.fiscal_year && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {earning.fiscal_quarter} {earning.fiscal_year}
              </span>
            )}
          </div>
          
          {earning.company_name && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {earning.company_name}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm">
            <span className={`font-medium ${timeInfo.color}`}>
              {timeInfo.text}
            </span>
          </div>
        </div>

        <div className="text-right">
          {hasReported ? (
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Reported EPS</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                ${earning.reported_eps?.toFixed(2)}
              </div>
              {earning.surprise_percent !== null && earning.surprise_percent !== undefined && (
                <div className={`text-sm font-medium ${
                  earning.surprise_percent > 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {earning.surprise_percent > 0 ? '+' : ''}{earning.surprise_percent.toFixed(2)}%
                </div>
              )}
            </div>
          ) : earning.estimated_eps !== null && earning.estimated_eps !== undefined ? (
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Est. EPS</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                ${earning.estimated_eps.toFixed(2)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Estimates pending
            </div>
          )}
        </div>
      </div>
    </div>
  );
}