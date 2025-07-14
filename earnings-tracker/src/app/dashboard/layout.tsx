import UserProfile from '@/app/components/auth/UserProfile'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <header className="bg-gradient-to-r from-card via-muted/50 to-card shadow-sm border-b border-border backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Earnings Tracker</h1>
            <UserProfile />
          </div>
        </div>
      </header>
      <main className="min-h-screen bg-background">
        {children}
      </main>
    </>
  )
}