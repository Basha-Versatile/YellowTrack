"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { vehicleAPI, vehicleGroupAPI, complianceAPI, fastagAPI, documentTypeAPI } from "@/lib/api";

// Three.js touches `window` on import — load client-only and skip SSR.
const TyreDiagram3D = dynamic(
  () => import("@/components/vehicles/TyreDiagram3D"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 flex items-center justify-center text-xs text-gray-400" style={{ height: 320 }}>
        Loading 3D viewer…
      </div>
    ),
  },
);
import { useToast } from "@/context/ToastContext";
import Badge from "@/components/ui/badge/Badge";
import { VehicleDetailSkeleton } from "@/components/ui/Skeleton";
import DatePicker from "@/components/ui/DatePicker";
import VehicleEmiPanel from "@/components/vehicles/VehicleEmiPanel";
import Link from "next/link";
import { AlertTriangle, Calendar, Car, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, Download, ExternalLink, FileText, ImageIcon, Pencil, Plus, Printer, RefreshCw, Share2, ShieldCheck, Trash2, Upload, User, Wrench, X } from "lucide-react";
import { GiCarWheel } from "react-icons/gi";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/modal";
import { pickValidatedFile, pickValidatedFiles } from "@/lib/file-validation";

interface ComplianceDoc {
  id: string;
  type: string;
  status: string;
  expiryDate: string | null;
  documentUrl: string | null;
  daysUntilExpiry: number | null;
}

interface Challan {
  id: string;
  amount: number;
  userCharges: number;
  status: string;
  issuedAt: string;
  source: string;
  location: string | null;
  unitName: string | null;
  psLimits: string | null;
  violation: string | null;
  challanNumber: string | null;
  authorizedBy: string | null;
  proofImageUrl: string | null;
  paidAt: string | null;
  comment: string | null;
}

interface ServicePart {
  name: string;
  quantity: number;
  unitCost: number;
  proofUrl: string | null;
}

interface ServiceRecord {
  id: string;
  title: string;
  description: string | null;
  serviceDate: string;
  odometerKm: number | null;
  totalCost: number;
  receiptUrls: string[];
  parts: ServicePart[];
  nextDueDate: string | null;
  nextDueKm: number | null;
  status: string;
}

interface Vehicle {
  id: string;
  registrationNumber: string;
  ownerName: string | null;
  make: string;
  model: string;
  fuelType: string;
  chassisNumber: string;
  engineNumber: string;
  gvw: number;
  seatingCapacity: number;
  permitType: string;
  vehicleUsage: "PRIVATE" | "COMMERCIAL" | null;
  qrCodeUrl: string | null;
  invoiceUrl: string | null;
  images: string[];
  profileImage: string | null;
  overallStatus: string;
  pendingChallanAmount: number;
  tyreCount?: number | null;
  group?: { id: string; name: string; icon: string; color?: string } | null;
  complianceDocuments: ComplianceDoc[];
  challans: Challan[];
  tyres: Array<{
    id: string;
    position: string;
    size: string | null;
    brand?: string | null;
  }>;
  serviceParts: Array<{
    id: string;
    name: string;
    partNumber: string | null;
    notes: string | null;
  }>;
  status?: "ACTIVE" | "SOLD";
  sale?: {
    id: string;
    buyerName: string;
    buyerPhone: string;
    buyerEmail: string | null;
    soldPrice: number | null;
    saleDate: string;
    pendingChallansCleared: boolean;
    buyerDocumentUrls: string[];
    transferDocumentUrls: string[];
    notes: string | null;
  } | null;
  activeDriver: { id: string; name: string; licenseNumber: string } | null;
  driverMappings: Array<{
    driver: { id: string; name: string; licenseNumber: string; licenseExpiry: string };
    assignedAt: string;
    unassignedAt: string | null;
    isActive: boolean;
  }>;
}

const STATUS_THEME: Record<string, { badge: "success" | "warning" | "error"; gradient: string; text: string; ring: string }> = {
  GREEN: { badge: "success", gradient: "from-emerald-500 to-green-600", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20" },
  YELLOW: { badge: "warning", gradient: "from-amber-500 to-amber-600", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
  ORANGE: { badge: "error", gradient: "from-red-500 to-rose-600", text: "text-red-600 dark:text-red-400 animate-blink", ring: "ring-red-500/30" },
  RED: { badge: "error", gradient: "from-red-500 to-rose-600", text: "text-red-600 dark:text-red-400", ring: "ring-red-500/20" },
};

const DOC_LABELS: Record<string, string> = {
  RC: "Registration Certificate",
  INSURANCE: "Insurance",
  PERMIT: "Permit",
  PUCC: "Pollution (PUC)",
  FITNESS: "Fitness Certificate",
  TAX: "Road Tax",
};

const DOC_ICONS: Record<string, string> = {
  RC: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  INSURANCE: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  PERMIT: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z",
  PUCC: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z",
  FITNESS: "M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z",
  TAX: "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z",
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

const TYRE_POSITIONS: Record<number, string[]> = {
  3: ["FL", "FR", "R"],
  4: ["FL", "FR", "RL", "RR"],
  6: ["FL", "FR", "RL_O", "RL_I", "RR_O", "RR_I"],
  10: ["FL", "FR", "ML_O", "ML_I", "MR_O", "MR_I", "RL_O", "RL_I", "RR_O", "RR_I"],
};

const TYRE_POSITION_LABELS: Record<string, string> = {
  FL: "Front Left", FR: "Front Right", R: "Rear", RL: "Rear Left", RR: "Rear Right",
  RL_O: "Rear Left Outer", RL_I: "Rear Left Inner", RR_O: "Rear Right Outer", RR_I: "Rear Right Inner",
  ML_O: "Mid Left Outer", ML_I: "Mid Left Inner", MR_O: "Mid Right Outer", MR_I: "Mid Right Inner",
  SPARE: "Spare",
};

const getTyrePositions = (tyreCount: number): string[] => {
  const base = TYRE_POSITIONS[tyreCount] || Array.from({ length: tyreCount }, (_, i) => `T${i + 1}`);
  return [...base, "SPARE"];
};

export default function VehicleDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [allGroups, setAllGroups] = useState<Array<{ id: string; name: string; icon: string; color?: string }>>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);

  // Tyre profile (size-only; one tyre selected at a time via the SVG diagram)
  const [editingTyres, setEditingTyres] = useState(false);
  const [editTyreCount, setEditTyreCount] = useState(4);
  const [tyreForm, setTyreForm] = useState<Array<{ position: string; size: string; brand: string }>>([]);
  const [selectedTyrePosition, setSelectedTyrePosition] = useState<string | null>(null);
  const [savingTyres, setSavingTyres] = useState(false);

  // Service parts profile
  const [editingParts, setEditingParts] = useState(false);
  const [partsForm, setPartsForm] = useState<Array<{ name: string; partNumber: string; notes: string }>>([]);
  const [savingParts, setSavingParts] = useState(false);

  const openPartsEditor = () => {
    if (!vehicle) return;
    const initial = vehicle.serviceParts && vehicle.serviceParts.length > 0
      ? vehicle.serviceParts.map((p) => ({ name: p.name, partNumber: p.partNumber || "", notes: p.notes || "" }))
      : [{ name: "", partNumber: "", notes: "" }];
    setPartsForm(initial);
    setEditingParts(true);
  };

  const handleSaveParts = async () => {
    if (!vehicle) return;
    const cleaned = partsForm
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        partNumber: p.partNumber.trim() || null,
        notes: p.notes.trim() || null,
      }));
    setSavingParts(true);
    try {
      await vehicleAPI.upsertServiceParts(vehicle.id, cleaned);
      toast.success("Parts Updated", "Service parts profile saved");
      setEditingParts(false);
      fetchVehicle();
    } catch {
      toast.error("Save Failed", "Could not save service parts");
    } finally {
      setSavingParts(false);
    }
  };

  // Regenerate position list when count changes inside the editor — preserves
  // sizes that were already entered for positions that still exist.
  const applyTyreCount = (newCount: number) => {
    const positions = getTyrePositions(newCount);
    setEditTyreCount(newCount);
    setTyreForm((prev) =>
      positions.map((pos) => {
        const existingForm = prev.find((t) => t.position === pos);
        if (existingForm) return existingForm;
        const existingDoc = vehicle?.tyres.find((t) => t.position === pos);
        return {
          position: pos,
          size: existingDoc?.size || "",
          brand: existingDoc?.brand || "",
        };
      }),
    );
    setSelectedTyrePosition((prev) =>
      prev && positions.includes(prev) ? prev : positions[0] ?? null,
    );
  };

  // Sell vehicle
  const [showSellModal, setShowSellModal] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [cancellingSale, setCancellingSale] = useState(false);
  const [confirmCancelSale, setConfirmCancelSale] = useState(false);
  const [saleForm, setSaleForm] = useState({
    buyerName: "", buyerPhone: "", buyerEmail: "", soldPrice: "",
    saleDate: todayISO(), pendingChallansCleared: false, notes: "",
  });
  const [saleBuyerDocs, setSaleBuyerDocs] = useState<File[]>([]);
  const [saleTransferDocs, setSaleTransferDocs] = useState<File[]>([]);

  const openSellModal = () => {
    const existing = vehicle?.sale;
    setSaleForm({
      buyerName: existing?.buyerName || "",
      buyerPhone: existing?.buyerPhone || "",
      buyerEmail: existing?.buyerEmail || "",
      soldPrice: existing?.soldPrice != null ? String(existing.soldPrice) : "",
      saleDate: existing?.saleDate ? existing.saleDate.split("T")[0] : todayISO(),
      pendingChallansCleared: existing?.pendingChallansCleared ?? false,
      notes: existing?.notes || "",
    });
    setSaleBuyerDocs([]);
    setSaleTransferDocs([]);
    setShowSellModal(true);
  };

  const handleSaveSale = async () => {
    if (!vehicle) return;
    if (!saleForm.buyerName.trim() || !saleForm.buyerPhone.trim() || !saleForm.saleDate) {
      toast.error("Missing fields", "Buyer name, phone and sale date are required");
      return;
    }
    setSavingSale(true);
    try {
      const fd = new FormData();
      fd.append("buyerName", saleForm.buyerName.trim());
      fd.append("buyerPhone", saleForm.buyerPhone.trim());
      if (saleForm.buyerEmail.trim()) fd.append("buyerEmail", saleForm.buyerEmail.trim());
      if (saleForm.soldPrice) fd.append("soldPrice", saleForm.soldPrice);
      fd.append("saleDate", saleForm.saleDate);
      fd.append("pendingChallansCleared", saleForm.pendingChallansCleared ? "true" : "false");
      if (saleForm.notes.trim()) fd.append("notes", saleForm.notes.trim());
      for (const f of saleBuyerDocs) fd.append("buyerDocs", f);
      for (const f of saleTransferDocs) fd.append("transferDocs", f);
      await vehicleAPI.markSold(vehicle.id, fd);
      toast.success(vehicle.status === "SOLD" ? "Sale Updated" : "Vehicle Sold", "Sale details saved");
      setShowSellModal(false);
      fetchVehicle();
    } catch {
      toast.error("Save Failed", "Could not save sale details");
    } finally {
      setSavingSale(false);
    }
  };

  const handleCancelSale = async () => {
    if (!vehicle) return;
    setCancellingSale(true);
    try {
      await vehicleAPI.cancelSale(vehicle.id);
      toast.success("Sale Cancelled", "Vehicle is active again");
      setConfirmCancelSale(false);
      fetchVehicle();
    } catch {
      toast.error("Cancel Failed", "Could not cancel sale");
    } finally {
      setCancellingSale(false);
    }
  };

  // Vehicle deletion (OTP-gated)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [requestingDeleteOtp, setRequestingDeleteOtp] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState<string | null>(null);
  const [deleteOtpInput, setDeleteOtpInput] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const openDeleteModal = async () => {
    if (!vehicle) return;
    setDeleteOtp(null);
    setDeleteOtpInput("");
    setShowDeleteModal(true);
    setRequestingDeleteOtp(true);
    try {
      const res = await vehicleAPI.requestDeletion(vehicle.id);
      setDeleteOtp(res.data.data.otp as string);
    } catch {
      toast.error("Failed", "Could not generate OTP. Try again.");
      setShowDeleteModal(false);
    } finally {
      setRequestingDeleteOtp(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!vehicle || !deleteOtpInput.trim()) return;
    setConfirmingDelete(true);
    try {
      await vehicleAPI.confirmDeletion(vehicle.id, deleteOtpInput.trim());
      toast.success("Vehicle Archived", `${vehicle.registrationNumber} hidden from active lists. Data preserved.`);
      // Navigate back to the vehicles list — full page nav so the page re-fetches.
      window.location.href = "/vehicles";
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error("Delete Failed", msg || "Could not delete the vehicle");
      setConfirmingDelete(false);
    }
  };

  // Service records
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [tyreReplacements, setTyreReplacements] = useState<Array<{ _id?: string; date: string; odometerKm: number; brand: string; ranKm: number | null }>>([]);
  const [tyreBrandPerformance, setTyreBrandPerformance] = useState<Array<{ brand: string; avgKm: number; replacements: number }>>([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [svcForm, setSvcForm] = useState({ title: "", description: "", serviceDate: "", odometerKm: "", totalCost: "", status: "COMPLETED" });
  const [svcReceipts, setSvcReceipts] = useState<File[]>([]);
  const [svcExistingReceipts, setSvcExistingReceipts] = useState<string[]>([]);
  const [svcRemovedReceipts, setSvcRemovedReceipts] = useState<string[]>([]);

  // FASTag
  const [fastagData, setFastagData] = useState<{ id: string; tagId: string; provider: string | null; balance: number; status: string; enrolledAt: string; expiryDate: string; transactions?: Array<{ id: string; type: string; amount: number; balance: number; description: string | null; createdAt: string }> } | null>(null);
  const [fastagRechargeAmt, setFastagRechargeAmt] = useState("");
  const [fastagRecharging, setFastagRecharging] = useState(false);
  const [editingExpiry, setEditingExpiry] = useState<string | null>(null);
  const [expiryValue, setExpiryValue] = useState("");
  const [savingExpiry, setSavingExpiry] = useState(false);

  // Challan detail + sync
  const [viewChallan, setViewChallan] = useState<Challan | null>(null);
  const [syncingChallans, setSyncingChallans] = useState(false);
  const handleSyncChallans = async () => {
    setSyncingChallans(true);
    try {
      await vehicleAPI.syncChallans(params.id as string);
      toast.success("Challans Synced", "Latest challan data fetched");
      fetchVehicle();
    } catch { toast.error("Sync Failed"); }
    finally { setSyncingChallans(false); }
  };

  // Renew
  const [renewingDoc, setRenewingDoc] = useState<string | null>(null);
  const [renewExpiry, setRenewExpiry] = useState("");
  const [renewFile, setRenewFile] = useState<File | null>(null);
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewLifetime, setRenewLifetime] = useState(false);
  const [editLifetime, setEditLifetime] = useState(false);

  // Public access log (who viewed/downloaded vehicle docs)
  type AccessLogEntry = {
    id: string;
    createdAt: string;
    target: string;
    action: "VIEW" | "DOWNLOAD";
    documentUrl: string | null;
    accessorName: string | null;
    accessorPhone: string | null;
    ip: string | null;
    userAgent: string | null;
  };
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [accessLogLoading, setAccessLogLoading] = useState(false);

  // Add new compliance document
  const [addingCompliance, setAddingCompliance] = useState(false);
  const [addType, setAddType] = useState<string>("RC");
  const [addCustomLabel, setAddCustomLabel] = useState("");
  const [addExpiry, setAddExpiry] = useState("");
  const [addLifetime, setAddLifetime] = useState(false);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addingLoading, setAddingLoading] = useState(false);
  const [deletingCompliance, setDeletingCompliance] = useState<string | null>(null);

  // Document type masters — populates the Add Document dropdown and label
  // lookups for non-built-in trackers. Falls back to DOC_LABELS for codes the
  // API doesn't return (defensive — handles network errors gracefully).
  const [docTypeMasters, setDocTypeMasters] = useState<Array<{ code: string; name: string; hasExpiry: boolean }>>([]);
  const docTypeLabel = (code: string) => {
    const fromApi = docTypeMasters.find((d) => d.code === code)?.name;
    return fromApi ?? DOC_LABELS[code] ?? code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const docTypeHasExpiry = (code: string) => {
    const t = docTypeMasters.find((d) => d.code === code);
    return t ? t.hasExpiry : true;
  };

  // Per-doc history modal
  const [historyDocType, setHistoryDocType] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Array<{ id: string; expiryDate: string | null; documentUrl: string | null; isActive: boolean; createdAt: string; archivedAt: string | null }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openDocHistory = async (vehicleId: string, docType: string) => {
    setHistoryDocType(docType);
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      const res = await complianceAPI.getHistory(vehicleId, docType);
      setHistoryData(res.data.data || []);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchVehicle = () => {
    if (params.id) {
      vehicleAPI.getById(params.id as string)
        .then((res) => {
          setVehicle(res.data.data);
          // Deep-link from list page: open sell modal automatically once
          if (searchParams.get("action") === "sell" && res.data.data.status !== "SOLD" && !showSellModal) {
            const existing = res.data.data.sale;
            setSaleForm({
              buyerName: existing?.buyerName || "",
              buyerPhone: existing?.buyerPhone || "",
              buyerEmail: existing?.buyerEmail || "",
              soldPrice: existing?.soldPrice != null ? String(existing.soldPrice) : "",
              saleDate: existing?.saleDate ? existing.saleDate.split("T")[0] : todayISO(),
              pendingChallansCleared: existing?.pendingChallansCleared ?? false,
              notes: existing?.notes || "",
            });
            setSaleBuyerDocs([]);
            setSaleTransferDocs([]);
            setShowSellModal(true);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
      vehicleAPI.getServices(params.id as string)
        .then((res) => setServices(res.data.data))
        .catch(() => {});
      vehicleAPI.getTyreReplacements(params.id as string)
        .then((res) => {
          setTyreReplacements(res.data.data.records ?? []);
          setTyreBrandPerformance(res.data.data.brandPerformance ?? []);
        })
        .catch(() => {});
      documentTypeAPI.getAll()
        .then((res) => {
          const list = (res.data.data ?? []) as Array<{ code: string; name: string; hasExpiry: boolean; isActive: boolean }>;
          setDocTypeMasters(list.filter((d) => d.isActive));
        })
        .catch(() => {});
    }
  };

  const fetchAccessLog = () => {
    if (!params.id) return;
    setAccessLogLoading(true);
    vehicleAPI.getAccessLog(params.id as string)
      .then((res) => setAccessLog(res.data.data || []))
      .catch(() => setAccessLog([]))
      .finally(() => setAccessLogLoading(false));
  };

  useEffect(() => { fetchAccessLog(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);

  const openEditService = (svc: ServiceRecord) => {
    setEditingService(svc);
    setSvcForm({
      title: svc.title, description: svc.description || "", serviceDate: svc.serviceDate.split("T")[0],
      odometerKm: svc.odometerKm?.toString() || "", totalCost: svc.totalCost.toString(),
      status: svc.status,
    });
    setSvcReceipts([]);
    setSvcExistingReceipts(svc.receiptUrls || []);
    setSvcRemovedReceipts([]);
    setShowServiceModal(true);
  };

  const handleSaveService = async () => {
    if (!svcForm.title || !svcForm.serviceDate) return;
    setSavingService(true);
    try {
      const formData = new FormData();
      formData.append("title", svcForm.title);
      if (svcForm.description) formData.append("description", svcForm.description);
      formData.append("serviceDate", svcForm.serviceDate);
      if (svcForm.odometerKm) formData.append("odometerKm", svcForm.odometerKm);
      formData.append("totalCost", svcForm.totalCost || "0");
      formData.append("status", svcForm.status);
      svcReceipts.forEach((f) => formData.append("receipts", f));
      if (svcRemovedReceipts.length > 0) formData.append("removedReceipts", JSON.stringify(svcRemovedReceipts));

      if (editingService) {
        await vehicleAPI.updateService(vehicle!.id, editingService.id, formData);
        toast.success("Service Updated", "Service record updated");
      } else {
        await vehicleAPI.createService(vehicle!.id, formData);
        toast.success("Service Added", "Service record created");
      }
      setShowServiceModal(false);
      fetchVehicle();
    } catch { toast.error("Error", "Failed to save service record"); }
    finally { setSavingService(false); }
  };


  const handleExpiryUpdate = async (docId: string, docType: string) => {
    if (!editLifetime && !expiryValue) return;
    setSavingExpiry(true);
    try {
      await complianceAPI.updateExpiry(docId, { type: docType, expiryDate: editLifetime ? undefined : expiryValue, lifetime: editLifetime });
      setEditingExpiry(null);
      setExpiryValue("");
      setEditLifetime(false);
      toast.success("Expiry Updated", editLifetime ? "Document set to lifetime validity" : "Document expiry date has been updated");
      fetchVehicle();
    } catch (err) { console.error(err); }
    finally { setSavingExpiry(false); }
  };

  const openAddCompliance = () => {
    // Pick the first standard type that doesn't already exist on the vehicle
    const usedTypes = new Set((vehicle?.complianceDocuments || []).map((d) => d.type));
    const firstAvailable = (Object.keys(DOC_LABELS) as string[]).find((t) => !usedTypes.has(t));
    setAddType(firstAvailable ?? "OTHER");
    setAddCustomLabel("");
    setAddExpiry(todayISO());
    setAddLifetime(false);
    setAddFile(null);
    setAddingCompliance(true);
  };

  const handleAddCompliance = async () => {
    if (!vehicle) return;
    const finalType = addType === "OTHER" ? addCustomLabel.trim() : addType;
    if (!finalType) { toast.error("Type required", "Please enter a document name"); return; }
    if (!addLifetime && !addExpiry && !addFile) {
      toast.error("Nothing to save", "Provide at least an expiry date, lifetime flag, or file");
      return;
    }
    setAddingLoading(true);
    try {
      await complianceAPI.createDocument(
        vehicle.id,
        { type: finalType, expiryDate: addLifetime ? undefined : addExpiry, lifetime: addLifetime },
        addFile || undefined,
      );
      toast.success("Document Added", `${finalType.replace(/_/g, " ")} added`);
      setAddingCompliance(false);
      fetchVehicle();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error("Add Failed", e.response?.data?.message || "Could not add document");
    } finally {
      setAddingLoading(false);
    }
  };

  const handleDeleteCompliance = async (docId: string) => {
    setDeletingCompliance(docId);
    try {
      await complianceAPI.removeDocument(docId);
      toast.success("Document Removed", "The compliance document has been deleted");
      fetchVehicle();
    } catch {
      toast.error("Delete Failed", "Could not remove document");
    } finally {
      setDeletingCompliance(null);
    }
  };

  const handleRenew = async (docId: string, docType: string) => {
    if (!renewLifetime && !renewExpiry) return;
    setRenewLoading(true);
    try {
      await complianceAPI.renewDocument(docId, { expiryDate: renewLifetime ? undefined : renewExpiry, type: docType, lifetime: renewLifetime }, renewFile || undefined);
      setRenewingDoc(null); setRenewExpiry(""); setRenewFile(null); setRenewLifetime(false);
      toast.success("Document Renewed", "Old document archived, new one created");
      fetchVehicle();
    } catch (err) { console.error(err); toast.error("Renew Failed", "Could not renew document"); }
    finally { setRenewLoading(false); }
  };

  const openTyreEditor = () => {
    if (!vehicle) return;
    const tyreCount = vehicle.tyreCount || 4;
    const positions = getTyrePositions(tyreCount);
    setEditTyreCount(tyreCount);
    setTyreForm(
      positions.map((pos) => {
        const existing = vehicle.tyres.find((t) => t.position === pos);
        return {
          position: pos,
          size: existing?.size || "",
          brand: existing?.brand || "",
        };
      }),
    );
    setSelectedTyrePosition(positions[0] ?? null);
    setEditingTyres(true);
  };

  const handleSaveTyres = async () => {
    if (!vehicle) return;
    setSavingTyres(true);
    try {
      const tyresData = tyreForm
        .filter((t) => t.size.trim() || t.brand.trim())
        .map((t) => ({
          position: t.position,
          size: t.size.trim(),
          brand: t.brand.trim() || null,
        }));
      await vehicleAPI.upsertTyres(vehicle.id, tyresData, editTyreCount);
      const res = await vehicleAPI.getById(vehicle.id);
      setVehicle(res.data.data);
      setEditingTyres(false);
      toast.success("Tyres Updated", "Saved");
    } catch {
      toast.error("Error", "Failed");
    } finally {
      setSavingTyres(false);
    }
  };

  const handleDeleteImage = (imageUrl: string) => {
    setImageToDelete(imageUrl);
  };

  const handleShareImage = async (imageUrl: string, idx: number) => {
    const url = resolveImageUrl(imageUrl);
    if (!url) {
      toast.error("Share Failed", "Image URL could not be resolved");
      return;
    }
    const absoluteUrl = url.startsWith("http")
      ? url
      : `${window.location.origin}${url}`;
    const title = `${vehicle?.registrationNumber ?? "Vehicle"} — photo ${idx + 1}`;

    // 1) Try Web Share API (mobile + most modern browsers)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: absoluteUrl });
        return;
      } catch (err) {
        // AbortError = user cancelled — silent. Anything else falls through to clipboard.
        const name = (err as { name?: string })?.name;
        if (name === "AbortError") return;
      }
    }

    // 2) Fallback: copy link to clipboard
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        toast.success("Link Copied", "Image URL copied to clipboard");
      } else {
        window.prompt("Copy this image link:", absoluteUrl);
      }
    } catch {
      toast.error("Share Failed", "Could not copy the image link");
    }
  };

  const handleConfirmDeleteImage = async () => {
    if (!params.id || !imageToDelete) return;
    setDeletingImage(true);
    try {
      await vehicleAPI.deleteImage(params.id as string, imageToDelete);
      toast.success("Photo Deleted");
      setImageToDelete(null);
      fetchVehicle();
    } catch (err) {
      console.error(err);
      toast.error("Delete Failed");
    } finally {
      setDeletingImage(false);
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !params.id) return;
    setUploadingImages(true);
    try {
      await vehicleAPI.uploadImages(params.id as string, Array.from(files));
      toast.success("Photos Uploaded", `${files.length} photo${files.length > 1 ? "s" : ""} added`);
      fetchVehicle();
    } catch (err) { console.error(err); toast.error("Upload Failed"); }
    finally { setUploadingImages(false); }
  };

  useEffect(() => {
    fetchVehicle();
    vehicleGroupAPI.getAll().then((res) => setAllGroups(res.data.data)).catch(() => {});
    if (params.id) fastagAPI.getByVehicle(params.id as string).then((res) => setFastagData(res.data.data)).catch(() => setFastagData(null));
  }, [params.id]);

  const handleGroupChange = async (groupId: string | null) => {
    if (!vehicle) return;
    setSavingGroup(true);
    try {
      await vehicleAPI.updateGroup(vehicle.id, groupId);
      fetchVehicle();
      setShowGroupPicker(false);
      toast.success("Group Updated", groupId ? "Vehicle group changed" : "Vehicle removed from group");
    } catch { toast.error("Failed", "Could not update group"); }
    finally { setSavingGroup(false); }
  };

  if (loading) return <VehicleDetailSkeleton />;

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
        </div>
        <p className="text-gray-500">Vehicle not found</p>
        <Link href="/vehicles" className="text-brand-500 hover:underline text-sm">Back to vehicles</Link>
      </div>
    );
  }

  const theme = STATUS_THEME[vehicle.overallStatus] || STATUS_THEME.GREEN;
  const pendingChallans = vehicle.challans.filter((c) => c.status === "PENDING");
  const paidChallans = vehicle.challans.filter((c) => c.status === "PAID");
  const greenDocs = vehicle.complianceDocuments.filter((d) => d.status === "GREEN").length;
  const totalDocs = vehicle.complianceDocuments.length;
  const complianceScore = totalDocs > 0 ? Math.round((greenDocs / totalDocs) * 100) : 0;
  const qrSrc = `${process.env.NEXT_PUBLIC_API_URL}/vehicles/${vehicle.id}/qr.png`;

  return (
    <div className="space-y-6">
      {/* ── HERO HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className={`bg-gradient-to-r ${theme.gradient} p-6 sm:p-8`}>
          {/* Decorative */}
          <div className="absolute top-4 right-8 w-24 h-24 rounded-full border border-white/10" />
          <div className="absolute bottom-4 right-20 w-16 h-16 rounded-full border border-white/5" />
          <div className="absolute top-1/2 right-4 w-2 h-2 rounded-full bg-white/20" />

          <div className="relative z-10">
            <Link
              href="/vehicles"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              Back to vehicles
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Profile Image */}
                {vehicle.profileImage ? (
                  <img src={`${resolveImageUrl(vehicle.profileImage) ?? ""}`} alt={vehicle.registrationNumber}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white/20 shadow-2xl flex-shrink-0 cursor-pointer hover:ring-white/40 transition-all"
                    onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: `${resolveImageUrl(vehicle.profileImage) ?? ""}`, x: r.right + 16, y: r.top + r.height / 2 }); }}
                    onMouseLeave={() => setHoverPhoto(null)} onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/15 backdrop-blur-sm ring-4 ring-white/10 flex items-center justify-center flex-shrink-0">
                    <Car className="w-10 h-10 text-white/60" strokeWidth={1.5} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-wider font-mono">
                      {vehicle.registrationNumber}
                    </h1>
                    <span className="px-3 py-1 rounded-lg bg-white/20 text-white text-xs font-bold backdrop-blur-sm">
                      {vehicle.overallStatus}
                    </span>
                  </div>
                  {vehicle.ownerName && (
                    <p className="text-white text-lg sm:text-xl font-extrabold tracking-tight leading-tight mt-1">
                      {titleCase(vehicle.ownerName)}
                    </p>
                  )}
                  <p className="text-white/50 text-[11px] uppercase tracking-wider font-semibold mt-1">
                    {titleCase(vehicle.make)}
                  </p>
                  <p className="text-white/85 text-sm flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="font-semibold">{titleCase(vehicle.model)}</span>
                    <span className="text-white/40">&bull;</span>
                    <span>{titleCase(vehicle.fuelType)}</span>
                    <span className="text-white/40">&bull;</span>
                    <span>{vehicle.permitType}</span>
                    {vehicle.vehicleUsage && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold backdrop-blur-sm ${vehicle.vehicleUsage === "COMMERCIAL" ? "bg-amber-400/30 text-amber-50" : "bg-emerald-400/30 text-emerald-50"}`}>
                        {vehicle.vehicleUsage === "COMMERCIAL" ? "Commercial" : "Private"}
                      </span>
                    )}
                    {vehicle.group && (() => { const GIcon = getVehicleTypeIcon(vehicle.group.icon); return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 text-white text-xs font-semibold backdrop-blur-sm">
                        <GIcon className="w-3.5 h-3.5" />
                        {vehicle.group.name}
                      </span>
                    ); })()}
                  </p>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex gap-4 items-stretch">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-bold text-white">{complianceScore}%</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Compliance</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-bold text-white">&#8377;{vehicle.pendingChallanAmount.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Pending</p>
                </div>
                {vehicle.status !== "SOLD" && (
                  <button
                    type="button"
                    onClick={openSellModal}
                    className="bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl px-4 py-3 text-white text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Sell Vehicle
                  </button>
                )}
                <button
                  type="button"
                  onClick={openDeleteModal}
                  className="bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm rounded-xl px-4 py-3 text-white text-sm font-semibold transition-colors flex items-center gap-2"
                  title="Delete vehicle (requires OTP)"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sold banner */}
      {vehicle.status === "SOLD" && vehicle.sale && (
        <div className="rounded-2xl border-2 border-gray-900/10 dark:border-gray-100/10 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-100 dark:to-gray-200 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-gray-900 dark:bg-gray-900 dark:text-white">Sold</span>
                <p className="text-white dark:text-gray-900 text-sm font-semibold">
                  Sold on {new Date(vehicle.sale.saleDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-white/50 dark:text-gray-500 uppercase tracking-wider font-semibold text-[9px]">Buyer</p>
                  <p className="text-white dark:text-gray-900 font-semibold mt-0.5 truncate">{vehicle.sale.buyerName}</p>
                </div>
                <div>
                  <p className="text-white/50 dark:text-gray-500 uppercase tracking-wider font-semibold text-[9px]">Phone</p>
                  <p className="text-white dark:text-gray-900 font-semibold mt-0.5 truncate">+91 {vehicle.sale.buyerPhone}</p>
                </div>
                {vehicle.sale.buyerEmail && (
                  <div>
                    <p className="text-white/50 dark:text-gray-500 uppercase tracking-wider font-semibold text-[9px]">Email</p>
                    <p className="text-white dark:text-gray-900 font-semibold mt-0.5 truncate">{vehicle.sale.buyerEmail}</p>
                  </div>
                )}
                {vehicle.sale.soldPrice != null && (
                  <div>
                    <p className="text-white/50 dark:text-gray-500 uppercase tracking-wider font-semibold text-[9px]">Sold Price</p>
                    <p className="text-white dark:text-gray-900 font-semibold mt-0.5 truncate">&#8377;{vehicle.sale.soldPrice.toLocaleString("en-IN")}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${vehicle.sale.pendingChallansCleared ? "bg-emerald-500/30 text-emerald-50 dark:bg-emerald-500/20 dark:text-emerald-700" : "bg-amber-500/30 text-amber-50 dark:bg-amber-500/20 dark:text-amber-700"}`}>
                  {vehicle.sale.pendingChallansCleared ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {vehicle.sale.pendingChallansCleared ? "Challans Cleared" : "Challans Pending"}
                </span>
                {vehicle.sale.buyerDocumentUrls.length > 0 && (
                  <span className="text-[10px] text-white/70 dark:text-gray-600 font-medium">{vehicle.sale.buyerDocumentUrls.length} buyer doc{vehicle.sale.buyerDocumentUrls.length !== 1 ? "s" : ""}</span>
                )}
                {vehicle.sale.transferDocumentUrls.length > 0 && (
                  <span className="text-[10px] text-white/70 dark:text-gray-600 font-medium">{vehicle.sale.transferDocumentUrls.length} transfer doc{vehicle.sale.transferDocumentUrls.length !== 1 ? "s" : ""}</span>
                )}
              </div>
              {(vehicle.sale.buyerDocumentUrls.length > 0 || vehicle.sale.transferDocumentUrls.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {vehicle.sale.buyerDocumentUrls.map((u, i) => (
                    <a key={`b-${i}`} href={resolveImageUrl(u) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/15 hover:bg-white/25 dark:bg-gray-900/10 dark:hover:bg-gray-900/20 text-[10px] font-semibold text-white dark:text-gray-900 transition-colors">
                      <FileText className="w-3 h-3" /> Buyer #{i + 1}
                    </a>
                  ))}
                  {vehicle.sale.transferDocumentUrls.map((u, i) => (
                    <a key={`t-${i}`} href={resolveImageUrl(u) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/15 hover:bg-white/25 dark:bg-gray-900/10 dark:hover:bg-gray-900/20 text-[10px] font-semibold text-white dark:text-gray-900 transition-colors">
                      <FileText className="w-3 h-3" /> Transfer #{i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <button type="button" onClick={openSellModal} className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 dark:bg-gray-900/10 dark:hover:bg-gray-900/20 text-white dark:text-gray-900 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Edit Sale
              </button>
              <button type="button" onClick={() => setConfirmCancelSale(true)} className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white dark:text-red-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <X className="w-3.5 h-3.5" /> Cancel Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COL */}
        <div className="xl:col-span-2 space-y-6">
          {/* Vehicle Specs */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Car className="w-4 h-4 text-brand-500" strokeWidth={2} />
              Vehicle Specs
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Group tile with edit */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 relative">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Group</p>
                  <button onClick={() => setShowGroupPicker(!showGroupPicker)}
                    className="text-brand-500 hover:text-brand-600 transition-colors" title="Change group">
                    <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
                {vehicle.group ? (() => { const GIcon = getVehicleTypeIcon(vehicle.group.icon); return (
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1 flex items-center gap-1.5">
                    <GIcon className="w-4 h-4" style={vehicle.group.color ? { color: vehicle.group.color } : undefined} />
                    {vehicle.group.name}
                  </p>
                ); })() : (
                  <p className="text-sm text-gray-400 mt-1">No group</p>
                )}

                {/* Group picker dropdown */}
                {showGroupPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-2 min-w-[200px]">
                    <button onClick={() => handleGroupChange(null)} disabled={savingGroup}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!vehicle.group ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10" : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}>
                      <X className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                      No Group
                    </button>
                    {allGroups.map((g) => { const GIcon = getVehicleTypeIcon(g.icon); return (
                      <button key={g.id} onClick={() => handleGroupChange(g.id)} disabled={savingGroup}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${vehicle.group?.id === g.id ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10" : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}>
                        <GIcon className="w-4 h-4" style={g.color ? { color: g.color } : undefined} />
                        {g.name}
                        {vehicle.group?.id === g.id && <Check className="w-3 h-3 ml-auto text-brand-500" strokeWidth={3} />}
                      </button>
                    ); })}
                  </div>
                )}
              </div>
              {[
                { label: "Owner", value: vehicle.ownerName || "—" },
                { label: "Chassis No.", value: vehicle.chassisNumber || "—" },
                { label: "Engine No.", value: vehicle.engineNumber || "—" },
                { label: "GVW", value: vehicle.gvw ? `${vehicle.gvw} kg` : "—" },
                { label: "Seating", value: vehicle.seatingCapacity?.toString() || "—" },
                { label: "Fuel Type", value: vehicle.fuelType },
                { label: "Permit", value: vehicle.permitType || "—" },
                { label: "Usage", value: vehicle.vehicleUsage === "COMMERCIAL" ? "Commercial" : vehicle.vehicleUsage === "PRIVATE" ? "Private" : "—" },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1 truncate">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle Images */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-brand-500" strokeWidth={2} />
                Vehicle Photos {vehicle.images?.length ? `(${vehicle.images.length})` : ""}
              </h3>
              <label className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${uploadingImages ? "bg-gray-100 text-gray-400" : "bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"}`}>
                {uploadingImages ? (
                  <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Uploading...</>
                ) : (
                  <><Plus className="w-3 h-3" strokeWidth={2} />Add Photos</>
                )}
                <input type="file" accept=".jpg,.jpeg,.png" multiple className="hidden" disabled={uploadingImages} onChange={(e) => { const fs = pickValidatedFiles(e.target, (t, m) => toast.error(t, m)); if (fs.length) { const dt = new DataTransfer(); fs.forEach((f) => dt.items.add(f)); handleImageUpload(dt.files); } }} />
              </label>
            </div>

            {vehicle.images && vehicle.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {vehicle.images.map((img, i) => {
                  const isProfile = vehicle.profileImage === img;
                  return (
                    <div key={i} className={`group relative aspect-video rounded-xl overflow-hidden border-2 transition-colors ${isProfile ? "border-yellow-400 ring-2 ring-yellow-400/30" : "border-gray-200 dark:border-gray-700 hover:border-brand-400"}`}>
                      <a href={(resolveImageUrl(img) ?? "")} target="_blank" rel="noopener noreferrer">
                        <img src={(resolveImageUrl(img) ?? "")} alt={`Vehicle photo ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </a>
                      {isProfile && (
                        <span className="absolute top-2 left-2 text-[9px] font-bold bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-md shadow-md">PROFILE</span>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />
                      {!isProfile && (
                        <button
                          onClick={async () => {
                            try {
                              await vehicleAPI.setProfileImage(vehicle.id, img);
                              toast.success("Profile Image Set", "Vehicle profile photo updated");
                              fetchVehicle();
                            } catch { toast.error("Failed to set profile image"); }
                          }}
                          className="absolute top-2 left-2 h-7 rounded-lg bg-yellow-400/90 hover:bg-yellow-400 text-gray-900 flex items-center gap-1 px-2 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                          title="Set as profile image"
                        >
                          <User className="w-3 h-3" strokeWidth={2} />
                          Profile
                        </button>
                      )}
                      <button onClick={() => handleDeleteImage(img)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg" title="Delete photo">
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                        <a
                          href={(resolveImageUrl(img) ?? "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-white/80 hover:bg-white text-gray-700 flex items-center justify-center shadow-lg"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleShareImage(img, i)}
                          className="w-7 h-7 rounded-lg bg-white/80 hover:bg-white text-gray-700 flex items-center justify-center shadow-lg"
                          title="Share photo"
                        >
                          <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500/50 cursor-pointer transition-colors group">
                <ImageIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 group-hover:text-yellow-500 transition-colors" strokeWidth={1.5} />
                <span className="text-sm text-gray-400 group-hover:text-yellow-600 font-medium mt-2">Click to upload vehicle photos</span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">JPG, PNG — up to 10 photos</span>
                <input type="file" accept=".jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const fs = pickValidatedFiles(e.target, (t, m) => toast.error(t, m)); if (fs.length) { const dt = new DataTransfer(); fs.forEach((f) => dt.items.add(f)); handleImageUpload(dt.files); } }} />
              </label>
            )}
          </div>

          {/* Compliance Documents */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-500" strokeWidth={2} />
                Compliance {totalDocs > 0 && <span className="text-gray-400 normal-case font-medium">({greenDocs}/{totalDocs} valid)</span>}
              </h3>
              <div className="flex items-center gap-3">
                {totalDocs > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient}`} style={{ width: `${complianceScore}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${theme.text}`}>{complianceScore}%</span>
                  </div>
                )}
                <button onClick={openAddCompliance}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Document
                </button>
              </div>
            </div>

            {vehicle.complianceDocuments.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
                <ShieldCheck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No compliance documents yet</p>
                <p className="text-xs text-gray-400 mt-1">Click <span className="font-semibold">Add Document</span> to upload RC, insurance, fitness, or any custom document.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vehicle.complianceDocuments.map((doc) => {
                const dt = STATUS_THEME[doc.status] || STATUS_THEME.GREEN;
                const icon = DOC_ICONS[doc.type] || DOC_ICONS.RC;
                return (
                  <div
                    key={doc.id}
                    className={`relative p-4 rounded-xl border transition-all hover:shadow-md ${
                      doc.status === "GREEN"
                        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                        : doc.status === "YELLOW"
                        ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5"
                        : doc.status === "ORANGE"
                        ? "border-red-300 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/[0.07]"
                        : "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5"
                    }`}
                  >
                    {/* Status indicator line */}
                    <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b ${dt.gradient}`} />

                    <div className="flex items-start justify-between ml-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          doc.status === "GREEN" ? "bg-emerald-100 dark:bg-emerald-500/20" : doc.status === "YELLOW" ? "bg-amber-100 dark:bg-amber-500/20" : doc.status === "ORANGE" ? "bg-red-100 dark:bg-red-500/20 animate-blink" : "bg-red-100 dark:bg-red-500/20"
                        }`}>
                          <svg className={`w-4 h-4 ${dt.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{docTypeLabel(doc.type)}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                            {doc.expiryDate
                              ? <>Exp: {new Date(doc.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
                              : <span className="text-emerald-600 dark:text-emerald-400 font-medium">Lifetime</span>}
                            <button
                              onClick={() => { setEditingExpiry(doc.id); setEditLifetime(!doc.expiryDate); setExpiryValue(doc.expiryDate ? new Date(doc.expiryDate).toISOString().split("T")[0] : todayISO()); }}
                              className="text-brand-500 hover:text-brand-600 transition-colors"
                              title="Edit expiry date"
                            >
                              <Pencil className="w-3 h-3" strokeWidth={2} />
                            </button>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge color={dt.badge} variant="light" size="sm">
                          {doc.status === "GREEN" ? "Valid" : doc.status === "YELLOW" ? "Expiring" : doc.status === "ORANGE" ? "Critical" : "Expired"}
                        </Badge>
                        <p className={`text-xs font-bold mt-1 ${dt.text}`}>
                          {doc.daysUntilExpiry === null
                            ? "No expiry"
                            : doc.daysUntilExpiry <= 0
                            ? `${Math.abs(doc.daysUntilExpiry)}d overdue`
                            : `${doc.daysUntilExpiry}d left`}
                        </p>
                      </div>
                    </div>
                    {/* Document file + actions */}
                    <div className="mt-3 ml-2 flex items-center gap-2 flex-wrap">
                      {doc.documentUrl && (
                        <a href={(resolveImageUrl(doc.documentUrl) ?? "")} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 transition-colors">
                          <ExternalLink className="w-3 h-3" strokeWidth={2} />
                          View File
                        </a>
                      )}
                      {doc.documentUrl ? (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <button onClick={() => { setRenewingDoc(renewingDoc === doc.id ? null : doc.id); setRenewExpiry(todayISO()); setRenewFile(null); }}
                            className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 transition-colors">
                            <RefreshCw className="w-3 h-3" strokeWidth={2} />
                            Renew
                          </button>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <button onClick={() => openDocHistory(vehicle.id, doc.type)}
                            className="text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:text-brand-500 flex items-center gap-1 transition-colors">
                            <Clock className="w-3 h-3" strokeWidth={2} />
                            History
                          </button>
                        </>
                      ) : (
                        <label className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 cursor-pointer transition-colors">
                          <Upload className="w-3 h-3" strokeWidth={2} />
                          Upload Document
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => {
                            const f = pickValidatedFile(e.target, (t, m) => toast.error(t, m));
                            if (f) {
                              complianceAPI.uploadDocument(doc.id, f).then(() => fetchVehicle()).catch(console.error);
                            }
                          }} />
                        </label>
                      )}
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button onClick={() => { if (confirm(`Remove this ${docTypeLabel(doc.type)} document? This cannot be undone.`)) handleDeleteCompliance(doc.id); }}
                        disabled={deletingCompliance === doc.id}
                        className="text-[11px] font-medium text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors disabled:opacity-50">
                        <Trash2 className="w-3 h-3" strokeWidth={2} />
                        {deletingCompliance === doc.id ? "Removing…" : "Delete"}
                      </button>
                    </div>


                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Public Access Log */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" strokeWidth={2} />
                Public Access Log
                {accessLog.length > 0 && <span className="text-gray-400 normal-case font-medium">({accessLog.length})</span>}
              </h3>
              <button onClick={fetchAccessLog} disabled={accessLogLoading}
                className="text-[11px] font-semibold text-brand-500 hover:text-brand-600 disabled:opacity-50">
                {accessLogLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {accessLogLoading && accessLog.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
            ) : accessLog.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No public accesses yet</p>
                <p className="text-xs text-gray-400 mt-1">Anyone who scans the QR and views or downloads a document will appear here.</p>
              </div>
            ) : (
              <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-3 max-h-96 overflow-y-auto pr-1">
                {accessLog.map((entry) => (
                  <li key={entry.id} className="ml-5">
                    <span className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full mt-1.5 ${entry.action === "DOWNLOAD" ? "bg-emerald-400 ring-2 ring-emerald-100 dark:ring-emerald-500/30" : "bg-blue-400 ring-2 ring-blue-100 dark:ring-blue-500/30"}`} />
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${entry.action === "DOWNLOAD" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"}`}>
                            {entry.action === "DOWNLOAD" ? "Downloaded" : "Viewed"}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                            {docTypeLabel(entry.target)}
                          </span>
                        </div>
                        <time className="text-[10px] text-gray-400 whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </time>
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">{entry.accessorName ?? "Anonymous"}</span>
                        {entry.accessorPhone && <> · {entry.accessorPhone}</>}
                        {entry.ip && <span className="text-gray-400"> · IP {entry.ip}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Challans */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-brand-500" strokeWidth={2} />
                Challans ({vehicle.challans.length})
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-red-600 dark:text-red-400 font-semibold">{pendingChallans.length} Pending</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{paidChallans.length} Paid</span>
                <button onClick={handleSyncChallans} disabled={syncingChallans}
                  className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 p-1.5 text-gray-500 transition-colors disabled:opacity-50" title="Re-sync challans">
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingChallans ? "animate-spin" : ""}`} strokeWidth={2} />
                </button>
              </div>
            </div>

            {vehicle.challans.length === 0 ? (
              <div className="p-8 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-center">
                <p className="text-sm text-gray-500">No challans found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vehicle.challans.map((c) => {
                  const isPaid = c.status === "PAID";
                  return (
                    <div key={c.id} onClick={() => setViewChallan(c)} className={`rounded-xl border transition-all cursor-pointer hover:shadow-md ${isPaid ? "border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30 hover:border-gray-200" : "border-red-100 bg-red-50/30 dark:border-red-500/10 dark:bg-red-500/5 hover:border-red-200"}`}>
                      <div className="flex items-start gap-3 p-4">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isPaid ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-red-100 dark:bg-red-500/20"}`}>
                          {isPaid ? <Check className={`w-4 h-4 text-emerald-600 dark:text-emerald-400`} strokeWidth={2} /> : <Clock className={`w-4 h-4 text-red-600 dark:text-red-400`} strokeWidth={2} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-bold ${isPaid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>&#8377;{c.amount.toLocaleString("en-IN")}</p>
                              <Badge color={isPaid ? "success" : "error"} variant="light" size="sm">{c.status}</Badge>
                              {c.challanNumber && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 font-mono">{c.challanNumber}</span>}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(c.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {c.source && <> &bull; {c.source}</>}
                            {c.location && <> &bull; {c.location}</>}
                          </p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {c.authorizedBy && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-0.5">
                                <User className="w-3 h-3" strokeWidth={2} />
                                {c.authorizedBy}
                              </span>
                            )}
                            {c.comment && <span className="text-[10px] text-gray-400">{c.comment}</span>}
                            {c.proofImageUrl && (
                              <a href={c.proofImageUrl.startsWith("http") ? c.proofImageUrl : (resolveImageUrl(c.proofImageUrl) ?? "")} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-yellow-600 dark:text-yellow-400 flex items-center gap-0.5 font-semibold">
                                <ImageIcon className="w-3 h-3" strokeWidth={2} />
                                View Proof
                              </a>
                            )}
                            {c.paidAt && <span className="text-[10px] text-emerald-500 font-medium">Paid {new Date(c.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* EMI Tracker */}
          <VehicleEmiPanel
            vehicleId={vehicle.id}
            vehicleRegistration={vehicle.registrationNumber}
            vehicleMake={vehicle.make}
            vehicleModel={vehicle.model}
          />
        </div>

        {/* RIGHT COL */}
        <div className="space-y-6">
          {/* FASTag Card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-yellow-500" strokeWidth={2} />
              FASTag
            </h3>
            {fastagData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-mono">{fastagData.tagId.slice(0, 4)}****{fastagData.tagId.slice(-4)}</p>
                    {fastagData.provider && <p className="text-xs text-gray-500 mt-0.5">{fastagData.provider}</p>}
                  </div>
                  <Badge color={fastagData.status === "ACTIVE" ? "success" : "error"} variant="light" size="sm">{fastagData.status}</Badge>
                </div>
                <div className="text-center py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Balance</p>
                  <p className={`text-2xl font-black ${fastagData.balance >= 500 ? "text-emerald-600" : fastagData.balance >= 100 ? "text-amber-600" : "text-red-600"}`}>
                    &#8377;{fastagData.balance.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-gray-400">Enrolled</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{new Date(fastagData.enrolledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-gray-400">Expiry</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{new Date(fastagData.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
                {/* Quick recharge */}
                {fastagData.status === "ACTIVE" && (
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      {[500, 1000, 2000].map((a) => (
                        <button key={a} type="button" onClick={() => setFastagRechargeAmt(String(a))}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${fastagRechargeAmt === String(a) ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700"}`}>
                          &#8377;{a.toLocaleString("en-IN")}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="number" value={fastagRechargeAmt} onChange={(e) => setFastagRechargeAmt(e.target.value)} placeholder="₹ Amount" min={100}
                        className="flex-1 min-w-0 h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                      <button disabled={fastagRecharging || !fastagRechargeAmt || Number(fastagRechargeAmt) < 100}
                        onClick={async () => {
                          setFastagRecharging(true);
                          try {
                            await fastagAPI.recharge(fastagData.id, Number(fastagRechargeAmt));
                            toast.success("Recharged", `₹${fastagRechargeAmt} added`);
                            setFastagRechargeAmt("");
                            const res = await fastagAPI.getByVehicle(vehicle.id);
                            setFastagData(res.data.data);
                          } catch { toast.error("Failed", "Recharge failed"); }
                          finally { setFastagRecharging(false); }
                        }}
                        className="h-9 px-4 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all whitespace-nowrap flex-shrink-0">
                        {fastagRecharging ? "..." : "Recharge"}
                      </button>
                    </div>
                  </div>
                )}
                {/* Recent transactions */}
                {fastagData.transactions && fastagData.transactions.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Recent Transactions</p>
                    <div className="space-y-2">
                      {fastagData.transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-700 dark:text-gray-300 font-medium truncate">{tx.description || tx.type}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(tx.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <span className={`font-bold flex-shrink-0 ml-2 ${tx.type === "TOLL" ? "text-red-600" : "text-emerald-600"}`}>{tx.type === "TOLL" ? "-" : "+"}&#8377;{tx.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400 mb-2">No FASTag linked</p>
                <a href="/fastag" className="text-xs font-medium text-brand-500 hover:text-brand-600">Create FASTag</a>
              </div>
            )}
          </div>

          {/* QR Code Card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 text-center">QR Code</h3>
            {(
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 shadow-sm">
                  <img
                    src={qrSrc}
                    alt="Vehicle QR Code"
                    className="w-36 h-36"
                    crossOrigin="anonymous"
                  />
                </div>
                <p className="mt-3 text-xs font-mono font-bold text-gray-600 dark:text-gray-400 tracking-widest">
                  {vehicle.registrationNumber}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Scan to view public profile</p>

                <div className="mt-4 grid grid-cols-2 gap-2 w-full">
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = qrSrc;
                      a.download = `QR-${vehicle.registrationNumber}.png`;
                      a.click();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 px-3 py-2.5 text-xs font-semibold text-brand-600 dark:text-brand-400 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={2} />
                    Download
                  </button>
                  <button
                    onClick={() => {
                      const w = window.open("", "_blank", "width=420,height=550");
                      if (!w) return;
                      w.document.write(`<html><head><title>QR - ${vehicle.registrationNumber}</title><style>
                        body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;background:#fff}
                        .c{text-align:center;padding:48px;border:2px dashed #e5e7eb;border-radius:20px}
                        .c img{width:220px;height:220px}
                        .r{font-size:24px;font-weight:900;letter-spacing:4px;margin-top:20px;font-family:monospace}
                        .s{font-size:13px;color:#9ca3af;margin-top:8px}
                        .b{font-size:11px;color:#c0c0c0;margin-top:24px}
                        @media print{.c{border:none}}
                      </style></head><body><div class="c">
                        <img src="${qrSrc}" crossorigin="anonymous"/>
                        <div class="r">${vehicle.registrationNumber}</div>
                        <div class="s">${titleCase(vehicle.make)} &bull; ${titleCase(vehicle.model)} &bull; ${titleCase(vehicle.fuelType)}</div>
                        <div class="b">Car Affair — Fleet Compliance Management</div>
                      </div><script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
                      w.document.close();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" strokeWidth={2} />
                    Print
                  </button>
                </div>

                <a
                  href={`/public/vehicle/${vehicle.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-500 hover:text-brand-600 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  Preview Public Page
                </a>
              </div>
            )}
          </div>

          {/* Current Driver */}
          {/* <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Current Driver</h3>
            {vehicle.activeDriver ? (
              <Link
                href={`/drivers/${vehicle.activeDriver.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-brand-500/20">
                  {vehicle.activeDriver.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{vehicle.activeDriver.name}</p>
                  <p className="text-xs text-gray-500">{vehicle.activeDriver.licenseNumber}</p>
                </div>
              </Link>
            ) : (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-center">
                <p className="text-sm text-gray-500">No driver assigned</p>
              </div>
            )}
          </div> */}

          {/* Assignment History */}
          {/* <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Assignment History</h3>
            {vehicle.driverMappings.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No history</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-3">
                  {vehicle.driverMappings.map((m) => (
                    <div key={m.assignedAt} className="relative flex gap-3 pl-1">
                      <div className={`relative z-10 flex-shrink-0 w-[12px] h-[12px] mt-1.5 rounded-full border-2 ${
                        m.isActive ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
                      }`} />
                      <div className={`flex-1 p-2.5 rounded-lg ${m.isActive ? "bg-emerald-50 dark:bg-emerald-500/5" : "bg-gray-50 dark:bg-gray-800/50"}`}>
                        <div className="flex items-center justify-between">
                          <Link href={`/drivers/${m.driver.id}`} className="text-xs font-semibold text-gray-900 dark:text-white hover:text-brand-500">
                            {m.driver.name}
                          </Link>
                          {m.isActive && <Badge color="success" variant="light" size="sm">Active</Badge>}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(m.assignedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {m.unassignedAt && <> &rarr; {new Date(m.unassignedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div> */}

          {/* Tyre Profile — view only; Edit/Set Up opens modal */}
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center shadow-sm">
                  <GiCarWheel className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Tyres</h3>
                  <p className="text-[10px] text-gray-400">{vehicle.tyres.length > 0 ? `${vehicle.tyres.length} tracked` : "Not set up"}</p>
                </div>
              </div>
              <button
                onClick={openTyreEditor}
                className="text-[11px] font-semibold text-brand-500 hover:text-brand-600 flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                {vehicle.tyres.length > 0 ? "Edit" : "Set Up"}
              </button>
            </div>

            {vehicle.tyres.length === 0 ? (
              <div className="text-center px-5 pb-5">
                <div className="py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <GiCarWheel className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-400">No tyre data yet</p>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-4 grid grid-cols-2 gap-2">
                {vehicle.tyres.map((tyre) => (
                  <div key={tyre.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12 flex-shrink-0">
                      {tyre.position}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-gray-800 dark:text-gray-200 truncate">
                        {tyre.size || "—"}
                      </p>
                      {tyre.brand && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {tyre.brand}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(tyreReplacements.length > 0 || tyreBrandPerformance.length > 0) && (
              <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-800">
                {tyreBrandPerformance.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Brand Performance</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tyreBrandPerformance.map((b, i) => (
                        <span key={b.brand} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ${i === 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                          <span className="font-bold">{b.brand}</span>
                          <span className="opacity-60">·</span>
                          <span>{b.avgKm.toLocaleString("en-IN")} km avg</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {tyreReplacements.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Replacement History ({tyreReplacements.length})</p>
                    <div className="space-y-1.5">
                      {tyreReplacements.map((r, idx) => (
                        <div key={r._id ?? idx} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20 text-[11px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{r.brand}</span>
                            <span className="text-gray-400">·</span>
                            <span className="font-mono text-gray-600 dark:text-gray-400">{r.odometerKm.toLocaleString("en-IN")} km</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {r.ranKm != null ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">ran {r.ranKm.toLocaleString("en-IN")} km</span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wider font-bold text-brand-500">Current</span>
                            )}
                            <span className="text-[10px]">{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service Parts Profile — view only; Edit/Set Up opens modal */}
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center shadow-sm">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Service Parts</h3>
                  <p className="text-[10px] text-gray-400">{vehicle.serviceParts && vehicle.serviceParts.length > 0 ? `${vehicle.serviceParts.length} tracked` : "Not set up"}</p>
                </div>
              </div>
              <button
                onClick={openPartsEditor}
                className="text-[11px] font-semibold text-brand-500 hover:text-brand-600 flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                {vehicle.serviceParts && vehicle.serviceParts.length > 0 ? "Edit" : "Set Up"}
              </button>
            </div>

            {!vehicle.serviceParts || vehicle.serviceParts.length === 0 ? (
              <div className="text-center px-5 pb-5">
                <div className="py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <Wrench className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-400">No service parts yet</p>
                  <p className="text-[10px] text-gray-400 mt-1">Add part numbers for Oil Filter, Air Filter, etc.</p>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-4 grid grid-cols-1 gap-2">
                {vehicle.serviceParts.map((part) => (
                  <div key={part.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{part.name}</p>
                      {part.partNumber && (
                        <p className="text-[11px] font-mono text-gray-600 dark:text-gray-400 truncate mt-0.5">{part.partNumber}</p>
                      )}
                      {part.notes && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{part.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service History */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Wrench className="w-4 h-4 text-brand-500" strokeWidth={2} />
                Service History
                {services.length > 0 && <span className="text-[10px] font-normal text-gray-400 normal-case ml-1">({services.length})</span>}
              </h3>
              {services.length > 0 && (
                <Link href={`/vehicles/services/${vehicle.id}`} className="text-xs font-semibold text-brand-500 hover:text-brand-600 flex items-center gap-1 transition-colors">
                  View All
                  <ChevronRight className="w-3 h-3" strokeWidth={2} />
                </Link>
              )}
            </div>

            {/* Overdue alert */}
            {services.some((s) => s.nextDueDate && new Date(s.nextDueDate) < new Date()) && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2} />
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Scheduled service overdue — check pending services below</p>
              </div>
            )}

            {services.length === 0 ? (
              <div className="text-center py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <Wrench className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No service records yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Go to <Link href="/vehicles/services" className="text-brand-500 hover:text-brand-600 font-medium">Services</Link> to add or schedule services
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((svc) => {
                  const isOverdue = svc.nextDueDate && new Date(svc.nextDueDate) < new Date();
                  return (
                    <Link key={svc.id} href={`/vehicles/services/${vehicle.id}`}
                      className={`block rounded-xl border p-4 transition-all hover:shadow-md hover:border-brand-200 dark:hover:border-brand-500/30 group ${isOverdue ? "border-red-200 bg-red-50/30 dark:border-red-500/20 dark:bg-red-500/5" : "border-gray-200 dark:border-gray-700"}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{svc.title}</h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${svc.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"}`}>
                              {svc.status}
                            </span>
                            {isOverdue && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">OVERDUE</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" strokeWidth={2} />
                              {new Date(svc.serviceDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            {svc.odometerKm && <span>{svc.odometerKm.toLocaleString()} km</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">&#8377;{svc.totalCost.toLocaleString("en-IN")}</p>
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditService(svc); }} className="rounded-lg p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      </div>

                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Service Modal — 2 Steps */}
      {showServiceModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowServiceModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className={`px-6 py-4 flex-shrink-0 ${svcForm.status === "UPCOMING" ? "bg-gradient-to-r from-blue-600 to-blue-500" : "bg-gradient-to-r from-brand-500 to-brand-400"}`}>
              <h3 className="text-lg font-bold text-white">
                {editingService ? "Edit Service" : svcForm.status === "UPCOMING" ? "Schedule Service" : "Log Service"}
              </h3>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Service Title *</label>
                  <input type="text" placeholder="e.g. Full Service, Oil Change" value={svcForm.title} onChange={(e) => setSvcForm({ ...svcForm, title: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
                  <select value={svcForm.status} onChange={(e) => setSvcForm({ ...svcForm, status: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <option value="COMPLETED">Completed</option>
                    <option value="UPCOMING">Upcoming</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{svcForm.status === "UPCOMING" ? "Scheduled Date *" : "Service Date *"}</label>
                  <DatePicker value={svcForm.serviceDate} onChange={(v) => setSvcForm({ ...svcForm, serviceDate: v })} placeholder="Select date" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Odometer (km)</label>
                  <input type="number" placeholder="e.g. 45000" value={svcForm.odometerKm} onChange={(e) => setSvcForm({ ...svcForm, odometerKm: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Total Cost (&#8377;)</label>
                  <input type="number" placeholder="0" value={svcForm.totalCost} onChange={(e) => setSvcForm({ ...svcForm, totalCost: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Notes</label>
                <input type="text" placeholder="Optional notes..." value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })}
                  className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>

              {/* Receipts */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Service Receipts</label>
                {(svcExistingReceipts.filter((u) => !svcRemovedReceipts.includes(u)).length > 0 || svcReceipts.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {svcExistingReceipts.filter((u) => !svcRemovedReceipts.includes(u)).map((url, i) => (
                      <span key={`e${i}`} className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400">Receipt {i + 1} <button type="button" onClick={() => setSvcRemovedReceipts([...svcRemovedReceipts, url])} className="text-red-400">&times;</button></span>
                    ))}
                    {svcReceipts.map((f, i) => (
                      <span key={`n${i}`} className="flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-50 dark:bg-yellow-500/10 text-[10px] text-yellow-700 dark:text-yellow-400 truncate max-w-[140px]">{f.name} <button type="button" onClick={() => setSvcReceipts(svcReceipts.filter((_, j) => j !== i))} className="text-red-400">&times;</button></span>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-400 cursor-pointer transition-colors group">
                  <Upload className="w-4 h-4 text-gray-300 group-hover:text-brand-500" strokeWidth={1.5} />
                  <span className="text-xs text-gray-400 group-hover:text-brand-600">Upload receipts</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const fs = pickValidatedFiles(e.target, (t, m) => toast.error(t, m)); if (fs.length) setSvcReceipts([...svcReceipts, ...fs]); }} />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveService} disabled={savingService || !svcForm.title || !svcForm.serviceDate}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingService ? "Saving..." : editingService ? "Update Service" : svcForm.status === "UPCOMING" ? "Schedule Service" : "Add Service"}
                </button>
                <button onClick={() => setShowServiceModal(false)} className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Compliance Document Modal */}
      {addingCompliance && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !addingLoading && setAddingCompliance(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Add Compliance Document</h3>
              <p className="text-white/80 text-xs mt-0.5">Pick a document type and attach the file (optional). You can change the expiry later.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document Type</label>
                <select value={addType} onChange={(e) => {
                    const next = e.target.value;
                    setAddType(next);
                    if (next !== "OTHER") setAddCustomLabel("");
                    // If the picked type is lifetime-only, force the lifetime checkbox.
                    if (next !== "OTHER" && !docTypeHasExpiry(next)) {
                      setAddLifetime(true);
                      setAddExpiry("");
                    }
                  }}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  {(docTypeMasters.length > 0 ? docTypeMasters.map((d) => d.code) : Object.keys(DOC_LABELS)).map((t) => {
                    const exists = vehicle?.complianceDocuments.some((d) => d.type === t);
                    return <option key={t} value={t} disabled={exists}>{docTypeLabel(t)}{exists ? " (already added)" : ""}</option>;
                  })}
                  <option value="OTHER">Other / Custom…</option>
                </select>
                {addType === "OTHER" && (
                  <input type="text" placeholder="e.g. Route Permit, NOC" value={addCustomLabel} onChange={(e) => setAddCustomLabel(e.target.value)} maxLength={60}
                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={addLifetime} onChange={(e) => { setAddLifetime(e.target.checked); if (e.target.checked) setAddExpiry(""); }}
                    className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Lifetime validity (no expiry)</span>
                </label>
                {!addLifetime && (
                  <DatePicker value={addExpiry} onChange={setAddExpiry} placeholder="Select expiry date" />
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">File (optional)</label>
                <label className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-400 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 truncate flex-1">{addFile?.name ?? "Select PDF, JPG, or PNG"}</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = pickValidatedFile(e.target, (t, m) => toast.error(t, m)); if (f) setAddFile(f); }} />
                </label>
                {addFile && (
                  <button type="button" onClick={() => setAddFile(null)} className="mt-1 text-[10px] text-red-500 hover:text-red-600">Remove file</button>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <button onClick={handleAddCompliance} disabled={addingLoading}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {addingLoading ? "Adding…" : "Add Document"}
              </button>
              <button onClick={() => setAddingCompliance(false)} disabled={addingLoading}
                className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expiry Modal */}
      {editingExpiry && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setEditingExpiry(null); setExpiryValue(""); }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Edit Expiry Date</h3>
              <p className="text-white/70 text-sm mt-0.5">
                {docTypeLabel(vehicle.complianceDocuments.find((d) => d.id === editingExpiry)?.type || "") || "Document"}
              </p>
            </div>
            <div className="p-6 space-y-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editLifetime} onChange={(e) => { setEditLifetime(e.target.checked); if (e.target.checked) setExpiryValue(""); }}
                  className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lifetime validity (no expiry)</span>
              </label>
              {!editLifetime && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">New Expiry Date</label>
                  <DatePicker key={`edit-${editingExpiry}`} value={expiryValue} onChange={setExpiryValue} placeholder="Select expiry date" />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { const doc = vehicle.complianceDocuments.find((d) => d.id === editingExpiry); if (doc) handleExpiryUpdate(doc.id, doc.type); }}
                  disabled={savingExpiry || (!editLifetime && !expiryValue)}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingExpiry ? "Saving..." : editLifetime ? "Set Lifetime" : "Update Expiry"}
                </button>
                <button onClick={() => { setEditingExpiry(null); setExpiryValue(""); setEditLifetime(false); }}
                  className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewingDoc && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setRenewingDoc(null); setRenewExpiry(""); setRenewFile(null); }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Renew Document</h3>
              <p className="text-white/70 text-sm mt-0.5">
                {docTypeLabel(vehicle.complianceDocuments.find((d) => d.id === renewingDoc)?.type || "") || "Document"}
              </p>
            </div>
            <div className="p-6 space-y-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={renewLifetime} onChange={(e) => { setRenewLifetime(e.target.checked); if (e.target.checked) setRenewExpiry(""); }}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lifetime validity (no expiry)</span>
              </label>
              {!renewLifetime && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">New Expiry Date</label>
                  <DatePicker value={renewExpiry} onChange={setRenewExpiry} placeholder="Select new expiry date" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Upload New Document <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                <label className={`flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${renewFile ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5" : "border-gray-200 dark:border-gray-700 hover:border-emerald-400"}`}>
                  {renewFile ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <Check className="w-4 h-4" strokeWidth={2} />
                      <span className="font-medium truncate max-w-[200px]">{renewFile.name}</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); setRenewFile(null); }} className="text-red-500 hover:text-red-600 ml-1">&times;</button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                      <span className="text-xs text-gray-400 mt-1">Click to upload (PDF, JPG, PNG)</span>
                    </>
                  )}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = pickValidatedFile(e.target, (t, m) => toast.error(t, m)); if (f) setRenewFile(f); }} />
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { const doc = vehicle.complianceDocuments.find((d) => d.id === renewingDoc); if (doc) handleRenew(doc.id, doc.type); }}
                  disabled={renewLoading || (!renewLifetime && !renewExpiry)}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {renewLoading ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Renewing...</>
                  ) : "Renew Document"}
                </button>
                <button onClick={() => { setRenewingDoc(null); setRenewExpiry(""); setRenewFile(null); setRenewLifetime(false); }}
                  className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHALLAN DETAIL MODAL (Read-only) ── */}
      {viewChallan && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewChallan(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className={`px-6 py-5 flex-shrink-0 ${viewChallan.status === "PAID" ? "bg-gradient-to-r from-emerald-500 to-green-500" : "bg-gradient-to-r from-red-500 to-rose-500"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Challan Details</h3>
                  <p className="text-white/70 text-sm mt-0.5">{vehicle.registrationNumber} &mdash; {viewChallan.challanNumber || "N/A"}</p>
                </div>
                <p className="text-3xl font-black text-white">&#8377;{viewChallan.amount.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Status + Echallan No */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Status</p>
                  <Badge color={viewChallan.status === "PAID" ? "success" : "error"} variant="light" size="sm">{viewChallan.status}</Badge>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Echallan No</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-mono">{viewChallan.challanNumber || "N/A"}</p>
                </div>
              </div>

              {/* Unit Name + Source */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Unit Name</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{viewChallan.unitName || "N/A"}</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Source</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{viewChallan.source || "N/A"}</p>
                </div>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Date</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{new Date(viewChallan.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Time</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{new Date(viewChallan.issuedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                </div>
              </div>

              {/* Place of Violation + PS Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Place of Violation</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{viewChallan.location || "N/A"}</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">PS Limits</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{viewChallan.psLimits || "N/A"}</p>
                </div>
              </div>

              {/* Violation */}
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                <p className="text-[10px] text-red-500/70 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" strokeWidth={2} />
                  Violation
                </p>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">{viewChallan.violation || "N/A"}</p>
              </div>

              {/* Authorized By */}
              {viewChallan.authorizedBy && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-9 h-9 rounded-lg bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-yellow-600 dark:text-yellow-400" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Authorized By</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{viewChallan.authorizedBy}</p>
                  </div>
                </div>
              )}

              {/* Fine Breakdown */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Fine Details</p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Fine Amount</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">&#8377;{viewChallan.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">User Charges</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">&#8377;{(viewChallan.userCharges ?? 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/30">
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Total Fine</span>
                    <span className={`text-sm font-black ${viewChallan.status === "PAID" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>&#8377;{(viewChallan.amount + (viewChallan.userCharges ?? 0)).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Proof Image */}
              {viewChallan.proofImageUrl ? (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" strokeWidth={2} />
                    Proof Image
                  </p>
                  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img src={viewChallan.proofImageUrl.startsWith("http") ? viewChallan.proofImageUrl : (resolveImageUrl(viewChallan.proofImageUrl) ?? "")} alt="Challan Proof" className="w-full h-48 object-cover" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Proof Image</p>
                  <p className="text-sm text-gray-400">No image available</p>
                </div>
              )}

              {/* Paid info */}
              {viewChallan.paidAt && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3.5 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" strokeWidth={2} />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Paid on {new Date(viewChallan.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <button onClick={() => setViewChallan(null)}
                className="w-full h-11 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {hoverPhoto && (
        <div className="fixed z-[99999] pointer-events-none" style={{ left: hoverPhoto.x, top: hoverPhoto.y, transform: "translateY(-50%)" }}>
          <img src={hoverPhoto.url} alt="Vehicle" className="w-52 h-52 rounded-2xl object-cover shadow-2xl ring-4 ring-white dark:ring-gray-900" />
        </div>
      )}

      {/* Tyre Profile Editor Modal */}
      <Modal
        isOpen={editingTyres}
        onClose={savingTyres ? () => undefined : () => setEditingTyres(false)}
        showCloseButton={!savingTyres}
        className="w-[92%] max-w-[640px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
            <GiCarWheel className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {vehicle && vehicle.tyres.length > 0 ? "Edit Tyre Profile" : "Set Up Tyre Profile"}
            </h3>
            <p className="text-[11px] text-gray-400">
              {tyreForm.length} position{tyreForm.length !== 1 ? "s" : ""} — fill the ones you have data for
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
          {/* Tyre count selector */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-yellow-50/30 dark:bg-yellow-500/5">
            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Number of Tyres</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[4, 6, 8, 10].map((n) => (
                <button key={n} type="button" onClick={() => applyTyreCount(n)}
                  className={`w-11 h-9 rounded-lg border-2 text-xs font-bold transition-all ${editTyreCount === n ? "border-yellow-400 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-500 dark:text-yellow-400" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
                  {n}
                </button>
              ))}
              <span className="text-[10px] text-gray-400">or custom</span>
              <input type="number" min={2} max={20} value={editTyreCount} onChange={(e) => { const v = Math.max(2, Math.min(20, parseInt(e.target.value) || 2)); applyTyreCount(v); }}
                className="w-16 h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-center font-semibold text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">4 = Car/SUV · 6 = LCV · 8 = Mini Truck · 10 = Truck/Bus. Spare auto-included.</p>
          </div>
          {/* 3D vehicle diagram — click any tyre to enter its size */}
          <TyreDiagram3D
            positions={tyreForm.map((t) => t.position)}
            sizes={Object.fromEntries(tyreForm.map((t) => [t.position, t.size]))}
            selected={selectedTyrePosition}
            onSelect={setSelectedTyrePosition}
          />

          {/* Selected-tyre input */}
          {(() => {
            const selectedIdx = tyreForm.findIndex((t) => t.position === selectedTyrePosition);
            const selected = selectedIdx >= 0 ? tyreForm[selectedIdx] : null;
            if (!selected) {
              return (
                <p className="text-xs text-gray-400 text-center py-4">Click any tyre on the diagram to enter its size.</p>
              );
            }
            const goNext = () => {
              const next = tyreForm[(selectedIdx + 1) % tyreForm.length];
              setSelectedTyrePosition(next.position);
            };
            return (
              <div className="rounded-lg border border-yellow-200 dark:border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-500/5 p-4">
                <label className="block mb-2">
                  <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">
                    {TYRE_POSITION_LABELS[selected.position] || selected.position} <span className="text-gray-400 font-mono">· {selected.position}</span>
                  </span>
                </label>
                <div className="grid grid-cols-[1.4fr_1fr_auto] items-stretch gap-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Size (e.g. 215/60 R16)"
                    value={selected.size}
                    onChange={(e) => {
                      const n = [...tyreForm];
                      n[selectedIdx] = { ...n[selectedIdx], size: e.target.value };
                      setTyreForm(n);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goNext(); } }}
                    className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Brand (e.g. MRF, CEAT)"
                    value={selected.brand}
                    onChange={(e) => {
                      const n = [...tyreForm];
                      n[selectedIdx] = { ...n[selectedIdx], brand: e.target.value };
                      setTyreForm(n);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goNext(); } }}
                    maxLength={80}
                    className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <button type="button" onClick={goNext}
                    className="h-10 px-3 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold flex items-center gap-1">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">Press Enter or click Next to move to the next tyre. Brand is optional.</p>
              </div>
            );
          })()}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditingTyres(false)}
            disabled={savingTyres}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveTyres}
            disabled={savingTyres}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 shadow-sm transition-colors disabled:opacity-60"
          >
            {savingTyres ? "Saving…" : "Save Tyres"}
          </button>
        </div>
        </div>
      </Modal>

      {/* Service Parts Profile Editor Modal */}
      <Modal
        isOpen={editingParts}
        onClose={savingParts ? () => undefined : () => setEditingParts(false)}
        showCloseButton={!savingParts}
        className="w-[92%] max-w-[640px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col max-h-[85vh]">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {vehicle && vehicle.serviceParts && vehicle.serviceParts.length > 0 ? "Edit Service Parts" : "Set Up Service Parts"}
              </h3>
              <p className="text-[11px] text-gray-400">
                Store part numbers for filters, plugs, belts, etc. — fill what you have
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2">
            {partsForm.map((part, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/40 dark:bg-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Part {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setPartsForm((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove"
                    disabled={savingParts}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Part Name (e.g. Oil Filter)"
                    value={part.name}
                    list={`part-names-${idx}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPartsForm((prev) => prev.map((p, i) => (i === idx ? { ...p, name: v } : p)));
                    }}
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <datalist id={`part-names-${idx}`}>
                    <option value="Oil Filter" />
                    <option value="Air Filter" />
                    <option value="Fuel Filter" />
                    <option value="AC / Cabin Filter" />
                    <option value="Brake Pads (Front)" />
                    <option value="Brake Pads (Rear)" />
                    <option value="Battery" />
                    <option value="Spark Plugs" />
                    <option value="Wiper Blades" />
                    <option value="Engine Oil" />
                    <option value="Coolant" />
                    <option value="Timing Belt" />
                    <option value="Drive Belt" />
                  </datalist>
                  <input
                    type="text"
                    placeholder="Part Number"
                    value={part.partNumber}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPartsForm((prev) => prev.map((p, i) => (i === idx ? { ...p, partNumber: v } : p)));
                    }}
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-xs font-mono text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={part.notes}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPartsForm((prev) => prev.map((p, i) => (i === idx ? { ...p, notes: v } : p)));
                  }}
                  className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPartsForm((prev) => [...prev, { name: "", partNumber: "", notes: "" }])}
              disabled={savingParts}
              className="w-full h-10 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 hover:border-brand-400 hover:text-brand-500 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Part
            </button>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingParts(false)}
              disabled={savingParts}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveParts}
              disabled={savingParts}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 shadow-sm transition-colors disabled:opacity-60"
            >
              {savingParts ? "Saving…" : "Save Parts"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Sell Vehicle Modal */}
      <Modal
        isOpen={showSellModal}
        onClose={savingSale ? () => undefined : () => setShowSellModal(false)}
        showCloseButton={!savingSale}
        className="w-[92%] max-w-[720px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col max-h-[88vh]">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-100 dark:to-gray-300 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white dark:text-gray-900" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {vehicle.status === "SOLD" ? "Edit Sale Details" : "Sell Vehicle"}
              </h3>
              <p className="text-[11px] text-gray-400">Record buyer info, upload buyer & transfer documents</p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
            {/* Buyer details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Buyer Name *</label>
                <input type="text" value={saleForm.buyerName} onChange={(e) => setSaleForm({ ...saleForm, buyerName: e.target.value })}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="Full name" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Buyer Mobile *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+91</span>
                  <input type="tel" maxLength={10} value={saleForm.buyerPhone} onChange={(e) => setSaleForm({ ...saleForm, buyerPhone: e.target.value })}
                    className="w-full h-10 rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="9876543210" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Buyer Email <span className="text-gray-400 normal-case">(optional)</span></label>
                <input type="email" value={saleForm.buyerEmail} onChange={(e) => setSaleForm({ ...saleForm, buyerEmail: e.target.value })}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="buyer@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sold Price (&#8377;) <span className="text-gray-400 normal-case">(optional)</span></label>
                <input type="number" min="0" value={saleForm.soldPrice} onChange={(e) => setSaleForm({ ...saleForm, soldPrice: e.target.value })}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="0" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sale Date *</label>
                <DatePicker value={saleForm.saleDate} onChange={(v) => setSaleForm({ ...saleForm, saleDate: v })} placeholder="Select date" />
              </div>
              <label className="flex items-center gap-2 mt-6 cursor-pointer select-none">
                <input type="checkbox" checked={saleForm.pendingChallansCleared} onChange={(e) => setSaleForm({ ...saleForm, pendingChallansCleared: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pending Challans Cleared</span>
              </label>
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-800" />

            {/* Buyer documents */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Buyer Documents <span className="text-gray-400 normal-case">(Aadhaar, PAN, DL)</span>
              </label>
              <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-400 cursor-pointer transition-colors group">
                <Upload className="w-4 h-4 text-gray-300 group-hover:text-brand-500" />
                <span className="text-xs text-gray-400 group-hover:text-brand-600">
                  {saleBuyerDocs.length === 0 ? "Upload buyer ID documents" : `Add more (${saleBuyerDocs.length} selected)`}
                </span>
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const fs = pickValidatedFiles(e.target, (t, m) => toast.error(t, m)); if (fs.length) setSaleBuyerDocs((prev) => [...prev, ...fs]); }} />
              </label>
              {saleBuyerDocs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {saleBuyerDocs.map((f, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 text-[10px] font-medium">
                      <span className="truncate max-w-[180px]">{f.name}</span>
                      <button type="button" onClick={() => setSaleBuyerDocs((prev) => prev.filter((_, i) => i !== idx))} className="text-red-500 text-[9px] font-semibold ml-0.5" title="Remove">X</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Transfer documents */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Transfer Documents <span className="text-gray-400 normal-case">(Form 28, 29, 30, Sale Letter)</span>
              </label>
              <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-400 cursor-pointer transition-colors group">
                <Upload className="w-4 h-4 text-gray-300 group-hover:text-brand-500" />
                <span className="text-xs text-gray-400 group-hover:text-brand-600">
                  {saleTransferDocs.length === 0 ? "Upload transfer / RTO forms" : `Add more (${saleTransferDocs.length} selected)`}
                </span>
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const fs = pickValidatedFiles(e.target, (t, m) => toast.error(t, m)); if (fs.length) setSaleTransferDocs((prev) => [...prev, ...fs]); }} />
              </label>
              {saleTransferDocs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {saleTransferDocs.map((f, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 text-[10px] font-medium">
                      <span className="truncate max-w-[180px]">{f.name}</span>
                      <button type="button" onClick={() => setSaleTransferDocs((prev) => prev.filter((_, i) => i !== idx))} className="text-red-500 text-[9px] font-semibold ml-0.5" title="Remove">X</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes <span className="text-gray-400 normal-case">(optional)</span></label>
              <textarea value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="Any additional sale notes…" />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowSellModal(false)} disabled={savingSale}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60">Cancel</button>
            <button type="button" onClick={handleSaveSale} disabled={savingSale}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 shadow-sm transition-colors disabled:opacity-60">
              {savingSale ? "Saving…" : vehicle.status === "SOLD" ? "Save Changes" : "Mark as Sold"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmCancelSale}
        title="Cancel sale?"
        message="The vehicle will be marked Active again and the recorded sale details (buyer info, attachments) will be removed. This cannot be undone."
        confirmLabel="Cancel Sale"
        cancelLabel="Keep"
        variant="danger"
        loading={cancellingSale}
        onConfirm={handleCancelSale}
        onCancel={() => (cancellingSale ? undefined : setConfirmCancelSale(false))}
      />

      {/* Delete Vehicle — OTP-gated */}
      <Modal
        isOpen={showDeleteModal}
        onClose={confirmingDelete ? () => undefined : () => setShowDeleteModal(false)}
        showCloseButton={!confirmingDelete}
        className="w-[92%] max-w-[480px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Vehicle</h3>
              <p className="text-[11px] text-gray-400">
                {vehicle.registrationNumber} · OTP-gated, recoverable
              </p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5 p-3 text-[12px] text-amber-800 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">This vehicle will be archived:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Disappears from all lists, dashboards, and reports</li>
                  <li>Active driver is unassigned automatically</li>
                  <li>Historical records (challans, services, EMI, etc.) are preserved</li>
                </ul>
                <p className="mt-1.5">You can recover it later if needed (data is kept).</p>
              </div>
            </div>

            {requestingDeleteOtp ? (
              <p className="text-xs text-gray-500 text-center py-4">Generating OTP…</p>
            ) : deleteOtp ? (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5 p-3">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Verification OTP (shown here for now — will be emailed in production)
                  </p>
                  <p className="text-2xl font-black font-mono tracking-[0.4em] text-amber-700 dark:text-amber-400 text-center py-1">
                    {deleteOtp}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Enter OTP to confirm
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={deleteOtpInput}
                    onChange={(e) => setDeleteOtpInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit code"
                    autoFocus
                    className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-lg font-mono tracking-[0.4em] text-center text-gray-900 focus:border-red-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              disabled={confirmingDelete}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={confirmingDelete || !deleteOtp || deleteOtpInput.length < 4}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors disabled:opacity-50"
            >
              {confirmingDelete ? "Archiving…" : "Delete Vehicle"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Document history modal — per compliance doc */}
      <Modal
        isOpen={historyDocType !== null}
        onClose={() => setHistoryDocType(null)}
        className="w-[92%] max-w-[520px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col max-h-[80vh]">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {historyDocType ? docTypeLabel(historyDocType) : ""} History
              </h3>
              <p className="text-[11px] text-gray-400">All past versions of this document</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {historyLoading ? (
              <div className="space-y-2 py-2 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2.5"><div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700" /><div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" /></div>
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            ) : historyData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No history yet — this is the first version.</p>
            ) : (
              <>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold px-1">{historyData.length} record{historyData.length > 1 ? "s" : ""}</p>
                {historyData.map((h) => (
                  <div key={h.id} className={`relative flex items-center justify-between p-3 rounded-xl text-xs transition-all ${h.isActive ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20" : "bg-gray-50 border border-gray-100 dark:bg-gray-800/50 dark:border-gray-700"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {h.expiryDate ? new Date(h.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Lifetime"}
                          </span>
                          {h.isActive && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">CURRENT</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Created {new Date(h.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {h.archivedAt && <> &middot; Archived {new Date(h.archivedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>}
                        </p>
                      </div>
                    </div>
                    {h.documentUrl && (
                      <a href={(resolveImageUrl(h.documentUrl) ?? "")} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-medium text-brand-500 hover:text-brand-600 flex-shrink-0">
                        <ExternalLink className="w-3 h-3" strokeWidth={2} />
                        View
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <button type="button" onClick={() => setHistoryDocType(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors">Close</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!imageToDelete}
        title="Delete this photo?"
        message="This photo will be removed from the vehicle. If it's the current profile image, the next photo in the list becomes the new profile."
        confirmLabel="Delete photo"
        cancelLabel="Keep"
        variant="danger"
        loading={deletingImage}
        onConfirm={handleConfirmDeleteImage}
        onCancel={() => (deletingImage ? undefined : setImageToDelete(null))}
        preview={
          imageToDelete ? (
            <img
              src={resolveImageUrl(imageToDelete) ?? ""}
              alt=""
              className="w-full h-40 object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : undefined
        }
      />
    </div>
  );
}
