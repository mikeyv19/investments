import UserProfile from '@/app/components/auth/UserProfile'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Earnings Tracker</h1>
            <UserProfile />
          </div>
        </div>
      </header>
      <main className="min-h-screen bg-gray-50">
        {children}
      </main>
    </>
  )
}