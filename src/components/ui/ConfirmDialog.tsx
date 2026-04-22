"use client";
import React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "./modal";

type Variant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional thumbnail/preview shown above the message (e.g. the image being deleted). */
  preview?: React.ReactNode;
}

const VARIANT_STYLES: Record<
  Variant,
  { iconWrap: string; icon: string; button: string }
> = {
  danger: {
    iconWrap: "bg-red-100 dark:bg-red-500/15",
    icon: "text-red-600 dark:text-red-400",
    button:
      "bg-red-500 hover:bg-red-600 focus:ring-red-500/30 disabled:bg-red-300",
  },
  warning: {
    iconWrap: "bg-amber-100 dark:bg-amber-500/15",
    icon: "text-amber-600 dark:text-amber-400",
    button:
      "bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/30 disabled:bg-amber-300",
  },
  info: {
    iconWrap: "bg-brand-100 dark:bg-brand-500/15",
    icon: "text-brand-600 dark:text-brand-400",
    button:
      "bg-brand-500 hover:bg-brand-600 focus:ring-brand-500/30 disabled:bg-brand-300",
  },
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
  preview,
}: ConfirmDialogProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = variant === "danger" ? Trash2 : AlertTriangle;

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => undefined : onCancel}
      showCloseButton={false}
      className="w-[90%] max-w-[420px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${styles.iconWrap}`}
          >
            <Icon className={`w-5 h-5 ${styles.icon}`} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {preview ? (
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-gray-800/40">
            {preview}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus:ring-4 ${styles.button}`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
