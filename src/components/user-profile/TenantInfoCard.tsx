"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Pencil, Upload, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useModal } from "@/hooks/useModal";
import { tenantAPI } from "@/lib/api";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Label from "../form/Label";

type TenantDetails = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  billingEmail: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
};

type EditableField =
  | "name"
  | "billingEmail"
  | "gstNumber"
  | "panNumber"
  | "addressLine"
  | "city"
  | "state"
  | "pinCode";

type FormState = Record<EditableField, string>;

const EMPTY_FORM: FormState = {
  name: "",
  billingEmail: "",
  gstNumber: "",
  panNumber: "",
  addressLine: "",
  city: "",
  state: "",
  pinCode: "",
};

function formFromTenant(t: TenantDetails | null): FormState {
  if (!t) return { ...EMPTY_FORM };
  return {
    name: t.name ?? "",
    billingEmail: t.billingEmail ?? "",
    gstNumber: t.gstNumber ?? "",
    panNumber: t.panNumber ?? "",
    addressLine: t.addressLine ?? "",
    city: t.city ?? "",
    state: t.state ?? "",
    pinCode: t.pinCode ?? "",
  };
}

function display(value: string | null | undefined): string {
  return value && String(value).trim() ? String(value) : "—";
}

function initialsOf(name: string | undefined | null): string {
  if (!name) return "W";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TenantInfoCard() {
  const { user, tenant: cachedTenant, updateTenant } = useAuth();
  const toast = useToast();
  const { isOpen, openModal, closeModal } = useModal();

  const [tenant, setTenant] = useState<TenantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEdit = user?.role === "ADMIN";
  const hasTenant = Boolean(cachedTenant?.id ?? user?.tenantId);

  const loadTenant = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantAPI.getMine();
      setTenant(res.data.data as TenantDetails);
    } catch {
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasTenant) {
      setLoading(false);
      return;
    }
    void loadTenant();
  }, [hasTenant, loadTenant]);

  const openEdit = () => {
    setForm(formFromTenant(tenant));
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
    openModal();
  };

  const setField = (key: EditableField) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setLogoFile(f);
    setLogoPreview(f ? URL.createObjectURL(f) : null);
    setRemoveLogo(false);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  };

  const currentLogo = removeLogo
    ? null
    : logoPreview ?? tenant?.logoUrl ?? null;

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Workspace name must be at least 2 characters");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        billingEmail: form.billingEmail.trim() || null,
        gstNumber: form.gstNumber.trim() || null,
        panNumber: form.panNumber.trim() || null,
        addressLine: form.addressLine.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        pinCode: form.pinCode.trim() || null,
        logo: logoFile,
        removeLogo,
      };
      // Route through the auth context so the sidebar / header logo refresh.
      await updateTenant(payload);
      // Refetch the full tenant for the card (the auth-context cache only
      // tracks the slim id/name/slug/logo/billingEmail subset).
      await loadTenant();
      toast.success("Workspace updated");
      closeModal();
    } catch (err) {
      const errs =
        (err as { response?: { data?: { errors?: string[]; message?: string } } })
          ?.response?.data;
      const msg = errs?.errors?.[0] ?? errs?.message ?? "Failed to update workspace";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!hasTenant) return null;

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-yellow-100 dark:bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                {tenant?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tenant.logoUrl}
                    alt={tenant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-extrabold text-yellow-700 dark:text-yellow-400">
                    {initialsOf(tenant?.name ?? cachedTenant?.name)}
                  </span>
                )}
              </div>
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Workspace Details
              </h4>
            </div>
            {canEdit && (
              <button
                onClick={openEdit}
                disabled={loading || !tenant}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : !tenant ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Workspace details unavailable.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32">
              <FieldRow label="Workspace name" value={tenant.name} />
              <FieldRow label="Billing email" value={tenant.billingEmail} />
              <FieldRow label="GST number" value={tenant.gstNumber} />
              <FieldRow label="PAN number" value={tenant.panNumber} />
              <FieldRow
                label="Address"
                value={tenant.addressLine}
                className="sm:col-span-2"
              />
              <FieldRow label="City" value={tenant.city} />
              <FieldRow label="State" value={tenant.state} />
              <FieldRow label="PIN code" value={tenant.pinCode} />
            </div>
          )}

          {!canEdit && tenant && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Only the workspace admin can edit these details.
            </p>
          )}
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[720px] m-4">
        <div className="no-scrollbar relative w-full overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-8">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Edit workspace
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              These details appear on invoices, exports, and the workspace
              header. Leave any field empty to clear it.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="flex flex-col"
          >
            <div className="px-2 pb-3 space-y-6">
              {/* Logo */}
              <div>
                <Label>Workspace logo</Label>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 flex items-center justify-center">
                    {currentLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentLogo}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-extrabold text-gray-400">
                        {initialsOf(form.name || tenant?.name)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                      <Upload className="w-3.5 h-3.5" />
                      {currentLogo ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                        onChange={onLogoChange}
                        className="hidden"
                      />
                    </label>
                    {currentLogo && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        <X className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                <FormField label="Workspace name" required>
                  <PlainInput value={form.name} onChange={setField("name")} />
                </FormField>
                <FormField label="Billing email">
                  <PlainInput
                    type="email"
                    value={form.billingEmail}
                    onChange={setField("billingEmail")}
                    placeholder="billing@example.com"
                  />
                </FormField>
                <FormField label="GST number">
                  <PlainInput
                    value={form.gstNumber}
                    onChange={setField("gstNumber")}
                    placeholder="27AAPCS9988A1Z5"
                  />
                </FormField>
                <FormField label="PAN number">
                  <PlainInput
                    value={form.panNumber}
                    onChange={setField("panNumber")}
                    placeholder="AAPCS9988A"
                  />
                </FormField>
                <FormField label="Address" className="sm:col-span-2">
                  <PlainInput
                    value={form.addressLine}
                    onChange={setField("addressLine")}
                    placeholder="Street, building, area"
                  />
                </FormField>
                <FormField label="City">
                  <PlainInput value={form.city} onChange={setField("city")} />
                </FormField>
                <FormField label="State">
                  <PlainInput value={form.state} onChange={setField("state")} />
                </FormField>
                <FormField label="PIN code">
                  <PlainInput
                    value={form.pinCode}
                    onChange={setField("pinCode")}
                    placeholder="560001"
                  />
                </FormField>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={closeModal}
                disabled={saving}
              >
                Close
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

function FieldRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">
        {display(value)}
      </p>
    </div>
  );
}

function FormField({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label>
        {label}
        {required && <span className="text-error-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function PlainInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:border-yellow-400 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
    />
  );
}
