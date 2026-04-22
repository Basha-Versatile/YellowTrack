"use client";
import React from "react";
import { Search, X } from "lucide-react";

type Size = "md" | "sm";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Classes for the outer wrapper (width, margins, flex sizing, etc.) */
  className?: string;
  /** Extra classes appended to the input element itself (rarely needed). */
  inputClassName?: string;
  /** `md` = h-10 pl-10 (default). `sm` = h-9 pl-9 — matches the compact filter rows. */
  size?: Size;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  /** Accessible label used if `id` is also set. Defaults to the placeholder. */
  ariaLabel?: string;
}

/**
 * Standard search input used across the app.
 *
 * - Live `onChange` emits every keystroke (no submit needed)
 * - Shows a clear (X) button on the right while the value is non-empty;
 *   clicking it fires `onChange("")` to wipe the field
 * - Styling matches the existing TailAdmin look (10px radius, brand focus ring,
 *   light + dark variants)
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "w-full",
  inputClassName = "",
  size = "md",
  autoFocus,
  disabled,
  id,
  ariaLabel,
}: SearchInputProps) {
  const dims =
    size === "sm"
      ? {
          wrapper: "",
          input:
            "h-9 rounded-lg pl-9 pr-8 text-xs placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white",
          icon: "w-3.5 h-3.5 left-3",
          clear: "right-1.5 h-5 w-5",
          clearIcon: "w-3 h-3",
        }
      : {
          wrapper: "",
          input:
            "h-10 rounded-xl pl-10 pr-9 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500",
          icon: "w-4 h-4 left-3.5",
          clear: "right-2 h-6 w-6",
          clearIcon: "w-3.5 h-3.5",
        };

  return (
    <div className={`relative ${dims.wrapper} ${className}`}>
      <Search
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400 ${dims.icon}`}
        strokeWidth={2}
      />
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border border-gray-200 bg-white text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed ${dims.input} ${inputClassName}`}
      />
      {value && !disabled ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white transition-colors ${dims.clear}`}
        >
          <X className={dims.clearIcon} strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}
