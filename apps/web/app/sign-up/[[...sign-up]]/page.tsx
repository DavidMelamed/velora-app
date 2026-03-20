export default function SignUpPage() {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!clerkKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="mt-2 text-gray-500">
            Authentication is not configured yet. Set up Clerk to enable sign-up.
          </p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
            Go Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Create Your Account</h1>
          <p className="mt-2 text-sm text-gray-500">
            Start tracking your accident case automatically
          </p>
        </div>

        <div className="mt-6">
          <p className="text-center text-sm text-gray-400">
            Clerk sign-up will render here when configured.
          </p>
        </div>

        <div className="mt-6 text-center">
          <a href="/sign-in" className="text-sm text-blue-600 hover:underline">
            Already have an account? Sign in
          </a>
        </div>
      </div>
    </div>
  )
}
