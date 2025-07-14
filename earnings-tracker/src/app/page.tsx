'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-primary/5">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">Earnings Tracker</h1>
          <p className="text-lg text-muted-foreground">Track upcoming earnings dates for your favorite stocks</p>
        </div>
        
        <div className="mt-8 space-y-4">
          <Link
            href="/login"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors"
          >
            Sign In
          </Link>
          
          <Link
            href="/signup"
            className="w-full flex justify-center py-3 px-4 border border-border rounded-md shadow-sm text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors"
          >
            Create Account
          </Link>
        </div>
        
        <div className="mt-8">
          <h3 className="text-sm font-medium text-foreground mb-4">Features:</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Historical EPS data from SEC filings</li>
            <li>• Multiple named watchlists</li>
            <li>• Upcoming earnings calendar</li>
            <li>• Advanced data grid with filtering & export</li>
            <li>• Daily automated updates</li>
          </ul>
        </div>
      </div>
    </div>
  );
}