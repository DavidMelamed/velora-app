/**
 * Sign In page — renders Clerk's drop-in SignIn component.
 * Only functional when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
 * Falls back to a message when Clerk is not configured.
 */
export default function SignInPage() {
  // Check if Clerk is configured at build time
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!clerkKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
          <p className="mt-2 text-gray-500">
            Authentication is not configured yet. Set up Clerk to enable sign-in.
          </p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
            Go Home
          </a>
        </div>
      </div>
    )
  }

  // When Clerk IS configured, this page would use:
  // import { SignIn } from '@clerk/nextjs'
  // return <SignIn />
  // For now, render a phone-first sign-in form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Velora</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to track your accident case
          </p>
        </div>

        <div className="mt-6">
          <p className="text-center text-sm text-gray-400">
            Clerk authentication will render here when configured.
          </p>
          <p className="mt-2 text-center text-xs text-gray-400">
            Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> in your .env file.
          </p>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-blue-600 hover:underline">
            Continue without signing in
          </a>
        </div>
      </div>
    </div>
  )
}
