"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Truck, X } from "lucide-react";
import type { VehicleOption } from "./VehicleAutocomplete";

interface VehicleSelectFieldProps {
  vehicles: VehicleOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Classic dropdown picker with an embedded search field — the trigger looks
 * like a regular form `<select>`, and clicking it opens a panel containing a
 * search input at the top and a scrollable, filtered list below.
 *
 * Use this inside modals / forms where users expect select semantics. For
 * filter bars where typing-to-search is more natural, prefer
 * `VehicleAutocomplete` (the input itself is the search field).
 *
 * The dropdown is portal-mounted so it escapes any ancestor stacking context
 * (modal backdrops, transformed cards, overflow-clipped scrollers). z-index
 * sits above the highest modal in the app (Log Expense modal uses z-[99999]).
 */
export function VehicleSelectField({
  vehicles,
  value,
  onChange,
  placeholder = "Select vehicle",
  disabled = false,
}: VehicleSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const selected = useMemo(
    () => (value ? vehicles.find((v) => v.id === value) ?? null : null),
    [value, vehicles],
  );

  // Reset the search query whenever the panel closes, so the next open starts
  // with the full list visible (the spec asked for "show data like previously"
  // on click).
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Focus the search input as soon as the panel opens — saves the user one
  // click before they can start typing.
  useEffect(() => {
    if (open) {
      const id = window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [open]);

  // Outside click closes the panel. Must also ignore clicks inside the
  // portal-mounted dropdown since that's outside `wrapperRef` in the DOM.
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Track the trigger's position so the portal dropdown follows it through
  // scroll / resize / layout shifts.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Empty query → show every vehicle (sliced to 200 so the DOM stays cheap
  // even on huge fleets). Typed query → fuzzy substring match across reg no,
  // make, model, owner — same haystack as VehicleAutocomplete for parity.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles.slice(0, 200);
    return vehicles
      .filter((v) => {
        const hay = `${v.registrationNumber} ${v.make ?? ""} ${v.model ?? ""} ${v.ownerName ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200);
  }, [query, vehicles]);

  const triggerLabel = selected ? (
    <span className="truncate text-gray-900 dark:text-white">
      <span className="font-mono">{selected.registrationNumber}</span>
      {selected.make || selected.model ? (
        <span className="text-gray-500 dark:text-gray-400">
          {" "}
          — {[selected.make, selected.model].filter(Boolean).join(" ")}
        </span>
      ) : null}
      {selected.ownerName ? (
        <span className="text-gray-400 dark:text-gray-500">
          {" "}
          ({selected.ownerName})
        </span>
      ) : null}
    </span>
  ) : (
    <span className="text-gray-400">{placeholder}</span>
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-left flex items-center justify-between gap-2 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="w-5 h-5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
            </span>
          ) : null}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </div>
      </button>

      {open && !disabled && portalReady && rect
        ? createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: "fixed",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                zIndex: 100000,
              }}
              className="flex flex-col max-h-80 rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden"
            >
              <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                    strokeWidth={2}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setOpen(false);
                    }}
                    placeholder="Search by reg no, make, model, owner…"
                    autoComplete="off"
                    className="w-full h-8 rounded-md border border-gray-200 bg-white pl-8 pr-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-gray-400">
                    No vehicles found
                  </div>
                ) : (
                  filtered.map((v) => {
                    const isSelected = v.id === value;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onChange(v.id);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? "bg-yellow-50 dark:bg-yellow-500/10"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <Truck
                          className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400"}`}
                          strokeWidth={2}
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`font-mono text-xs ${isSelected ? "font-semibold text-yellow-700 dark:text-yellow-300" : "text-gray-900 dark:text-white"}`}
                          >
                            {v.registrationNumber}
                          </div>
                          {(v.make || v.model || v.ownerName) && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {[v.make, v.model].filter(Boolean).join(" ")}
                              {v.ownerName ? ` · ${v.ownerName}` : ""}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {vehicles.length > filtered.length && filtered.length === 200 && (
                <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 text-center flex-shrink-0">
                  Showing first 200 — type to narrow down
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
