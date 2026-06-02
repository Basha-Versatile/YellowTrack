import "server-only";
import * as XLSX from "xlsx";
import { EMIPlan } from "@/models";
import type { ScopedContext } from "@/lib/auth/tenant-context";
import { tenantFilter } from "@/lib/auth/tenant-context";
import * as vehicleRepo from "../repositories/vehicle.repository";
import {
  calculateComplianceStatus,
  daysUntilExpiry,
} from "./compliance.service";

// ── Field registry ─────────────────────────────────────────────────────────
// One source of truth for every column the user can pick. Each entry knows
// its label, category (for the picker UI), and an extractor that maps a
// fully-enriched vehicle row to a single cell value. New fields are a
// one-liner addition — no other code needs to change.

type Row = Record<string, unknown>;

type EnrichedVehicleRow = Row & {
  _id: unknown;
  complianceDocuments: ComplianceRow[];
  challans: Array<{ amount: number; status: string }>;
  driverMappings: Array<{ isActive?: boolean; driver?: unknown }>;
  groups?: Array<{ name?: string }>;
  sale?: Row | null;
};

type ComplianceRow = Row & {
  type?: string;
  documentNumber?: string | null;
  issuedDate?: Date | string | null;
  expiryDate?: Date | string | null;
  status?: string;
};

type ExportContext = {
  vehicle: EnrichedVehicleRow;
  byDocType: Map<string, ComplianceRow>;
  emi: Row | null;
};

type FieldDef = {
  id: string;
  label: string;
  category: string;
  extract: (ctx: ExportContext) => string | number | null;
};

function formatDate(d: unknown): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function complianceStatus(doc: ComplianceRow | undefined): string {
  if (!doc) return "";
  return doc.status ?? calculateComplianceStatus(doc.expiryDate ?? null);
}

function daysLeft(doc: ComplianceRow | undefined): number | "" {
  if (!doc) return "";
  const n = daysUntilExpiry(doc.expiryDate ?? null);
  return n == null ? "" : n;
}

// Helper to register every standard compliance type with the same 4 fields.
function complianceFields(type: string, displayName: string): FieldDef[] {
  const cat = displayName;
  return [
    {
      id: `${type}.documentNumber`,
      label: `${displayName} — Document No.`,
      category: cat,
      extract: ({ byDocType }) => byDocType.get(type)?.documentNumber ?? "",
    },
    {
      id: `${type}.issuedDate`,
      label: `${displayName} — Issued`,
      category: cat,
      extract: ({ byDocType }) => formatDate(byDocType.get(type)?.issuedDate),
    },
    {
      id: `${type}.expiryDate`,
      label: `${displayName} — Expiry`,
      category: cat,
      extract: ({ byDocType }) => formatDate(byDocType.get(type)?.expiryDate),
    },
    {
      id: `${type}.daysLeft`,
      label: `${displayName} — Days Left`,
      category: cat,
      extract: ({ byDocType }) => daysLeft(byDocType.get(type)),
    },
    {
      id: `${type}.status`,
      label: `${displayName} — Status`,
      category: cat,
      extract: ({ byDocType }) => complianceStatus(byDocType.get(type)),
    },
  ];
}

const VEHICLE_FIELDS: FieldDef[] = [
  // ── Vehicle basics ────────────────────────────────────────────
  { id: "registrationNumber", label: "Registration Number", category: "Vehicle", extract: ({ vehicle }) => (vehicle.registrationNumber as string) ?? "" },
  { id: "make", label: "Make", category: "Vehicle", extract: ({ vehicle }) => (vehicle.make as string) ?? "" },
  { id: "model", label: "Model", category: "Vehicle", extract: ({ vehicle }) => (vehicle.model as string) ?? "" },
  { id: "brand", label: "Brand", category: "Vehicle", extract: ({ vehicle }) => (vehicle.brand as string) ?? "" },
  { id: "fuelType", label: "Fuel Type", category: "Vehicle", extract: ({ vehicle }) => (vehicle.fuelType as string) ?? "" },
  { id: "vehicleUsage", label: "Usage (Private/Commercial)", category: "Vehicle", extract: ({ vehicle }) => (vehicle.vehicleUsage as string) ?? "" },
  { id: "permitType", label: "Permit Type", category: "Vehicle", extract: ({ vehicle }) => (vehicle.permitType as string) ?? "" },
  { id: "lifecycleStatus", label: "Status (Active/Sold)", category: "Vehicle", extract: ({ vehicle }) => (vehicle.status as string) ?? "" },
  { id: "groupNames", label: "Groups", category: "Vehicle", extract: ({ vehicle }) => (vehicle.groups ?? []).map((g) => g.name ?? "").filter(Boolean).join(", ") },
  { id: "registrationDate", label: "Registration Date", category: "Vehicle", extract: ({ vehicle }) => formatDate(vehicle.registrationDate) },
  { id: "manufacturingDate", label: "Manufacturing Date", category: "Vehicle", extract: ({ vehicle }) => (vehicle.manufacturingDate as string) ?? "" },
  { id: "registeredAt", label: "Registered At (RTO)", category: "Vehicle", extract: ({ vehicle }) => (vehicle.registeredAt as string) ?? "" },
  { id: "color", label: "Color", category: "Vehicle", extract: ({ vehicle }) => (vehicle.color as string) ?? "" },
  { id: "bodyType", label: "Body Type", category: "Vehicle", extract: ({ vehicle }) => (vehicle.bodyType as string) ?? "" },
  { id: "vehicleCategory", label: "Category", category: "Vehicle", extract: ({ vehicle }) => (vehicle.vehicleCategory as string) ?? "" },
  { id: "normsType", label: "Emission Norms", category: "Vehicle", extract: ({ vehicle }) => (vehicle.normsType as string) ?? "" },
  { id: "cubicCapacity", label: "Cubic Capacity", category: "Vehicle", extract: ({ vehicle }) => (vehicle.cubicCapacity as string) ?? "" },
  { id: "cylinders", label: "Cylinders", category: "Vehicle", extract: ({ vehicle }) => (vehicle.cylinders as number) ?? "" },
  { id: "wheelbase", label: "Wheelbase", category: "Vehicle", extract: ({ vehicle }) => (vehicle.wheelbase as number) ?? "" },
  { id: "gvw", label: "GVW (kg)", category: "Vehicle", extract: ({ vehicle }) => (vehicle.gvw as number) ?? "" },
  { id: "unladenWeight", label: "Unladen Weight", category: "Vehicle", extract: ({ vehicle }) => (vehicle.unladenWeight as number) ?? "" },
  { id: "seatingCapacity", label: "Seating Capacity", category: "Vehicle", extract: ({ vehicle }) => (vehicle.seatingCapacity as number) ?? "" },
  { id: "tyreCount", label: "Tyre Count", category: "Vehicle", extract: ({ vehicle }) => (vehicle.tyreCount as number) ?? "" },
  { id: "taxMode", label: "Tax Mode / Paid Until", category: "Vehicle", extract: ({ vehicle }) => (vehicle.taxMode as string) ?? "" },
  { id: "chassisNumber", label: "Chassis Number", category: "Vehicle", extract: ({ vehicle }) => (vehicle.chassisNumber as string) ?? "" },
  { id: "engineNumber", label: "Engine Number", category: "Vehicle", extract: ({ vehicle }) => (vehicle.engineNumber as string) ?? "" },
  { id: "rcStatus", label: "RC Status (Surepass)", category: "Vehicle", extract: ({ vehicle }) => (vehicle.rcStatus as string) ?? "" },
  { id: "blacklistStatus", label: "Blacklist Status", category: "Vehicle", extract: ({ vehicle }) => (vehicle.blacklistStatus as string) ?? "" },
  { id: "financed", label: "Financed?", category: "Vehicle", extract: ({ vehicle }) => (vehicle.financed === true ? "Yes" : vehicle.financed === false ? "No" : "") },
  { id: "financer", label: "Financer", category: "Vehicle", extract: ({ vehicle }) => (vehicle.financer as string) ?? "" },

  // ── Owner ────────────────────────────────────────────────────
  { id: "ownerName", label: "Owner Name", category: "Owner", extract: ({ vehicle }) => (vehicle.ownerName as string) ?? "" },
  { id: "ownerPhone", label: "Owner Phone", category: "Owner", extract: ({ vehicle }) => (vehicle.ownerPhone as string) ?? "" },
  { id: "ownerAddress", label: "Owner Address", category: "Owner", extract: ({ vehicle }) => (vehicle.ownerAddress as string) ?? "" },
  { id: "ownerNumber", label: "Owner Serial No.", category: "Owner", extract: ({ vehicle }) => (vehicle.ownerNumber as number) ?? "" },
  { id: "fatherName", label: "Father / Husband Name", category: "Owner", extract: ({ vehicle }) => (vehicle.fatherName as string) ?? "" },

  // ── Active Driver ────────────────────────────────────────────
  {
    id: "activeDriver.name",
    label: "Active Driver",
    category: "Driver",
    extract: ({ vehicle }) => {
      const mapping = (vehicle.driverMappings ?? []).find((m) => m.isActive);
      const driver = (mapping?.driver ?? null) as { name?: string } | null;
      return driver?.name ?? "";
    },
  },
  {
    id: "activeDriver.phone",
    label: "Active Driver Phone",
    category: "Driver",
    extract: ({ vehicle }) => {
      const mapping = (vehicle.driverMappings ?? []).find((m) => m.isActive);
      const driver = (mapping?.driver ?? null) as { phone?: string } | null;
      return driver?.phone ?? "";
    },
  },

  // ── Compliance docs by type (RC, Insurance, PUC, Fitness, Permit, Tax) ──
  ...complianceFields("RC", "RC"),
  ...complianceFields("INSURANCE", "Insurance"),
  ...complianceFields("PUCC", "PUC"),
  ...complianceFields("FITNESS", "Fitness"),
  ...complianceFields("PERMIT", "Permit"),
  ...complianceFields("TAX", "Tax"),

  // ── EMI ──────────────────────────────────────────────────────
  { id: "emi.lenderName", label: "EMI Lender", category: "EMI", extract: ({ emi }) => (emi?.lenderName as string) ?? "" },
  { id: "emi.lenderType", label: "EMI Lender Type", category: "EMI", extract: ({ emi }) => (emi?.lenderType as string) ?? "" },
  { id: "emi.lenderBranch", label: "EMI Lender Branch", category: "EMI", extract: ({ emi }) => (emi?.lenderBranch as string) ?? "" },
  { id: "emi.lenderContactPhone", label: "EMI Lender Contact", category: "EMI", extract: ({ emi }) => (emi?.lenderContactPhone as string) ?? "" },
  { id: "emi.loanAccountNumber", label: "Loan Account Number (LAN)", category: "EMI", extract: ({ emi }) => (emi?.loanAccountNumber as string) ?? "" },
  { id: "emi.debitBankName", label: "Debit Bank", category: "EMI", extract: ({ emi }) => (emi?.debitBankName as string) ?? "" },
  { id: "emi.debitAccountMasked", label: "Debit Account", category: "EMI", extract: ({ emi }) => (emi?.debitAccountMasked as string) ?? "" },
  { id: "emi.principalAmount", label: "Principal (₹)", category: "EMI", extract: ({ emi }) => (emi?.principalAmount as number) ?? "" },
  { id: "emi.emiAmount", label: "EMI / month (₹)", category: "EMI", extract: ({ emi }) => (emi?.emiAmount as number) ?? "" },
  { id: "emi.totalInstallments", label: "Total Installments", category: "EMI", extract: ({ emi }) => (emi?.totalInstallments as number) ?? "" },
  { id: "emi.paidInstallments", label: "Paid Installments", category: "EMI", extract: ({ emi }) => (emi?.paidInstallments as number) ?? "" },
  {
    id: "emi.remainingInstallments",
    label: "Remaining Installments",
    category: "EMI",
    extract: ({ emi }) => {
      if (!emi) return "";
      const total = (emi.totalInstallments as number) ?? 0;
      const paid = (emi.paidInstallments as number) ?? 0;
      return Math.max(0, total - paid);
    },
  },
  { id: "emi.startDate", label: "EMI Start Date", category: "EMI", extract: ({ emi }) => formatDate(emi?.startDate) },
  { id: "emi.endDate", label: "EMI End Date", category: "EMI", extract: ({ emi }) => formatDate(emi?.endDate) },
  { id: "emi.dueDayOfMonth", label: "EMI Due Day of Month", category: "EMI", extract: ({ emi }) => (emi?.dueDayOfMonth as number) ?? "" },
  { id: "emi.nextDueDate", label: "EMI Next Due", category: "EMI", extract: ({ emi }) => formatDate(emi?.nextDueDate) },
  { id: "emi.status", label: "EMI Status", category: "EMI", extract: ({ emi }) => (emi?.status as string) ?? "" },

  // ── Challans ─────────────────────────────────────────────────
  {
    id: "challans.pendingCount",
    label: "Pending Challans (count)",
    category: "Challans",
    extract: ({ vehicle }) =>
      (vehicle.challans ?? []).filter((c) => c.status === "PENDING").length,
  },
  {
    id: "challans.pendingAmount",
    label: "Pending Challans (₹)",
    category: "Challans",
    extract: ({ vehicle }) =>
      (vehicle.challans ?? [])
        .filter((c) => c.status === "PENDING")
        .reduce((sum, c) => sum + (c.amount ?? 0), 0),
  },

  // ── Sale (if SOLD) ───────────────────────────────────────────
  { id: "sale.soldOn", label: "Sold On", category: "Sale", extract: ({ vehicle }) => formatDate((vehicle.sale as Row | null)?.soldOn) },
  { id: "sale.salePrice", label: "Sale Price (₹)", category: "Sale", extract: ({ vehicle }) => ((vehicle.sale as Row | null)?.salePrice as number) ?? "" },
  { id: "sale.buyerName", label: "Buyer Name", category: "Sale", extract: ({ vehicle }) => ((vehicle.sale as Row | null)?.buyerName as string) ?? "" },
];

export type ExportableField = {
  id: string;
  label: string;
  category: string;
};

/**
 * Public list of every selectable field, grouped by category. Returned by
 * the lightweight GET so the client can build the picker without
 * duplicating the registry.
 */
export function listExportableFields(): ExportableField[] {
  return VEHICLE_FIELDS.map(({ id, label, category }) => ({ id, label, category }));
}

// ── Exporter ───────────────────────────────────────────────────────────────

export type ExportFilters = {
  lifecycle?: "ACTIVE" | "SOLD";
  groupId?: string;
  vehicleUsage?: "PRIVATE" | "COMMERCIAL";
  status?: "GREEN" | "YELLOW" | "RED";
  brand?: string;
  search?: string;
};

export type ExportInput = {
  format: "csv" | "xlsx";
  fields: string[]; // ids from VEHICLE_FIELDS
  filters?: ExportFilters;
};

const DEFAULT_FIELDS = [
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
];

export async function exportVehicles(
  ctx: ScopedContext,
  input: ExportInput,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  // Resolve the field list — fall back to a sensible default if none picked.
  const requested = input.fields.length > 0 ? input.fields : DEFAULT_FIELDS;
  const selected = requested
    .map((id) => VEHICLE_FIELDS.find((f) => f.id === id))
    .filter((f): f is FieldDef => Boolean(f));
  if (selected.length === 0) {
    throw new Error("No valid fields selected");
  }

  // Pull every matching vehicle. Use a very high limit so no fleet size
  // accidentally truncates the report.
  const result = await vehicleRepo.findAll(ctx, {
    page: 1,
    limit: 100000,
    lifecycle: input.filters?.lifecycle,
    groupId: input.filters?.groupId,
    vehicleUsage: input.filters?.vehicleUsage,
    status: input.filters?.status,
    brand: input.filters?.brand,
    search: input.filters?.search,
  });

  const vehicles = result.vehicles as unknown as EnrichedVehicleRow[];

  // Bulk-fetch the active EMI plan per vehicle so we don't N+1 the DB.
  const vehicleIds = vehicles.map((v) => v._id);
  const emiPlans = vehicleIds.length
    ? await EMIPlan.find(
        tenantFilter(ctx, {
          vehicleId: { $in: vehicleIds },
          status: { $ne: "CLOSED" },
        }),
      ).lean()
    : [];
  const emiByVehicle = new Map<string, Row>();
  for (const plan of emiPlans) {
    emiByVehicle.set(String((plan as { vehicleId: unknown }).vehicleId), plan as Row);
  }

  // Project each vehicle into a row keyed by the selected field labels.
  const rows: Array<Record<string, string | number | null>> = vehicles.map((v) => {
    // Index this vehicle's active compliance docs by type for O(1) lookups.
    const byDocType = new Map<string, ComplianceRow>();
    for (const doc of v.complianceDocuments ?? []) {
      if (doc.type) byDocType.set(doc.type, doc);
    }
    const exportCtx: ExportContext = {
      vehicle: v,
      byDocType,
      emi: emiByVehicle.get(String(v._id)) ?? null,
    };
    const row: Record<string, string | number | null> = {};
    for (const f of selected) {
      const value = f.extract(exportCtx);
      row[f.label] = value ?? "";
    }
    return row;
  });

  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: selected.map((f) => f.label),
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Vehicles");

  const stamp = new Date().toISOString().slice(0, 10);
  if (input.format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return {
      buffer: Buffer.from(csv, "utf-8"),
      filename: `yellowtrack-vehicles-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }
  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return {
    buffer: buf,
    filename: `yellowtrack-vehicles-${stamp}.xlsx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
