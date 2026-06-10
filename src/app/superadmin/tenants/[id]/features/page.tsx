"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import { ArrowLeft, ToggleLeft, ToggleRight, Flag, Info } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type CatalogEntry = {
  key: string;
  label: string;
  description: string;
};

type FeaturesPayload = {
  tenant: { id: string; name: string | null; slug: string | null };
  features: Record<string, boolean>;
  catalog: CatalogEntry[];
};

export default function SuperadminTenantFeaturesPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = String(params?.id ?? "");

  const [data, setData] = useState<FeaturesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  // Gate every toggle behind a centred ConfirmDialog so single mis-clicks
  // can't flip a flag for an entire tenant.
  const [confirmToggle, setConfirmToggle] = useState<{
    key: string;
    label: string;
    nextEnabled: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await superadminAPI.getTenantFeatures(tenantId);
      setData(res.data.data as FeaturesPayload);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not load feature flags.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (key: string, next: boolean) => {
    if (!data) return;
    setPendingKey(key);
    setError(null);
    setOkMessage(null);
    try {
      await superadminAPI.setTenantFeature(tenantId, key, next);
      setData({
        ...data,
        features: { ...data.features, [key]: next },
      });
      const label = data.catalog.find((c) => c.key === key)?.label ?? key;
      setOkMessage(`"${label}" is now ${next ? "enabled" : "disabled"}.`);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update flag";
      setError(msg);
    } finally {
      setPendingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-7 w-40 animate-pulse rounded bg-gray-200/70 dark:bg-gray-700/40" />
        <div className="h-32 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/superadmin/tenants/${tenantId}`)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          aria-label="Back to tenant"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-yellow-500" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Feature flags
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <Link
              href={`/superadmin/tenants/${tenantId}`}
              className="font-semibold text-gray-700 dark:text-gray-300 hover:underline"
            >
              {data?.tenant.name ?? "Tenant"}
            </Link>{" "}
            · {data?.tenant.slug ?? ""}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}
      {okMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {okMessage}
        </div>
      )}

      <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Flags ship disabled by default. Enabling one here propagates to
            the tenant&rsquo;s next login (or a hard refresh).
          </p>
        </div>
        {data?.catalog.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No feature flags registered yet. Add them in{" "}
            <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
              src/lib/feature-flags.ts
            </code>
            .
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {data?.catalog.map((entry) => {
              const enabled = Boolean(data.features[entry.key]);
              const pending = pendingKey === entry.key;
              return (
                <li
                  key={entry.key}
                  className="p-4 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {entry.label}
                      </p>
                      <code className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 dark:text-gray-500 rounded px-1.5 py-0.5">
                        {entry.key}
                      </code>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {entry.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmToggle({
                        key: entry.key,
                        label: entry.label,
                        nextEnabled: !enabled,
                      })
                    }
                    disabled={pending}
                    aria-pressed={enabled}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      enabled
                        ? "bg-emerald-500 text-white shadow shadow-emerald-500/20 hover:shadow-emerald-500/40"
                        : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {enabled ? (
                      <ToggleRight className="w-3.5 h-3.5" />
                    ) : (
                      <ToggleLeft className="w-3.5 h-3.5" />
                    )}
                    {pending ? "Saving…" : enabled ? "Enabled" : "Disabled"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmToggle !== null}
        title={
          confirmToggle?.nextEnabled
            ? "Are you sure you want to enable this feature for this tenant?"
            : "Are you sure you want to disable this feature for this tenant?"
        }
        message={
          confirmToggle && data
            ? `"${confirmToggle.label}" will be ${confirmToggle.nextEnabled ? "turned on" : "turned off"} for ${data.tenant.name ?? "this tenant"} on their next login or hard refresh.`
            : ""
        }
        confirmLabel={confirmToggle?.nextEnabled ? "Enable" : "Disable"}
        cancelLabel="Cancel"
        variant={confirmToggle?.nextEnabled ? undefined : "warning"}
        loading={pendingKey === confirmToggle?.key}
        onConfirm={async () => {
          if (!confirmToggle) return;
          const { key, nextEnabled } = confirmToggle;
          await onToggle(key, nextEnabled);
          setConfirmToggle(null);
        }}
        onCancel={() => {
          if (pendingKey === null) setConfirmToggle(null);
        }}
      />
    </div>
  );
}
