import { Outfit } from "next/font/google";
import "./globals.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import Providers from "@/components/providers/Providers";
import type { Metadata } from "next";

const outfit = Outfit({
  subsets: ["latin"],
});

// Resolve a canonical site URL so `metadataBase` is set — without this,
// Next emits a build-time warning and absolute URLs for og:image / og:url
// can't be computed properly. Falls back to the production domain.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://www.theyellowtrack.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Yellow Track — Fleet Compliance Management",
    template: "%s | Yellow Track",
  },
  description:
    "Fleet compliance, drivers, expenses, EMIs — managed end-to-end. RC, Insurance, PUC, Permit, Fitness, FASTag, Challans tracked from one yellow dashboard.",
  // The transparent SVG works as a favicon in modern browsers; the PNG is
  // kept as a fallback for older clients (e.g. WhatsApp's link scraper).
  icons: {
    icon: [
      { url: "/images/logo/yellow-track-logo.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/images/logo/yellow-track-logo.svg",
  },
  // `opengraph-image.tsx` at the app root supplies the actual og:image —
  // Next auto-injects it. Setting the rest of the OG block explicitly so
  // sites scraping minimal headers (some WhatsApp / Slack flows) still
  // pick up a clean title + description + URL.
  openGraph: {
    type: "website",
    siteName: "Yellow Track",
    title: "Yellow Track — Fleet Compliance Management",
    description:
      "Fleet management that doesn't miss a beat. RC, Insurance, PUC, Permit, Fitness, FASTag, Challans, Drivers, EMIs — all tracked from one yellow dashboard.",
    url: SITE_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yellow Track — Fleet Compliance Management",
    description:
      "Fleet management that doesn't miss a beat. Built in India for India's roads.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.className} dark:bg-gray-900`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
