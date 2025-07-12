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
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Earnings Tracker</h1>
          <p className="text-lg text-gray-600">Track upcoming earnings dates for your favorite stocks</p>
        </div>
        
        <div className="mt-8 space-y-4">
          <Link
            href="/login"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign In
          </Link>
          
          <Link
            href="/signup"
            className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create Account
          </Link>
        </div>
        
        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Features:</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Track earnings dates for multiple stocks</li>
            <li>• Personalized watchlist</li>
            <li>• Real-time earnings calendar</li>
            <li>• Email notifications (coming soon)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}