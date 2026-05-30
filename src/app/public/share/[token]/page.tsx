"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Download,
  FileText,
  ExternalLink,
  Shield,
  Clock,
  ArrowLeft,
} from "lucide-react";

type ShareDoc = {
  id: string;
  type: string;
  documentNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  documentUrls: string[];
};

type ShareData = {
  link: { token: string; expiresAt: string; vehicleId: string; tenantId: string };
  vehicle: {
    registrationNumber: string;
    make: string;
    model: string;
    ownerName?: string | null;
  };
  documents: ShareDoc[];
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function docTypeLabel(t: string): string {
  return t.replace(/_/g, " ").replace(/\w\S*/g, (s) => s[0].toUpperCase() + s.slice(1).toLowerCase());
}

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/public/share/${token}`)
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: ShareData;
          message?: string;
        };
        if (!res.ok || !json.data) {
          throw new Error(json.message ?? "Share link is no longer valid");
        }
        setData(json.data);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not load share");
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Live countdown to expiry so the recipient knows how long they have left.
  useEffect(() => {
    if (!data) return;
    const tick = () => {
      const ms = new Date(data.link.expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setCountdown("Expired");
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${h}h ${m}m left`);
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [data]);

  const handleDownloadPdf = async () => {
    if (!token) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/public/share/${token}/pdf`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data?.vehicle.registrationNumber ?? "documents"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm">
          <Clock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h1 className="text-base font-bold text-gray-900 dark:text-white">
            Link unavailable
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {error ?? "This share link is invalid or has expired."}
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="relative w-9 h-9 rounded-lg overflow-hidden">
              <Image
                src="/images/logo/yellow-track-logo.svg"
                alt="Yellow Track"
                fill
                sizes="36px"
                className="object-contain"
              />
            </span>
            <span className="text-sm font-black tracking-tight">
              <span className="text-yellow-500">Yellow</span>
              <span className="text-gray-900 dark:text-white"> Track</span>
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Shield className="w-3 h-3" />
            Secure share
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400 mb-2">
            Shared compliance documents
          </p>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            {data.vehicle.registrationNumber}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {data.vehicle.make} {data.vehicle.model}
            {data.vehicle.ownerName ? ` · ${data.vehicle.ownerName}` : ""}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all disabled:opacity-60"
            >
              {downloading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? "Building PDF…" : "Download as PDF"}
            </button>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {countdown || "—"} · expires{" "}
              {new Date(data.link.expiresAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {data.documents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No documents in this share.
            </p>
          ) : (
            data.documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {docTypeLabel(doc.type)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {doc.expiryDate
                        ? `Valid until ${formatDate(doc.expiryDate)}`
                        : doc.issuedDate
                          ? "Lifetime validity"
                          : "No expiry on file"}
                      {doc.issuedDate ? ` · from ${formatDate(doc.issuedDate)}` : ""}
                    </p>
                    {doc.documentNumber && (
                      <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                        No. {doc.documentNumber}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {doc.documentUrls.length} file{doc.documentUrls.length === 1 ? "" : "s"}
                  </span>
                </div>
                {doc.documentUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {doc.documentUrls.map((url, i) => (
                      <a
                        key={`${url}-${i}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <FileText className="w-3 h-3" />
                        File {i + 1}
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-gray-400">
          Shared via Yellow Track · This link is private and time-bound. Don&apos;t forward unless you trust the recipient.
        </p>
      </main>
    </div>
  );
}
