import LoginForm from '@/app/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-primary/5 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-8">
          Earnings Tracker
        </h1>
        <LoginForm />
      </div>
    </div>
  )
}