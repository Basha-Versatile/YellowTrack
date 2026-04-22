"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { vehicleAPI, vehicleGroupAPI, complianceAPI, fastagAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import Badge from "@/components/ui/badge/Badge";
import { VehicleDetailSkeleton } from "@/components/ui/Skeleton";
import DatePicker from "@/components/ui/DatePicker";
import Link from "next/link";
import { AlertTriangle, Calendar, Car, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, Download, ExternalLink, FileText, ImageIcon, Pencil, Plus, Printer, RefreshCw, ShieldCheck, Trash2, Upload, User, Wrench, X } from "lucide-react";
import { GiCarWheel } from "react-icons/gi";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

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
  make: string;
  model: string;
  fuelType: string;
  chassisNumber: string;
  engineNumber: string;
  gvw: number;
  seatingCapacity: number;
  permitType: string;
  qrCodeUrl: string | null;
  invoiceUrl: string | null;
  images: string[];
  profileImage: string | null;
  overallStatus: string;
  pendingChallanAmount: number;
  group?: { id: string; name: string; icon: string; color?: string; tyreCount?: number } | null;
  complianceDocuments: ComplianceDoc[];
  challans: Challan[];
  tyres: Array<{
    id: string;
    position: string;
    brand: string | null;
    size: string | null;
    installedAt: string | null;
    kmAtInstall: number | null;
    condition: string;
  }>;
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
  ORANGE: { badge: "warning", gradient: "from-orange-500 to-orange-600", text: "text-orange-600 dark:text-orange-400", ring: "ring-orange-500/20" },
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

const CONDITION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  GOOD: { bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", label: "Good" },
  AVERAGE: { bg: "bg-amber-100 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", label: "Average" },
  REPLACE: { bg: "bg-red-100 dark:bg-red-500/20", text: "text-red-700 dark:text-red-400", label: "Replace" },
};

const getTyrePositions = (tyreCount: number): string[] => {
  const base = TYRE_POSITIONS[tyreCount] || Array.from({ length: tyreCount }, (_, i) => `T${i + 1}`);
  return [...base, "SPARE"];
};

export default function VehicleDetailPage() {
  const params = useParams();
  const toast = useToast();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [allGroups, setAllGroups] = useState<Array<{ id: string; name: string; icon: string; color?: string }>>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);

  // Tyre profile
  const [editingTyres, setEditingTyres] = useState(false);
  const [tyreForm, setTyreForm] = useState<Array<{ position: string; brand: string; size: string; installedAt: string; kmAtInstall: string; condition: string }>>([]);
  const [savingTyres, setSavingTyres] = useState(false);

  // Service records
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [svcForm, setSvcForm] = useState({ title: "", description: "", serviceDate: "", odometerKm: "", totalCost: "", nextDueDate: "", nextDueKm: "", status: "COMPLETED" });
  const [svcParts, setSvcParts] = useState<Array<{ name: string; quantity: string; unitCost: string; proofUrl: string; proofFile: File | null }>>([]);
  const [svcReceipts, setSvcReceipts] = useState<File[]>([]);
  const [svcExistingReceipts, setSvcExistingReceipts] = useState<string[]>([]);
  const [svcRemovedReceipts, setSvcRemovedReceipts] = useState<string[]>([]);
  const [svcStep, setSvcStep] = useState(1);

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

  // History
  const [historyDoc, setHistoryDoc] = useState<string | null>(null); // doc type
  const [historyData, setHistoryData] = useState<Array<{ id: string; expiryDate: string | null; documentUrl: string | null; isActive: boolean; createdAt: string; archivedAt: string | null }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchVehicle = () => {
    if (params.id) {
      vehicleAPI.getById(params.id as string)
        .then((res) => setVehicle(res.data.data))
        .catch(console.error)
        .finally(() => setLoading(false));
      vehicleAPI.getServices(params.id as string)
        .then((res) => setServices(res.data.data))
        .catch(() => {});
    }
  };

  const openEditService = (svc: ServiceRecord) => {
    setEditingService(svc);
    setSvcForm({
      title: svc.title, description: svc.description || "", serviceDate: svc.serviceDate.split("T")[0],
      odometerKm: svc.odometerKm?.toString() || "", totalCost: svc.totalCost.toString(),
      nextDueDate: svc.nextDueDate ? svc.nextDueDate.split("T")[0] : "", nextDueKm: svc.nextDueKm?.toString() || "",
      status: svc.status,
    });
    setSvcParts(svc.parts.length > 0 ? svc.parts.map((p) => ({ name: p.name, quantity: p.quantity.toString(), unitCost: p.unitCost.toString(), proofUrl: p.proofUrl || "", proofFile: null })) : [{ name: "", quantity: "1", unitCost: "", proofUrl: "", proofFile: null }]);
    setSvcReceipts([]);
    setSvcExistingReceipts(svc.receiptUrls || []);
    setSvcRemovedReceipts([]);
    setSvcStep(1);
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
      // Auto-calc total from parts + manual override
      const partsTotal = svcParts.filter((p) => p.name).reduce((sum, p) => sum + (parseFloat(p.unitCost) || 0) * (parseInt(p.quantity) || 1), 0);
      formData.append("totalCost", svcForm.totalCost || partsTotal.toString());
      if (svcForm.nextDueDate) formData.append("nextDueDate", svcForm.nextDueDate);
      if (svcForm.nextDueKm) formData.append("nextDueKm", svcForm.nextDueKm);
      formData.append("status", svcForm.status);
      const validParts = svcParts.filter((p) => p.name.trim());
      if (validParts.length > 0) {
        formData.append("parts", JSON.stringify(validParts.map((p) => ({ name: p.name, quantity: p.quantity, unitCost: p.unitCost, proofUrl: p.proofUrl || null }))));
        // Append per-part proof files
        validParts.forEach((p, i) => { if (p.proofFile) formData.append(`partProof_${i}`, p.proofFile); });
      }
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

  const handleViewHistory = async (vehicleId: string, docType: string) => {
    if (historyDoc === docType) { setHistoryDoc(null); return; } // toggle off
    setHistoryDoc(docType); setHistoryLoading(true);
    try {
      const res = await complianceAPI.getHistory(vehicleId, docType);
      setHistoryData(res.data.data || []);
    } catch { setHistoryData([]); }
    finally { setHistoryLoading(false); }
  };


  const handleDeleteImage = async (imageUrl: string) => {
    if (!params.id || !confirm("Delete this photo?")) return;
    try {
      await vehicleAPI.deleteImage(params.id as string, imageUrl);
      toast.success("Photo Deleted");
      fetchVehicle();
    } catch (err) { console.error(err); toast.error("Delete Failed"); }
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
                  <p className="text-white/70 text-sm flex items-center gap-1.5 flex-wrap">
                    <span>{vehicle.make} {vehicle.model} &bull; {vehicle.fuelType} &bull; {vehicle.permitType}</span>
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
              <div className="flex gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-bold text-white">{complianceScore}%</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Compliance</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-bold text-white">&#8377;{vehicle.pendingChallanAmount.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Pending</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                { label: "Chassis No.", value: vehicle.chassisNumber || "—" },
                { label: "Engine No.", value: vehicle.engineNumber || "—" },
                { label: "GVW", value: vehicle.gvw ? `${vehicle.gvw} kg` : "—" },
                { label: "Seating", value: vehicle.seatingCapacity?.toString() || "—" },
                { label: "Fuel Type", value: vehicle.fuelType },
                { label: "Permit", value: vehicle.permitType || "—" },
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
                <input type="file" accept=".jpg,.jpeg,.png" multiple className="hidden" disabled={uploadingImages} onChange={(e) => handleImageUpload(e.target.files)} />
              </label>
            </div>

            {vehicle.images && vehicle.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {vehicle.images.map((img, i) => {
                  const isProfile = vehicle.profileImage === img;
                  return (
                    <div key={i} className={`group relative aspect-video rounded-xl overflow-hidden border-2 transition-colors ${isProfile ? "border-yellow-400 ring-2 ring-yellow-400/30" : "border-gray-200 dark:border-gray-700 hover:border-brand-400"}`}>
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${img}`} target="_blank" rel="noopener noreferrer">
                        <img src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${img}`} alt={`Vehicle photo ${i + 1}`}
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
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${img}`} target="_blank" rel="noopener noreferrer"
                        className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-white/80 hover:bg-white text-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                      </a>
                    </div>
                  );
                })}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500/50 cursor-pointer transition-colors group">
                <ImageIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 group-hover:text-yellow-500 transition-colors" strokeWidth={1.5} />
                <span className="text-sm text-gray-400 group-hover:text-yellow-600 font-medium mt-2">Click to upload vehicle photos</span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">JPG, PNG — up to 10 photos</span>
                <input type="file" accept=".jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
              </label>
            )}
          </div>

          {/* Compliance Documents */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-500" strokeWidth={2} />
                Compliance ({greenDocs}/{totalDocs} valid)
              </h3>
              {/* Progress mini */}
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient}`} style={{ width: `${complianceScore}%` }} />
                </div>
                <span className={`text-xs font-bold ${theme.text}`}>{complianceScore}%</span>
              </div>
            </div>

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
                        ? "border-orange-200 bg-orange-50/50 dark:border-orange-500/20 dark:bg-orange-500/5"
                        : "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5"
                    }`}
                  >
                    {/* Status indicator line */}
                    <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b ${dt.gradient}`} />

                    <div className="flex items-start justify-between ml-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          doc.status === "GREEN" ? "bg-emerald-100 dark:bg-emerald-500/20" : doc.status === "YELLOW" ? "bg-amber-100 dark:bg-amber-500/20" : doc.status === "ORANGE" ? "bg-orange-100 dark:bg-orange-500/20" : "bg-red-100 dark:bg-red-500/20"
                        }`}>
                          <svg className={`w-4 h-4 ${dt.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{DOC_LABELS[doc.type] || doc.type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                            {doc.expiryDate
                              ? <>Exp: {new Date(doc.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
                              : <span className="text-emerald-600 dark:text-emerald-400 font-medium">Lifetime</span>}
                            <button
                              onClick={() => { setEditingExpiry(doc.id); setEditLifetime(!doc.expiryDate); setExpiryValue(doc.expiryDate ? new Date(doc.expiryDate).toISOString().split("T")[0] : ""); }}
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
                        <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${doc.documentUrl}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 transition-colors">
                          <ExternalLink className="w-3 h-3" strokeWidth={2} />
                          View File
                        </a>
                      )}
                      {doc.documentUrl ? (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <button onClick={() => { setRenewingDoc(renewingDoc === doc.id ? null : doc.id); setRenewExpiry(""); setRenewFile(null); }}
                            className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 transition-colors">
                            <RefreshCw className="w-3 h-3" strokeWidth={2} />
                            Renew
                          </button>
                        </>
                      ) : (
                        <label className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 cursor-pointer transition-colors">
                          <Upload className="w-3 h-3" strokeWidth={2} />
                          Upload Document
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => {
                            if (e.target.files?.[0]) {
                              complianceAPI.uploadDocument(doc.id, e.target.files[0]).then(() => fetchVehicle()).catch(console.error);
                            }
                          }} />
                        </label>
                      )}
                    </div>


                  </div>
                );
              })}
            </div>
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
                              <a href={c.proofImageUrl.startsWith("http") ? c.proofImageUrl : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${c.proofImageUrl}`} target="_blank" rel="noopener noreferrer"
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
                        <div class="s">${vehicle.make} ${vehicle.model} &bull; ${vehicle.fuelType}</div>
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

          {/* Invoice */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" strokeWidth={2} />
              Vehicle Invoice
            </h3>
            {vehicle.invoiceUrl ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Invoice Uploaded</p>
                    <p className="text-[10px] text-gray-400">Permanent document</p>
                  </div>
                </div>
                <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${vehicle.invoiceUrl}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  View
                </a>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500/50 cursor-pointer transition-colors group">
                <Upload className="w-7 h-7 text-gray-300 dark:text-gray-600 group-hover:text-yellow-500 transition-colors" strokeWidth={1.5} />
                <span className="text-xs text-gray-400 group-hover:text-yellow-600 font-medium mt-1.5">Upload Vehicle Invoice</span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">PDF, JPG, PNG</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => {
                  if (e.target.files?.[0] && params.id) {
                    vehicleAPI.uploadInvoice(params.id as string, e.target.files[0]).then(() => fetchVehicle()).catch(console.error);
                  }
                }} />
              </label>
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

          {/* Document History */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-500" strokeWidth={2} />
              Document History
            </h3>

            {/* Doc type filter tabs */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[...new Set(vehicle.complianceDocuments.map((d: { type: string }) => d.type))].map((t) => (
                <button key={t} onClick={() => handleViewHistory(vehicle.id, t)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${historyDoc === t ? "bg-brand-50 text-brand-600 border border-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-500/30" : "bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}>
                  {DOC_LABELS[t] ? (t.length > 5 ? t.slice(0, 3) : t) : t}
                </button>
              ))}
            </div>

            {!historyDoc ? (
              <p className="text-xs text-gray-400 text-center py-4">Select a document type above to view its history</p>
            ) : historyLoading ? (
              <div className="space-y-2 py-2 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2.5"><div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700" /><div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" /></div>
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            ) : historyData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No history for {DOC_LABELS[historyDoc] || historyDoc.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{DOC_LABELS[historyDoc] || historyDoc.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} &mdash; {historyData.length} record{historyData.length > 1 ? "s" : ""}</p>
                {historyData.map((h) => (
                  <div key={h.id} className={`relative flex items-center justify-between p-3 rounded-xl text-xs transition-all ${h.isActive ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20" : "bg-gray-50 border border-gray-100 dark:bg-gray-800/50 dark:border-gray-700"}`}>
                    {/* Status dot */}
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
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${h.documentUrl}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-medium text-brand-500 hover:text-brand-600 flex-shrink-0">
                        <ExternalLink className="w-3 h-3" strokeWidth={2} />
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tyre Profile */}
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
            {/* Header — single compact row */}
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
              {!editingTyres ? (
                <button onClick={() => { const tyreCount = vehicle.group?.tyreCount || 4; const positions = getTyrePositions(tyreCount); setTyreForm(positions.map((pos) => { const existing = vehicle.tyres.find((t) => t.position === pos); return { position: pos, brand: existing?.brand || "", size: existing?.size || "", installedAt: existing?.installedAt ? existing.installedAt.split("T")[0] : "", kmAtInstall: existing?.kmAtInstall?.toString() || "", condition: existing?.condition || "GOOD" }; })); setEditingTyres(true); }}
                  className="text-[11px] font-semibold text-brand-500 hover:text-brand-600 flex items-center gap-1">
                  <Pencil className="w-3 h-3" />{vehicle.tyres.length > 0 ? "Edit" : "Set Up"}
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={async () => { setSavingTyres(true); try { const tyresData = tyreForm.filter((t) => t.brand || t.size || t.installedAt || t.kmAtInstall).map((t) => ({ position: t.position, brand: t.brand || undefined, size: t.size || undefined, installedAt: t.installedAt || undefined, kmAtInstall: t.kmAtInstall ? parseInt(t.kmAtInstall) : undefined, condition: t.condition })); await vehicleAPI.upsertTyres(vehicle.id, tyresData); const res = await vehicleAPI.getById(vehicle.id); setVehicle(res.data.data); setEditingTyres(false); toast.success("Tyres Updated", "Saved"); } catch { toast.error("Error", "Failed"); } finally { setSavingTyres(false); } }} disabled={savingTyres}
                    className="text-[11px] font-semibold text-white bg-brand-500 hover:bg-brand-600 px-3 py-1 rounded-lg disabled:opacity-50">
                    {savingTyres ? "..." : "Save"}
                  </button>
                  <button onClick={() => setEditingTyres(false)} className="text-[11px] font-semibold text-gray-500 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">Cancel</button>
                </div>
              )}
            </div>

            {/* Content */}
            {!editingTyres ? (
              vehicle.tyres.length === 0 ? (
                <div className="text-center px-5 pb-5">
                  <div className="py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <GiCarWheel className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs font-medium text-gray-400">No tyre data yet</p>
                  </div>
                </div>
              ) : (
                /* View mode — compact card rows */
                <div className="px-5 pb-4 space-y-2">
                  {vehicle.tyres.map((tyre) => {
                    const cond = CONDITION_COLORS[tyre.condition] || CONDITION_COLORS.GOOD;
                    const borderColor = tyre.condition === "GOOD" ? "border-l-emerald-500" : tyre.condition === "AVERAGE" ? "border-l-amber-500" : "border-l-red-500";
                    return (
                      <div key={tyre.id} className={`flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 border-l-[3px] ${borderColor} bg-gray-50/30 dark:bg-gray-800/20`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{TYRE_POSITION_LABELS[tyre.position] || tyre.position}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cond.bg} ${cond.text}`}>{cond.label}</span>
                          </div>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{tyre.brand || "—"}</span>
                            {tyre.size && <span className="text-[10px] font-mono text-gray-400">{tyre.size}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {tyre.installedAt && <p className="text-[10px] text-gray-400">{new Date(tyre.installedAt).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}</p>}
                          {tyre.kmAtInstall != null && <p className="text-[10px] font-semibold text-gray-500">{tyre.kmAtInstall.toLocaleString()} km</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Edit mode — compact stacked cards */
              <div className="px-5 pb-4 space-y-2">
                {tyreForm.map((tyre, idx) => (
                  <div key={tyre.position} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/30 dark:bg-gray-800/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">{TYRE_POSITION_LABELS[tyre.position] || tyre.position}</span>
                      <select value={tyre.condition} onChange={(e) => { const n = [...tyreForm]; n[idx] = { ...n[idx], condition: e.target.value }; setTyreForm(n); }}
                        className="text-[10px] font-semibold rounded-md border border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:border-brand-400">
                        <option value="GOOD">Good</option><option value="AVERAGE">Average</option><option value="REPLACE">Replace</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="text" placeholder="Brand" value={tyre.brand} onChange={(e) => { const n = [...tyreForm]; n[idx] = { ...n[idx], brand: e.target.value }; setTyreForm(n); }}
                        className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                      <input type="text" placeholder="Size" value={tyre.size} onChange={(e) => { const n = [...tyreForm]; n[idx] = { ...n[idx], size: e.target.value }; setTyreForm(n); }}
                        className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                      <input type="date" value={tyre.installedAt} onChange={(e) => { const n = [...tyreForm]; n[idx] = { ...n[idx], installedAt: e.target.value }; setTyreForm(n); }}
                        className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                      <input type="number" placeholder="KM" value={tyre.kmAtInstall} onChange={(e) => { const n = [...tyreForm]; n[idx] = { ...n[idx], kmAtInstall: e.target.value }; setTyreForm(n); }}
                        className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
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
                            {svc.parts.length > 0 && <span>{svc.parts.length} part{svc.parts.length > 1 ? "s" : ""}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">&#8377;{svc.totalCost.toLocaleString("en-IN")}</p>
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditService(svc); }} className="rounded-lg p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      </div>

                      {/* Parts chips */}
                      {svc.parts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {svc.parts.map((p, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {p.name} {p.quantity > 1 && <span className="text-gray-400">x{p.quantity}</span>}
                              <span className="text-gray-400">&#8377;{(p.unitCost * p.quantity).toLocaleString("en-IN")}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Next due info */}
                      {(svc.nextDueDate || svc.nextDueKm) && (
                        <div className="flex items-center gap-3 mt-2.5 text-[10px] text-gray-400">
                          {svc.nextDueDate && (
                            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-semibold" : ""}`}>
                              <Clock className="w-3 h-3" strokeWidth={2} />
                              Next: {new Date(svc.nextDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                          {svc.nextDueKm && <span>Next at {svc.nextDueKm.toLocaleString()} km</span>}
                        </div>
                      )}
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
            {/* Header with steps */}
            <div className={`px-6 py-4 flex-shrink-0 ${svcForm.status === "UPCOMING" ? "bg-gradient-to-r from-blue-600 to-blue-500" : "bg-gradient-to-r from-brand-500 to-brand-400"}`}>
              <h3 className="text-lg font-bold text-white">
                {editingService ? "Edit Service" : svcForm.status === "UPCOMING" ? "Schedule Service" : "Log Service"}
              </h3>
              <div className="flex items-center gap-3 mt-3">
                {[{ n: 1, label: "Service Info" }, { n: 2, label: "Parts & Proof" }].map((s) => (
                  <div key={s.n} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${svcStep >= s.n ? "bg-white text-brand-600" : "bg-white/20 text-white/60"}`}>{s.n}</div>
                    <span className={`text-xs font-medium ${svcStep >= s.n ? "text-white" : "text-white/40"}`}>{s.label}</span>
                    {s.n === 1 && <div className={`w-8 h-0.5 rounded ${svcStep >= 2 ? "bg-white" : "bg-white/20"}`} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* ── STEP 1: Service Info ── */}
              {svcStep === 1 && (
                <>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{svcForm.status === "UPCOMING" ? "Scheduled Date *" : "Service Date *"}</label>
                      <input type="date" value={svcForm.serviceDate} onChange={(e) => { const val = e.target.value; setSvcForm((prev) => ({ ...prev, serviceDate: val, ...(prev.status === "UPCOMING" ? { nextDueDate: val } : {}) })); }}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Odometer (km)</label>
                      <input type="number" placeholder="e.g. 45000" value={svcForm.odometerKm} onChange={(e) => setSvcForm({ ...svcForm, odometerKm: e.target.value })}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Total Cost (&#8377;)</label>
                      <input type="number" placeholder="Auto from parts" value={svcForm.totalCost} onChange={(e) => setSvcForm({ ...svcForm, totalCost: e.target.value })}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Next Due Date</label>
                      <input type="date" value={svcForm.nextDueDate} onChange={(e) => setSvcForm({ ...svcForm, nextDueDate: e.target.value })}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Next Due KM</label>
                      <input type="number" placeholder="50000" value={svcForm.nextDueKm} onChange={(e) => setSvcForm({ ...svcForm, nextDueKm: e.target.value })}
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Notes</label>
                    <input type="text" placeholder="Optional notes..." value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })}
                      className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setSvcStep(2)} disabled={!svcForm.title || !svcForm.serviceDate}
                      className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      Next: Parts & Proof
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </button>
                    <button onClick={() => setShowServiceModal(false)} className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
                  </div>
                </>
              )}

              {/* ── STEP 2: Parts & Proof ── */}
              {svcStep === 2 && (
                <>
                  {/* Parts */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{svcForm.status === "UPCOMING" ? "Parts to be Changed" : "Parts Changed"}</label>
                      <button type="button" onClick={() => setSvcParts([...svcParts, { name: "", quantity: "1", unitCost: "", proofUrl: "", proofFile: null }])}
                        className="text-[10px] font-semibold text-brand-500 hover:text-brand-600 flex items-center gap-0.5">
                        <Plus className="w-3 h-3" strokeWidth={2} />
                        Add Part
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {svcParts.map((part, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/50 dark:bg-gray-800/30">
                          <div className="flex items-center gap-2">
                            <input type="text" placeholder="Part name" value={part.name} onChange={(e) => { const n = [...svcParts]; n[idx] = { ...n[idx], name: e.target.value }; setSvcParts(n); }}
                              className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                            <input type="number" placeholder="Qty" value={part.quantity} onChange={(e) => { const n = [...svcParts]; n[idx] = { ...n[idx], quantity: e.target.value }; setSvcParts(n); }}
                              className="w-14 h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-center text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">&#8377;</span>
                              <input type="number" placeholder="Cost" value={part.unitCost} onChange={(e) => { const n = [...svcParts]; n[idx] = { ...n[idx], unitCost: e.target.value }; setSvcParts(n); }}
                                className="w-22 h-9 rounded-lg border border-gray-200 bg-white pl-5 pr-2 text-xs text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                            </div>
                            {svcParts.length > 1 && (
                              <button type="button" onClick={() => setSvcParts(svcParts.filter((_, i) => i !== idx))} className="w-7 h-9 rounded-lg text-gray-400 hover:text-red-500 flex items-center justify-center">
                                <X className="w-3.5 h-3.5" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                          <div className="mt-1.5">
                            {part.proofFile ? (
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-medium truncate max-w-[160px]">{part.proofFile.name}</span>
                                <button type="button" onClick={() => { const n = [...svcParts]; n[idx] = { ...n[idx], proofFile: null }; setSvcParts(n); }} className="text-red-400 text-[9px]">X</button>
                              </div>
                            ) : part.proofUrl ? (
                              <div className="flex items-center gap-2 text-[10px]">
                                <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"}${part.proofUrl}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">View proof</a>
                                <label className="text-brand-500 font-semibold cursor-pointer">Replace<input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => { const n = [...svcParts]; n[idx] = { ...n[idx], proofFile: e.target.files?.[0] || null, proofUrl: "" }; setSvcParts(n); e.target.value = ""; }} /></label>
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-500 cursor-pointer">
                                <ImageIcon className="w-3 h-3" strokeWidth={2} />
                                Upload proof
                                <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => { const n = [...svcParts]; n[idx] = { ...n[idx], proofFile: e.target.files?.[0] || null }; setSvcParts(n); e.target.value = ""; }} />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {svcParts.some((p) => p.unitCost) && (
                      <p className="text-[10px] text-gray-400 mt-1.5 text-right">Parts total: &#8377;{svcParts.filter((p) => p.name).reduce((sum, p) => sum + (parseFloat(p.unitCost) || 0) * (parseInt(p.quantity) || 1), 0).toLocaleString("en-IN")}</p>
                    )}
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
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { setSvcReceipts([...svcReceipts, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setSvcStep(1)} className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all flex items-center gap-1.5">
                      <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                      Back
                    </button>
                    <button onClick={handleSaveService} disabled={savingService || !svcForm.title || !svcForm.serviceDate}
                      className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      {savingService ? "Saving..." : editingService ? "Update Service" : svcForm.status === "UPCOMING" ? "Schedule Service" : "Add Service"}
                    </button>
                  </div>
                </>
              )}
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
                {DOC_LABELS[vehicle.complianceDocuments.find((d) => d.id === editingExpiry)?.type || ""] || "Document"}
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
                  <DatePicker value={expiryValue} onChange={setExpiryValue} placeholder="Select expiry date" />
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
                {DOC_LABELS[vehicle.complianceDocuments.find((d) => d.id === renewingDoc)?.type || ""] || "Document"}
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
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setRenewFile(e.target.files?.[0] || null)} />
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
                    <img src={viewChallan.proofImageUrl.startsWith("http") ? viewChallan.proofImageUrl : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${viewChallan.proofImageUrl}`} alt="Challan Proof" className="w-full h-48 object-cover" />
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
    </div>
  );
}
