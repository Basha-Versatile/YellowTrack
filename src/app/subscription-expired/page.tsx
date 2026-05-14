export default function SubscriptionExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-400/20 flex items-center justify-center mb-4">
          <svg
            className="w-7 h-7 text-amber-600 dark:text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-amber-900 dark:text-amber-300">
          Subscription expired
        </h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-400">
          This workspace&apos;s subscription has ended. Renew it from the
          platform admin to restore access for everyone in your team.
        </p>
        <p className="mt-4 text-xs text-amber-700 dark:text-amber-400/80">
          Already renewed? Sign out and sign back in to refresh your session.
        </p>
      </div>
    </div>
  );
}
