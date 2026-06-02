"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/context/ToastContext";
import { vehicleAPI } from "@/lib/api";
import { Car, Save, X, Pencil } from "lucide-react";

// Editable shape that fully covers what the PATCH route accepts. Every
// field is optional in the payload; the modal initialises strings from
// the existing vehicle and submits only the keys the user changed.
export type EditableVehicle = {
  id: string;
  registrationNumber: string;
  ownerName?: string | null;
  make: string;
  model: string;
  fuelType: string;
  brand?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  gvw?: number | null;
  seatingCapacity?: number | null;
  tyreCount?: number | null;
  permitType?: string | null;
  vehicleUsage?: "PRIVATE" | "COMMERCIAL" | null;
  registrationDate?: string | null;
  rcStatus?: string | null;
  blacklistStatus?: string | null;
  financed?: boolean | null;
  financer?: string | null;
  ownerNumber?: number | null;
  registeredAt?: string | null;
  manufacturingDate?: string | null;
  ownerPhone?: string | null;
  ownerAddress?: string | null;
  fatherName?: string | null;
  color?: string | null;
  bodyType?: string | null;
  vehicleCategory?: string | null;
  normsType?: string | null;
  cubicCapacity?: string | null;
  cylinders?: number | null;
  wheelbase?: number | null;
  unladenWeight?: number | null;
  taxMode?: string | null;
};

type FormState = {
  registrationNumber: string;
  ownerName: string;
  make: string;
  model: string;
  fuelType: string;
  brand: string;
  chassisNumber: string;
  engineNumber: string;
  gvw: string;
  seatingCapacity: string;
  tyreCount: string;
  permitType: string;
  vehicleUsage: "" | "PRIVATE" | "COMMERCIAL";
  registrationDate: string;
  rcStatus: string;
  blacklistStatus: string;
  financed: "" | "yes" | "no";
  financer: string;
  ownerNumber: string;
  registeredAt: string;
  manufacturingDate: string;
  ownerPhone: string;
  ownerAddress: string;
  fatherName: string;
  color: string;
  bodyType: string;
  vehicleCategory: string;
  normsType: string;
  cubicCapacity: string;
  cylinders: string;
  wheelbase: string;
  unladenWeight: string;
  taxMode: string;
};

function fromVehicle(v: EditableVehicle): FormState {
  const dateStr = (d: string | null | undefined): string => {
    if (!d) return "";
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  };
  return {
    registrationNumber: v.registrationNumber ?? "",
    ownerName: v.ownerName ?? "",
    make: v.make ?? "",
    model: v.model ?? "",
    fuelType: v.fuelType ?? "",
    brand: v.brand ?? "",
    chassisNumber: v.chassisNumber ?? "",
    engineNumber: v.engineNumber ?? "",
    gvw: v.gvw != null ? String(v.gvw) : "",
    seatingCapacity: v.seatingCapacity != null ? String(v.seatingCapacity) : "",
    tyreCount: v.tyreCount != null ? String(v.tyreCount) : "",
    permitType: v.permitType ?? "",
    vehicleUsage: v.vehicleUsage ?? "",
    registrationDate: dateStr(v.registrationDate),
    rcStatus: v.rcStatus ?? "",
    blacklistStatus: v.blacklistStatus ?? "",
    financed: v.financed === true ? "yes" : v.financed === false ? "no" : "",
    financer: v.financer ?? "",
    ownerNumber: v.ownerNumber != null ? String(v.ownerNumber) : "",
    registeredAt: v.registeredAt ?? "",
    manufacturingDate: v.manufacturingDate ?? "",
    ownerPhone: v.ownerPhone ?? "",
    ownerAddress: v.ownerAddress ?? "",
    fatherName: v.fatherName ?? "",
    color: v.color ?? "",
    bodyType: v.bodyType ?? "",
    vehicleCategory: v.vehicleCategory ?? "",
    normsType: v.normsType ?? "",
    cubicCapacity: v.cubicCapacity ?? "",
    cylinders: v.cylinders != null ? String(v.cylinders) : "",
    wheelbase: v.wheelbase != null ? String(v.wheelbase) : "",
    unladenWeight: v.unladenWeight != null ? String(v.unladenWeight) : "",
    taxMode: v.taxMode ?? "",
  };
}

/**
 * Build the patch sent to the server. Only includes keys the user actually
 * changed — empty strings become `null` (clears the field), non-empty
 * strings become the new value, and untouched fields are omitted entirely.
 */
function buildPatch(initial: FormState, current: FormState): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const setIfChanged = <K extends keyof FormState>(
    key: K,
    transform?: (v: string) => unknown,
  ) => {
    if (current[key] === initial[key]) return;
    const raw = current[key];
    if (raw === "") {
      patch[key as string] = null;
      return;
    }
    patch[key as string] = transform ? transform(String(raw)) : raw;
  };

  setIfChanged("registrationNumber");
  setIfChanged("ownerName");
  setIfChanged("make");
  setIfChanged("model");
  setIfChanged("fuelType");
  setIfChanged("brand");
  setIfChanged("chassisNumber");
  setIfChanged("engineNumber");
  setIfChanged("permitType");
  setIfChanged("ownerPhone");
  setIfChanged("ownerAddress");
  setIfChanged("fatherName");
  setIfChanged("color");
  setIfChanged("bodyType");
  setIfChanged("vehicleCategory");
  setIfChanged("normsType");
  setIfChanged("cubicCapacity");
  setIfChanged("registeredAt");
  setIfChanged("manufacturingDate");
  setIfChanged("rcStatus");
  setIfChanged("blacklistStatus");
  setIfChanged("financer");
  setIfChanged("taxMode");

  setIfChanged("gvw", (s) => Number(s));
  setIfChanged("seatingCapacity", (s) => Number(s));
  setIfChanged("tyreCount", (s) => Number(s));
  setIfChanged("ownerNumber", (s) => Number(s));
  setIfChanged("cylinders", (s) => Number(s));
  setIfChanged("wheelbase", (s) => Number(s));
  setIfChanged("unladenWeight", (s) => Number(s));

  if (current.vehicleUsage !== initial.vehicleUsage) {
    patch.vehicleUsage = current.vehicleUsage === "" ? null : current.vehicleUsage;
  }
  if (current.financed !== initial.financed) {
    patch.financed =
      current.financed === "yes" ? true : current.financed === "no" ? false : null;
  }
  if (current.registrationDate !== initial.registrationDate) {
    patch.registrationDate = current.registrationDate || null;
  }

  return patch;
}

export function EditVehicleModal({
  isOpen,
  vehicle,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  vehicle: EditableVehicle | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the form whenever the modal opens against a (possibly different)
  // vehicle so stale state doesn't leak between edits.
  useEffect(() => {
    if (isOpen && vehicle) {
      const next = fromVehicle(vehicle);
      setForm(next);
      setInitial(next);
    } else if (!isOpen) {
      setForm(null);
      setInitial(null);
    }
  }, [isOpen, vehicle]);

  if (!form || !initial || !vehicle) {
    // Render nothing until state is hydrated.
    return null;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form.registrationNumber.trim()) {
      toast.error("Registration required", "Registration number cannot be empty");
      return;
    }
    if (!form.make.trim() || !form.model.trim() || !form.fuelType.trim()) {
      toast.error("Required fields", "Make, model and fuel type are required");
      return;
    }
    const patch = buildPatch(initial, form);
    if (Object.keys(patch).length === 0) {
      toast.info("No changes", "Nothing to save");
      onClose();
      return;
    }
    setSaving(true);
    try {
      await vehicleAPI.updateDetails(vehicle.id, patch);
      toast.success("Vehicle updated", "Changes saved");
      await onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Update failed";
      toast.error("Could not save", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      className="w-[95%] max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
    >
      <div className="flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
            <Pencil className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              Edit vehicle details
            </h3>
            <p className="text-[11px] text-gray-400 truncate">
              <Car className="w-3 h-3 inline -mt-0.5" /> {vehicle.registrationNumber}
              {" · "}
              {vehicle.make} {vehicle.model}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
          <Section title="Identity">
            <Grid>
              <Field label="Registration Number" required>
                <input
                  className={inputClass}
                  value={form.registrationNumber}
                  onChange={(e) =>
                    set("registrationNumber", e.target.value.toUpperCase())
                  }
                  disabled={saving}
                  maxLength={15}
                />
              </Field>
              <Field label="Owner Name">
                <input
                  className={inputClass}
                  value={form.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Make" required>
                <input
                  className={inputClass}
                  value={form.make}
                  onChange={(e) => set("make", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Model" required>
                <input
                  className={inputClass}
                  value={form.model}
                  onChange={(e) => set("model", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Brand">
                <input
                  className={inputClass}
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Fuel Type" required>
                <input
                  className={inputClass}
                  value={form.fuelType}
                  onChange={(e) => set("fuelType", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Usage">
                <select
                  className={inputClass}
                  value={form.vehicleUsage}
                  onChange={(e) =>
                    set("vehicleUsage", e.target.value as FormState["vehicleUsage"])
                  }
                  disabled={saving}
                >
                  <option value="">—</option>
                  <option value="PRIVATE">Private</option>
                  <option value="COMMERCIAL">Commercial</option>
                </select>
              </Field>
              <Field label="Permit Type">
                <input
                  className={inputClass}
                  value={form.permitType}
                  onChange={(e) => set("permitType", e.target.value)}
                  disabled={saving}
                />
              </Field>
            </Grid>
          </Section>

          <Section title="Chassis & Engine">
            <Grid>
              <Field label="Chassis Number">
                <input
                  className={`${inputClass} font-mono`}
                  value={form.chassisNumber}
                  onChange={(e) => set("chassisNumber", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Engine Number">
                <input
                  className={`${inputClass} font-mono`}
                  value={form.engineNumber}
                  onChange={(e) => set("engineNumber", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Registration Date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.registrationDate}
                  onChange={(e) => set("registrationDate", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Manufacturing Date">
                <input
                  className={inputClass}
                  placeholder="e.g. 10/2022"
                  value={form.manufacturingDate}
                  onChange={(e) => set("manufacturingDate", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Registered At (RTO)">
                <input
                  className={inputClass}
                  value={form.registeredAt}
                  onChange={(e) => set("registeredAt", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Tax Mode / Paid Until">
                <input
                  className={inputClass}
                  value={form.taxMode}
                  onChange={(e) => set("taxMode", e.target.value)}
                  disabled={saving}
                />
              </Field>
            </Grid>
          </Section>

          <Section title="Specs">
            <Grid>
              <Field label="GVW (kg)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.gvw}
                  onChange={(e) => set("gvw", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Unladen Weight (kg)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.unladenWeight}
                  onChange={(e) => set("unladenWeight", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Seating Capacity">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.seatingCapacity}
                  onChange={(e) => set("seatingCapacity", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Tyre Count">
                <input
                  type="number"
                  min={2}
                  max={20}
                  className={inputClass}
                  value={form.tyreCount}
                  onChange={(e) => set("tyreCount", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Cubic Capacity">
                <input
                  className={inputClass}
                  value={form.cubicCapacity}
                  onChange={(e) => set("cubicCapacity", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Cylinders">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.cylinders}
                  onChange={(e) => set("cylinders", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Wheelbase">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.wheelbase}
                  onChange={(e) => set("wheelbase", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Color">
                <input
                  className={inputClass}
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Body Type">
                <input
                  className={inputClass}
                  value={form.bodyType}
                  onChange={(e) => set("bodyType", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Vehicle Category">
                <input
                  className={inputClass}
                  value={form.vehicleCategory}
                  onChange={(e) => set("vehicleCategory", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Emission Norms">
                <input
                  className={inputClass}
                  value={form.normsType}
                  onChange={(e) => set("normsType", e.target.value)}
                  disabled={saving}
                />
              </Field>
            </Grid>
          </Section>

          <Section title="RC & Finance">
            <Grid>
              <Field label="RC Status">
                <input
                  className={inputClass}
                  value={form.rcStatus}
                  onChange={(e) => set("rcStatus", e.target.value)}
                  disabled={saving}
                  placeholder="e.g. ACTIVE"
                />
              </Field>
              <Field label="Blacklist Status">
                <input
                  className={inputClass}
                  value={form.blacklistStatus}
                  onChange={(e) => set("blacklistStatus", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Financed?">
                <select
                  className={inputClass}
                  value={form.financed}
                  onChange={(e) =>
                    set("financed", e.target.value as FormState["financed"])
                  }
                  disabled={saving}
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Financer">
                <input
                  className={inputClass}
                  value={form.financer}
                  onChange={(e) => set("financer", e.target.value)}
                  disabled={saving || form.financed === "no"}
                  placeholder={form.financed === "no" ? "N/A" : ""}
                />
              </Field>
            </Grid>
          </Section>

          <Section title="Owner contact">
            <Grid>
              <Field label="Owner Phone">
                <input
                  className={inputClass}
                  value={form.ownerPhone}
                  onChange={(e) => set("ownerPhone", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Owner Serial No.">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.ownerNumber}
                  onChange={(e) => set("ownerNumber", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Father / Husband Name">
                <input
                  className={inputClass}
                  value={form.fatherName}
                  onChange={(e) => set("fatherName", e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Owner Address" full>
                <textarea
                  rows={2}
                  className={`${inputClass} min-h-[60px] py-2`}
                  value={form.ownerAddress}
                  onChange={(e) => set("ownerAddress", e.target.value)}
                  disabled={saving}
                />
              </Field>
            </Grid>
          </Section>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Small bits ─────────────────────────────────────────────────────────────

const inputClass =
  "w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 disabled:opacity-60";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </p>
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
        {children}
      </div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>;
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
