"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Plus, Search, Clock, X } from "lucide-react";
import { vehicleBrandAPI } from "@/lib/api";
import { VehicleBrandIcon } from "@/components/icons/VehicleBrandIcon";

export type BrandRow = {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  iconKey: string | null;
  status: "APPROVED" | "PENDING" | "REJECTED";
};

/**
 * Dropdown picker backed by the platform brand master.
 *
 * - Lists every APPROVED brand + this tenant's own PENDING requests.
 * - Search-as-you-type filter.
 * - If the typed value doesn't match any existing brand, a "Request '<name>'
 *   as new brand" entry appears at the bottom. Selecting it POSTs a request
 *   to the superadmin (emails them) and the dropdown switches to that brand,
 *   marked PENDING.
 *
 * Callers receive the brand NAME (string) via `onChange` for backward
 * compatibility with the existing `vehicle.brand: string` field.
 */
export function BrandPicker({
  value,
  onChange,
  onRequested,
  disabled,
  placeholder = "Select a brand",
}: {
  value: string | null;
  onChange: (name: string | null) => void;
  /** Optional toast callback fired after a successful request submission. */
  onRequested?: (brandName: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Load brand list on first open.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    vehicleBrandAPI
      .list()
      .then((res) => {
        if (cancelled) return;
        const list = (res.data.data as Array<BrandRow & { _id?: string }>).map((b) => ({
          ...b,
          id: String(b.id ?? b._id),
        }));
        setBrands(list);
      })
      .catch(() => {
        if (!cancelled) setBrands([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, filter]);

  // If the user typed something that doesn't exist (case-insensitive name match), show "Request new".
  const showRequest = useMemo(() => {
    const q = filter.trim();
    if (!q || q.length < 2) return null;
    const match = brands.find((b) => b.name.toLowerCase() === q.toLowerCase());
    return match ? null : q;
  }, [filter, brands]);

  const selected = useMemo(
    () => brands.find((b) => b.name.toLowerCase() === (value ?? "").toLowerCase()) ?? null,
    [brands, value],
  );

  const selectBrand = (b: BrandRow) => {
    onChange(b.name);
    setOpen(false);
    setFilter("");
  };

  const submitRequest = async (name: string) => {
    setSubmitting(true);
    try {
      const res = await vehicleBrandAPI.request({ name });
      const created = (res.data.data ?? null) as BrandRow | null;
      if (created) {
        setBrands((prev) => {
          const next = prev.filter((p) => p.slug !== created.slug);
          return [...next, { ...created, id: String(created.id ?? created._id) }];
        });
        onChange(created.name);
        onRequested?.(created.name);
      }
      setOpen(false);
      setFilter("");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to request brand";
      // Surface inline at the top of the list. Lightweight: alert.
      window.alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-left text-sm font-semibold text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 disabled:opacity-50"
      >
        {value ? (
          <>
            <VehicleBrandIcon brand={selected ?? { name: value }} size={20} />
            <span className="flex-1 truncate">{value}</span>
            {selected?.status === "PENDING" && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                <Clock className="w-2.5 h-2.5" />
                Pending
              </span>
            )}
          </>
        ) : (
          <span className="flex-1 text-gray-400 font-normal">{placeholder}</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
          <div className="relative border-b border-gray-100 dark:border-gray-800">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search or type a new brand…"
              className="w-full pl-8 pr-8 py-2 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {!loaded && (
              <li className="px-3 py-4 text-center text-xs text-gray-400">
                Loading brands…
              </li>
            )}
            {loaded &&
              filtered.map((b) => {
                const isSelected =
                  value?.toLowerCase() === b.name.toLowerCase();
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => selectBrand(b)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-yellow-50 dark:bg-yellow-500/10 text-gray-900 dark:text-white"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      <VehicleBrandIcon brand={b} size={20} />
                      <span className="flex-1 truncate font-semibold">{b.name}</span>
                      {b.status === "PENDING" && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                          <Clock className="w-2.5 h-2.5" />
                          Pending
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-yellow-500" strokeWidth={3} />
                      )}
                    </button>
                  </li>
                );
              })}
            {loaded && filtered.length === 0 && !showRequest && (
              <li className="px-3 py-4 text-center text-xs text-gray-400">
                No brands match.
              </li>
            )}
          </ul>

          {showRequest && (
            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 p-2">
              <button
                type="button"
                onClick={() => submitRequest(showRequest)}
                disabled={submitting}
                className="w-full flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 px-3 py-2 text-xs font-bold text-white shadow disabled:opacity-50"
              >
                {submitting ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Request &ldquo;{showRequest}&rdquo; as new brand
              </button>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1.5">
                Visible to you until the superadmin approves it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
