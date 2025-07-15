import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from '@/app/contexts/auth-context'
import { Toaster } from 'react-hot-toast'
import { ConfirmationDialogProvider } from '@/app/components/ui/confirmation-dialog'

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
          <ConfirmationDialogProvider>
            {children}
          </ConfirmationDialogProvider>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
              success: {
                iconTheme: {
                  primary: 'hsl(var(--primary))',
                  secondary: 'hsl(var(--primary-foreground))',
                },
              },
              error: {
                iconTheme: {
                  primary: 'hsl(var(--destructive))',
                  secondary: 'hsl(var(--destructive-foreground))',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
