"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/context/ToastContext";
import { vehicleAPI } from "@/lib/api";
import { Download, FileSpreadsheet, X, Check, Sigma } from "lucide-react";

type Field = {
  id: string;
  label: string;
  category: string;
};

type Filters = {
  lifecycle?: "ACTIVE" | "SOLD";
  groupId?: string;
  vehicleUsage?: "PRIVATE" | "COMMERCIAL";
  status?: "GREEN" | "YELLOW" | "RED";
  brand?: string;
  search?: string;
};

const DEFAULT_SELECTION = new Set([
  "registrationNumber",
  "make",
  "model",
  "brand",
  "fuelType",
  "vehicleUsage",
  "ownerName",
  "chassisNumber",
  "RC.expiryDate",
  "INSURANCE.expiryDate",
  "PUCC.expiryDate",
  "FITNESS.expiryDate",
]);

export function ExportVehiclesModal({
  isOpen,
  filters,
  onClose,
  filteredCount,
  fleetCount,
}: {
  isOpen: boolean;
  filters?: Filters;
  onClose: () => void;
  // Records matching the current page filters, and the whole tab's fleet.
  // Used to block an export that would produce an empty file.
  filteredCount?: number;
  fleetCount?: number;
}) {
  const toast = useToast();
  const [fields, setFields] = useState<Field[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTION));
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [applyCurrentFilters, setApplyCurrentFilters] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Lazy-load the field catalog on first open so the picker mirrors the
  // server registry exactly — no duplicate list to keep in sync.
  useEffect(() => {
    if (!isOpen || fields.length > 0) return;
    setLoadingFields(true);
    vehicleAPI
      .listExportFields()
      .then((res) => {
        const list = (res.data?.data ?? []) as Field[];
        setFields(list);
      })
      .catch(() => {
        toast.error("Failed to load", "Could not load export fields");
      })
      .finally(() => setLoadingFields(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Field[]>();
    for (const f of fields) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return map;
  }, [fields]);

  const toggleField = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    const ids = (byCategory.get(category) ?? []).map((f) => f.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(fields.map((f) => f.id)));
  const clearAll = () => setSelected(new Set());
  const resetDefaults = () => setSelected(new Set(DEFAULT_SELECTION));

  // Records that will actually be exported given the chosen scope. With the
  // page filters applied that's the filtered count; without, the whole fleet.
  // `undefined` when the count wasn't supplied — we then fail open (don't
  // block) so the server stays the source of truth.
  const exportCount = applyCurrentFilters ? filteredCount : fleetCount;
  const nothingToExport = exportCount === 0;

  const handleExport = async () => {
    if (selected.size === 0) {
      toast.error("Pick at least one field", "Tick what you want in the report");
      return;
    }
    if (nothingToExport) {
      toast.error(
        "Nothing to export",
        "At least one vehicle record is required to export. Adjust your filters or onboard a vehicle first.",
      );
      return;
    }
    setExporting(true);
    try {
      const res = await vehicleAPI.exportData({
        format,
        fields: Array.from(selected),
        filters: applyCurrentFilters ? filters : undefined,
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const ext = format === "csv" ? "csv" : "xlsx";
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yellowtrack-vehicles-${stamp}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export ready", "Check your downloads");
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Export failed";
      toast.error("Export failed", msg);
    } finally {
      setExporting(false);
    }
  };

  const activeFilterChips = useMemo(() => {
    if (!filters) return [];
    const chips: string[] = [];
    if (filters.lifecycle === "SOLD") chips.push("Sold");
    else if (filters.lifecycle === "ACTIVE") chips.push("Active");
    if (filters.status) chips.push(`Status ${filters.status}`);
    if (filters.vehicleUsage) chips.push(filters.vehicleUsage);
    if (filters.brand) chips.push(`Brand ${filters.brand}`);
    if (filters.groupId) chips.push("Group filter");
    if (filters.search) chips.push(`Search "${filters.search}"`);
    return chips;
  }, [filters]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={exporting ? () => {} : onClose}
      className="w-[95%] max-w-4xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
    >
      <div className="flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              Export vehicles
            </h3>
            <p className="text-[11px] text-gray-400">
              Pick columns + format. Defaults cover the most common report.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 overflow-y-auto flex-1">
          {/* ── Left: format + filters + bulk actions ── */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Format
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["xlsx", "csv"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    disabled={exporting}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      format === f
                        ? "border-yellow-400 bg-yellow-50 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400"
                        : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {f === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Scope
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyCurrentFilters}
                  onChange={(e) => setApplyCurrentFilters(e.target.checked)}
                  disabled={exporting || !filters}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Apply current page filters
                  </p>
                  {activeFilterChips.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {activeFilterChips.map((c) => (
                        <span
                          key={c}
                          className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 text-[10px] font-semibold"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      No filters active — full fleet will export.
                    </p>
                  )}
                </div>
              </label>
            </div>

            <div>
              <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Selection
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={resetDefaults}
                  disabled={exporting}
                  className="w-full text-left text-xs font-semibold text-yellow-700 dark:text-yellow-400 hover:underline"
                >
                  Reset to defaults
                </button>
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={exporting}
                  className="w-full text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Select all ({fields.length})
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={exporting}
                  className="w-full text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Clear all
                </button>
              </div>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 px-2 py-1 text-[11px] font-semibold">
                <Sigma className="w-3 h-3" />
                {selected.size} field{selected.size === 1 ? "" : "s"} picked
              </p>
            </div>
          </div>

          {/* ── Right: fields grouped by category ── */}
          <div className="space-y-4 min-w-0">
            {loadingFields ? (
              <p className="text-xs text-gray-400 text-center py-6">Loading fields…</p>
            ) : fields.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">
                No exportable fields available.
              </p>
            ) : (
              Array.from(byCategory.entries()).map(([category, list]) => {
                const allOn = list.every((f) => selected.has(f.id));
                const someOn = !allOn && list.some((f) => selected.has(f.id));
                return (
                  <div
                    key={category}
                    className="rounded-xl border border-gray-200 dark:border-gray-800"
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        {category}
                        <span className="ml-1.5 font-normal text-gray-400 normal-case">
                          ({list.filter((f) => selected.has(f.id)).length}/{list.length})
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        disabled={exporting}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-700 dark:text-yellow-400 hover:underline"
                      >
                        {allOn ? "Clear" : someOn ? "Select remaining" : "Select all"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 p-2">
                      {list.map((f) => {
                        const on = selected.has(f.id);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                              on
                                ? "bg-yellow-50/60 dark:bg-yellow-500/10 text-gray-900 dark:text-white"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                            }`}
                          >
                            <span
                              className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                on
                                  ? "bg-yellow-500 border-yellow-500 text-white"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {on && <Check className="w-3 h-3" />}
                            </span>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleField(f.id)}
                              disabled={exporting}
                              className="hidden"
                            />
                            <span className="truncate">{f.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
          {nothingToExport && (
            <p className="mr-auto text-[11px] font-semibold text-red-500 dark:text-red-400">
              No vehicle records to export — at least one is required.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || selected.size === 0 || nothingToExport}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {exporting ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exporting ? "Building…" : `Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
