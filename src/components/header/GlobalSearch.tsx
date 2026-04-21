"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { vehicleAPI, driverAPI } from "@/lib/api";

interface SearchResult {
  id: string;
  type: "vehicle" | "driver";
  title: string;
  subtitle: string;
  href: string;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        vehicleAPI.getAll({ search: q, limit: 5 }),
        driverAPI.getAll(),
      ]);

      const vehicleResults: SearchResult[] = (vehiclesRes.data.data.vehicles || []).map((v: { id: string; registrationNumber: string; make: string; model: string; fuelType: string }) => ({
        id: v.id,
        type: "vehicle" as const,
        title: v.registrationNumber,
        subtitle: `${v.make} ${v.model} — ${v.fuelType}`,
        href: `/vehicles/${v.id}`,
      }));

      const qLower = q.toLowerCase();
      const driverResults: SearchResult[] = (driversRes.data.data || [])
        .filter((d: { name: string; licenseNumber: string }) =>
          d.name.toLowerCase().includes(qLower) || d.licenseNumber.toLowerCase().includes(qLower)
        )
        .slice(0, 5)
        .map((d: { id: string; name: string; licenseNumber: string; vehicleClass: string }) => ({
          id: d.id,
          type: "driver" as const,
          title: d.name,
          subtitle: `${d.licenseNumber} — ${d.vehicleClass}`,
          href: `/drivers/${d.id}`,
        }));

      setResults([...vehicleResults, ...driverResults]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative hidden xl:block">
      <div className="relative">
        <span className="absolute -translate-y-1/2 left-4 top-1/2 pointer-events-none">
          {loading ? (
            <svg className="w-4 h-4 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="fill-gray-500 dark:fill-gray-400" width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z" fill="" />
            </svg>
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search vehicles, drivers..."
          className="h-11 w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-11 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[400px]"
        />
        <div className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs -tracking-[0.2px] text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
          <span>⌘</span><span>K</span>
        </div>
      </div>

      {/* Dropdown */}
      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl shadow-gray-200/50 dark:shadow-black/50 overflow-hidden z-[99999]">
          {loading && results.length === 0 ? (
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Searching...
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-400">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {/* Vehicles */}
              {results.filter((r) => r.type === "vehicle").length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vehicles</p>
                  {results.filter((r) => r.type === "vehicle").map((r) => {
                    const globalIdx = results.indexOf(r);
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          activeIndex === globalIdx
                            ? "bg-brand-50 dark:bg-brand-500/10"
                            : "hover:bg-gray-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activeIndex === globalIdx ? "bg-brand-100 dark:bg-brand-500/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                          <svg className={`w-4 h-4 ${activeIndex === globalIdx ? "text-brand-500" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono tracking-wide">{r.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.subtitle}</p>
                        </div>
                        {activeIndex === globalIdx && (
                          <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">Enter ↵</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Drivers */}
              {results.filter((r) => r.type === "driver").length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Drivers</p>
                  {results.filter((r) => r.type === "driver").map((r) => {
                    const globalIdx = results.indexOf(r);
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          activeIndex === globalIdx
                            ? "bg-brand-50 dark:bg-brand-500/10"
                            : "hover:bg-gray-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activeIndex === globalIdx ? "bg-brand-100 dark:bg-brand-500/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                          <svg className={`w-4 h-4 ${activeIndex === globalIdx ? "text-brand-500" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">{r.subtitle}</p>
                        </div>
                        {activeIndex === globalIdx && (
                          <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">Enter ↵</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  <span className="inline-flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[9px] font-mono">↑↓</kbd> Navigate</span>
                  <span className="mx-2">·</span>
                  <span className="inline-flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[9px] font-mono">↵</kbd> Select</span>
                  <span className="mx-2">·</span>
                  <span className="inline-flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[9px] font-mono">Esc</kbd> Close</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
