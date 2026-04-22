"use client";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Search, X, Truck, ChevronDown } from "lucide-react";

export type VehicleOption = {
  id: string;
  registrationNumber: string;
  make?: string;
  model?: string;
};

interface VehicleAutocompleteProps {
  vehicles: VehicleOption[];
  value: string; // selected vehicle id, or "" for All Vehicles
  onChange: (id: string) => void;
  placeholder?: string;
  /** Text shown in the dropdown for the "clear selection" row. */
  allLabel?: string;
  className?: string;
  size?: "md" | "sm";
  disabled?: boolean;
}

/**
 * Autocomplete vehicle picker for filters.
 *
 * - Typing filters by registration number / make / model in real time
 * - Click a suggestion or type a full registration → auto-selects that vehicle
 * - Empty input (or clicking "All Vehicles") means no filter
 * - Fires `onChange(id)` with "" for no filter, or the picked vehicle's id
 */
export function VehicleAutocomplete({
  vehicles,
  value,
  onChange,
  placeholder = "All Vehicles",
  allLabel = "All Vehicles",
  className = "min-w-[220px]",
  size = "sm",
  disabled = false,
}: VehicleAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [portalReady, setPortalReady] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Track the input's position so the portal-mounted dropdown follows it
  // through scroll / resize / layout shifts.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDropdownRect({
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

  const selected = useMemo(
    () => (value ? vehicles.find((v) => v.id === value) ?? null : null),
    [value, vehicles],
  );

  // When parent updates the selection, sync the visible query text.
  // Empty query + no selection = "All Vehicles" state.
  useEffect(() => {
    if (!open) {
      setQuery(selected ? selected.registrationNumber : "");
    }
  }, [selected, open]);

  // Close on outside click — must also ignore clicks inside the portal-mounted
  // dropdown since it lives outside `wrapperRef` in the DOM tree.
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles.slice(0, 50);
    const matches = vehicles.filter((v) => {
      const haystack = `${v.registrationNumber} ${v.make ?? ""} ${v.model ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
    return matches.slice(0, 50);
  }, [query, vehicles]);

  const labelFor = (v: VehicleOption) =>
    [v.registrationNumber, v.make, v.model].filter(Boolean).join(" — ");

  const commit = (id: string) => {
    onChange(id);
    if (id) {
      const v = vehicles.find((x) => x.id === id);
      setQuery(v?.registrationNumber ?? "");
    } else {
      setQuery("");
    }
    setOpen(false);
    setActiveIdx(0);
  };

  const handleInputChange = (next: string) => {
    setQuery(next);
    setActiveIdx(0);
    if (!open) setOpen(true);

    // If the typed text exactly matches a registration number, auto-select it.
    const exact = vehicles.find(
      (v) => v.registrationNumber.toLowerCase() === next.trim().toLowerCase(),
    );
    if (exact && exact.id !== value) {
      onChange(exact.id);
      return;
    }
    // If they cleared it and a selection was active, fall back to "All Vehicles".
    if (next.trim() === "" && value) {
      onChange("");
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(filtered.length, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (activeIdx === 0) {
        commit(""); // "All Vehicles" row
      } else {
        const pick = filtered[activeIdx - 1];
        if (pick) commit(pick.id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const dims =
    size === "sm"
      ? {
          input: "h-9 rounded-lg pl-9 pr-16 text-xs",
          icon: "w-3.5 h-3.5 left-3",
          chevron: "right-2 w-3.5 h-3.5",
          clear: "right-7 h-5 w-5",
          clearIcon: "w-3 h-3",
          dropdown: "text-xs",
        }
      : {
          input: "h-10 rounded-xl pl-10 pr-20 text-sm",
          icon: "w-4 h-4 left-3.5",
          chevron: "right-2.5 w-4 h-4",
          clear: "right-9 h-6 w-6",
          clearIcon: "w-3.5 h-3.5",
          dropdown: "text-sm",
        };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <Search
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400 ${dims.icon}`}
        strokeWidth={2}
      />
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        aria-label={placeholder}
        className={`w-full border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 disabled:opacity-60 disabled:cursor-not-allowed ${dims.input}`}
      />
      {value || query ? (
        <button
          type="button"
          aria-label="Clear vehicle filter"
          onClick={() => commit("")}
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white transition-colors ${dims.clear}`}
        >
          <X className={dims.clearIcon} strokeWidth={2.5} />
        </button>
      ) : null}
      <ChevronDown
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400 ${dims.chevron}`}
        strokeWidth={2}
      />

      {open && !disabled && portalReady && dropdownRect
        ? createPortal(
            <div
              ref={dropdownRef}
              // Portal-mounted dropdown — escapes any ancestor stacking context
              // (e.g. backdrop-blur toolbars, transformed cards). Positioned
              // with fixed coords from the input's bounding rect.
              style={{
                position: "fixed",
                top: dropdownRect.top,
                left: dropdownRect.left,
                width: dropdownRect.width,
                zIndex: 9999,
              }}
              className={`max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 ${dims.dropdown}`}
            >
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit("");
                }}
                onMouseEnter={() => setActiveIdx(0)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  activeIdx === 0
                    ? "bg-brand-50 dark:bg-brand-500/10"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                } ${!value ? "font-semibold text-brand-600 dark:text-brand-400" : "text-gray-700 dark:text-gray-200"}`}
              >
                <Truck className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
                <span>{allLabel}</span>
              </button>

              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-gray-400">
                  No vehicles match &quot;{query}&quot;
                </div>
              ) : (
                filtered.map((v, i) => {
                  const active = activeIdx === i + 1;
                  const isSelected = value === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commit(v.id);
                      }}
                      onMouseEnter={() => setActiveIdx(i + 1)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                        active
                          ? "bg-brand-50 dark:bg-brand-500/10"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      } ${isSelected ? "font-semibold text-brand-600 dark:text-brand-400" : "text-gray-700 dark:text-gray-200"}`}
                    >
                      <span className="font-mono tracking-wide">{v.registrationNumber}</span>
                      {(v.make || v.model) && (
                        <span className="text-gray-400 dark:text-gray-500 truncate">
                          — {[v.make, v.model].filter(Boolean).join(" ")}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}

      {/* screen-reader-only selected label */}
      {selected ? (
        <span className="sr-only" aria-live="polite">
          Selected: {labelFor(selected)}
        </span>
      ) : null}
    </div>
  );
}
