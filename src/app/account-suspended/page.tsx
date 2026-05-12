export default function AccountSuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
        <h1 className="text-xl font-bold text-amber-900 dark:text-amber-300">
          Workspace suspended
        </h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-400">
          This workspace has been temporarily suspended by the platform
          administrator. Please contact support to restore access.
        </p>
      </div>
    </div>
  );
}
