"use client";
import Link from "next/link";
import { Construction, ArrowLeft } from "lucide-react";

/**
 * Temporary placeholder rendered in place of a feature page that's been
 * paused. The original page.tsx for each route lives next to it as
 * `page.original.tsx` and can be restored by deleting this shim and
 * renaming `.original.tsx` → `page.tsx`.
 */
export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/20">
          <Construction className="h-8 w-8 text-white" strokeWidth={2} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {description ??
            "We're polishing this section. It'll be back shortly."}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-yellow-50 dark:bg-yellow-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
          Coming soon
        </span>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
