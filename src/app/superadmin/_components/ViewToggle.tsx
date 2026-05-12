"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";

export type View = "grid" | "list";

/**
 * Persistent grid/list toggle that mirrors the fleet-admin pattern.
 * Choice is stored per-page key in localStorage so each superadmin list
 * remembers its preference independently.
 */
export function useViewMode(storageKey: string, fallback: View = "grid"): [View, (v: View) => void] {
  const [view, setView] = useState<View>(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "grid" || saved === "list") setView(saved);
    } catch { /* ignore */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (v: View) => {
    setView(v);
    if (hydrated) {
      try {
        localStorage.setItem(storageKey, v);
      } catch { /* ignore */ }
    }
  };

  return [view, update];
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl h-11 border border-gray-100 dark:border-gray-800">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`flex items-center justify-center w-9 h-full rounded-lg transition-all ${
          value === "list"
            ? "bg-white shadow-sm dark:bg-gray-700"
            : "hover:bg-white/50 dark:hover:bg-gray-700/40"
        }`}
        title="List view"
        aria-label="List view"
      >
        <List
          className={`w-4 h-4 ${
            value === "list"
              ? "text-gray-900 dark:text-white"
              : "text-gray-400"
          }`}
        />
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`flex items-center justify-center w-9 h-full rounded-lg transition-all ${
          value === "grid"
            ? "bg-white shadow-sm dark:bg-gray-700"
            : "hover:bg-white/50 dark:hover:bg-gray-700/40"
        }`}
        title="Grid view"
        aria-label="Grid view"
      >
        <LayoutGrid
          className={`w-4 h-4 ${
            value === "grid"
              ? "text-gray-900 dark:text-white"
              : "text-gray-400"
          }`}
        />
      </button>
    </div>
  );
}
