import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from '@/app/contexts/auth-context'

export const metadata: Metadata = {
  title: "Earnings Tracker",
  description: "Track upcoming earnings dates for your favorite stocks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
