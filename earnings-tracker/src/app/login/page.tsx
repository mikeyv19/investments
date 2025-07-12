import LoginForm from '@/app/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-extrabold text-center text-gray-900 mb-8">
          Earnings Tracker
        </h1>
        <LoginForm />
      </div>
    </div>
  )
}