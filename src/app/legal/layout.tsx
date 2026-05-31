import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Mail, MapPin } from "lucide-react";

// Shared chrome for /legal/* pages. The landing page chrome is heavier
// (gradient hero, sticky multi-link nav) — legal pages just need a way
// back home, the four policy cross-links, and contact info.
const LEGAL_LINKS = [
  { label: "Terms & Conditions", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Refund Policy", href: "/legal/refund" },
  { label: "Cancellation & Returns", href: "/legal/cancellation" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-gray-950/80 border-b border-gray-100 dark:border-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="relative w-12 h-12">
              <Image
                src="/images/logo/yellow-track-logo.svg"
                alt="Yellow Track"
                fill
                sizes="48px"
                className="object-contain"
                priority
              />
            </span>
            <span className="text-sm font-black tracking-tight">
              <span className="text-yellow-500">Yellow</span>
              <span className="text-gray-900 dark:text-white"> Track</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {children}

        <div className="mt-14 pt-8 border-t border-gray-100 dark:border-gray-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">
            Other policies
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Yellow Track. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="mailto:hello@theyellowtrack.com"
              className="inline-flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-white"
            >
              <Mail className="w-3.5 h-3.5" />
              hello@theyellowtrack.com
            </a>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Hyderabad, India
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
