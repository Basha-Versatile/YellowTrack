"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { driverAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import { DriverDetailSkeleton } from "@/components/ui/Skeleton";
import DatePicker from "@/components/ui/DatePicker";
import VerificationLinkShare from "@/components/ui/VerificationLinkShare";
import AddressMapPicker from "@/components/public/AddressMapPicker";
import { ChevronLeft, ChevronRight, Pencil, Upload, FileText, Plus, ExternalLink, RefreshCw, Clock, MapPin, Check, User, Users, Bell, CreditCard, Calendar, Car, Navigation, Camera, Phone, X, Trash2 } from "lucide-react";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

type AddressValue = { address: string; lat: number | null; lng: number | null };
type EditableEC = { name: string; relation: string; phone: string };
type DocChangeField = { field: string; before: unknown; after: unknown };
type DocHistoryEntry = {
  id: string;
  createdAt: string;
  changeType: "CREATED" | "FILE_REPLACED" | "EXPIRY_UPDATED" | "LIFETIME_SET" | "LIFETIME_REMOVED" | "TYPE_RENAMED" | "ARCHIVED";
  fields: DocChangeField[];
  note: string | null;
  changedBy: string | null;
  documentId: string;
  documentUrl: string | null;
  isActive: boolean;
};

const CHANGE_TYPE_LABELS: Record<DocHistoryEntry["changeType"], string> = {
  CREATED: "Document created",
  FILE_REPLACED: "File replaced",
  EXPIRY_UPDATED: "Expiry date updated",
  LIFETIME_SET: "Set to lifetime",
  LIFETIME_REMOVED: "Expiry date added",
  TYPE_RENAMED: "Document renamed",
  ARCHIVED: "Document archived",
};

const CHANGE_TYPE_COLORS: Record<DocHistoryEntry["changeType"], string> = {
  CREATED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  FILE_REPLACED: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  EXPIRY_UPDATED: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  LIFETIME_SET: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
  LIFETIME_REMOVED: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  TYPE_RENAMED: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  ARCHIVED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function formatDocFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  if (value instanceof Date) {
    return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  const str = String(value);
  if (str.startsWith("http")) return "file";
  return str;
}

const FIELD_LABELS: Record<string, string> = {
  expiryDate: "Expiry",
  documentUrl: "File",
  isActive: "Active",
  type: "Type",
  phone: "Phone",
  aadhaarLast4: "Aadhaar",
  bloodGroup: "Blood Group",
  fatherName: "Father's Name",
  motherName: "Mother's Name",
  currentAddress: "Current Address",
  currentAddressLat: "Current Lat",
  currentAddressLng: "Current Lng",
  permanentAddress: "Permanent Address",
  permanentAddressLat: "Permanent Lat",
  permanentAddressLng: "Permanent Lng",
  emergencyContacts: "Emergency Contacts",
  profilePhoto: "Profile Photo",
  currentAddressPhotos: "Current Address Photo",
  permanentAddressPhotos: "Permanent Address Photo",
};

type DriverChangeEntry = {
  id: string;
  createdAt: string;
  changeType: "PROFILE_UPDATED" | "ADDRESS_UPDATED" | "EMERGENCY_CONTACTS_UPDATED" | "PROFILE_PHOTO_UPDATED" | "ADDRESS_PHOTO_ADDED" | "ADDRESS_PHOTO_REMOVED";
  fields: DocChangeField[];
  note: string | null;
  actor: string;
  actorRole: "ADMIN" | "DRIVER";
};

const DRIVER_CHANGE_LABELS: Record<DriverChangeEntry["changeType"], string> = {
  PROFILE_UPDATED: "Profile updated",
  ADDRESS_UPDATED: "Address updated",
  EMERGENCY_CONTACTS_UPDATED: "Emergency contacts updated",
  PROFILE_PHOTO_UPDATED: "Profile photo changed",
  ADDRESS_PHOTO_ADDED: "Address photo added",
  ADDRESS_PHOTO_REMOVED: "Address photo removed",
};

const DRIVER_CHANGE_COLORS: Record<DriverChangeEntry["changeType"], string> = {
  PROFILE_UPDATED: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  ADDRESS_UPDATED: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  EMERGENCY_CONTACTS_UPDATED: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  PROFILE_PHOTO_UPDATED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
  ADDRESS_PHOTO_ADDED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  ADDRESS_PHOTO_REMOVED: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
};

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "empty";
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") return "updated";
  const str = String(value);
  if (str.startsWith("http")) return "file";
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return str.length > 40 ? str.slice(0, 40) + "…" : str;
}

const PHOTO_FIELDS = new Set([
  "profilePhoto",
  "currentAddressPhotos",
  "permanentAddressPhotos",
  "documentUrl",
]);
const ADDRESS_TEXT_FIELDS = new Set(["currentAddress", "permanentAddress"]);

function getViewUrl(field: string, value: unknown): string | null {
  if (!PHOTO_FIELDS.has(field)) return null;
  if (typeof value !== "string" || !value) return null;
  if (!value.startsWith("http") && !value.startsWith("/")) return null;
  return resolveImageUrl(value) ?? value;
}

function getRouteUrl(
  field: string,
  value: unknown,
  side: "before" | "after",
  allFields: DocChangeField[],
): string | null {
  if (!ADDRESS_TEXT_FIELDS.has(field)) return null;
  if (typeof value !== "string" || !value.trim()) return null;
  const prefix = field; // currentAddress | permanentAddress
  const latEntry = allFields.find((f) => f.field === `${prefix}Lat`);
  const lngEntry = allFields.find((f) => f.field === `${prefix}Lng`);
  const lat = latEntry ? (latEntry[side] as number | null) : null;
  const lng = lngEntry ? (lngEntry[side] as number | null) : null;
  const dest =
    lat != null && lng != null
      ? `${lat},${lng}`
      : encodeURIComponent(value);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

interface DriverDoc {
  id: string;
  type: string;
  expiryDate: string | null;
  documentUrl: string | null;
  status: string;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  aadhaarLast4: string | null;
  licenseNumber: string;
  licenseExpiry: string;
  dob: string | null;
  dateOfIssue: string | null;
  vehicleClass: string;
  riskScore: number;
  licenseStatus: string;
  bloodGroup: string | null;
  fatherName: string | null;
  motherName: string | null;
  emergencyContact: string | null;
  emergencyContacts: Array<{ name: string; relation: string; phone: string }> | null;
  currentAddress: string | null;
  currentAddressPhotos: string[];
  permanentAddress: string | null;
  permanentAddressPhotos: string[];
  verificationToken: string | null;
  profilePhoto: string | null;
  currentAddressLat: number | null;
  currentAddressLng: number | null;
  permanentAddressLat: number | null;
  permanentAddressLng: number | null;
  selfVerifiedAt: string | null;
  adminVerified: boolean;
  createdAt: string;
  documents: DriverDoc[];
}

const DOC_TYPES = [
  { value: "DL", label: "Driving License" },
  { value: "MEDICAL", label: "Medical Certificate" },
  { value: "POLICE_VERIFICATION", label: "Police Verification" },
  { value: "AADHAAR", label: "Aadhaar Card" },
  { value: "PAN", label: "PAN Card" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function formatDocType(type: string): string {
  const predefined = DOC_TYPES.find((d) => d.value === type);
  if (predefined) return predefined.label;
  return type
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);
  const [togglingVerify, setTogglingVerify] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  // Upload form
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState("DL");
  const [uploadCustomLabel, setUploadCustomLabel] = useState("");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadLifetime, setUploadLifetime] = useState(false);
  const [editingDocExpiry, setEditingDocExpiry] = useState<string | null>(null);
  const [docExpiryValue, setDocExpiryValue] = useState("");
  const [savingDocExpiry, setSavingDocExpiry] = useState(false);
  const [editDocLifetime, setEditDocLifetime] = useState(false);

  // Renew driver doc
  const [renewingDriverDoc, setRenewingDriverDoc] = useState<string | null>(null);
  const [renewDriverExpiry, setRenewDriverExpiry] = useState("");
  const [renewDriverFile, setRenewDriverFile] = useState<File | null>(null);
  const [renewDriverLoading, setRenewDriverLoading] = useState(false);
  const [renewDriverLifetime, setRenewDriverLifetime] = useState(false);

  // Document history
  const [historyDocType, setHistoryDocType] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<DocHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Driver change log
  const [changeLog, setChangeLog] = useState<DriverChangeEntry[]>([]);
  const [changeLogLoading, setChangeLogLoading] = useState(false);
  const fetchChangeLog = useCallback(async () => {
    setChangeLogLoading(true);
    try {
      const res = await driverAPI.getChangeLog(id);
      setChangeLog(res.data.data || []);
    } catch { /* ignore */ }
    finally { setChangeLogLoading(false); }
  }, [id]);
  useEffect(() => { fetchChangeLog(); }, [fetchChangeLog]);

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "", aadhaarLast4: "", bloodGroup: "", fatherName: "", motherName: "",
  });
  const [currentAddr, setCurrentAddr] = useState<AddressValue>({ address: "", lat: null, lng: null });
  const [permanentAddr, setPermanentAddr] = useState<AddressValue>({ address: "", lat: null, lng: null });
  const [sameAsCurrent, setSameAsCurrent] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<EditableEC[]>([]);
  const [editProfilePhoto, setEditProfilePhoto] = useState<string | null>(null);
  const [currentAddrPhotos, setCurrentAddrPhotos] = useState<string[]>([]);
  const [permanentAddrPhotos, setPermanentAddrPhotos] = useState<string[]>([]);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [uploadingAddrPhoto, setUploadingAddrPhoto] = useState<"current" | "permanent" | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchDriver = useCallback(async () => {
    try {
      const res = await driverAPI.getById(id);
      setDriver(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDriver(); }, [fetchDriver]);

  const openEditProfile = () => {
    if (!driver) return;
    setEditForm({
      phone: driver.phone || "",
      aadhaarLast4: driver.aadhaarLast4 || "",
      bloodGroup: driver.bloodGroup || "",
      fatherName: driver.fatherName || "",
      motherName: driver.motherName || "",
    });
    setCurrentAddr({
      address: driver.currentAddress || "",
      lat: driver.currentAddressLat ?? null,
      lng: driver.currentAddressLng ?? null,
    });
    setPermanentAddr({
      address: driver.permanentAddress || "",
      lat: driver.permanentAddressLat ?? null,
      lng: driver.permanentAddressLng ?? null,
    });
    setSameAsCurrent(false);
    setEmergencyContacts(
      driver.emergencyContacts && driver.emergencyContacts.length > 0
        ? driver.emergencyContacts.map((ec) => ({ name: ec.name, relation: ec.relation, phone: ec.phone }))
        : [{ name: "", relation: "", phone: "" }],
    );
    setEditProfilePhoto(driver.profilePhoto || null);
    setCurrentAddrPhotos(driver.currentAddressPhotos || []);
    setPermanentAddrPhotos(driver.permanentAddressPhotos || []);
    setShowEditProfile(true);
  };

  const updateEC = (index: number, field: keyof EditableEC, value: string) => {
    setEmergencyContacts((prev) => prev.map((ec, i) => (i === index ? { ...ec, [field]: value } : ec)));
  };
  const addEC = () => {
    if (emergencyContacts.length >= 10) return;
    setEmergencyContacts([...emergencyContacts, { name: "", relation: "", phone: "" }]);
  };
  const removeEC = (index: number) => {
    setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProfilePhoto(true);
    try {
      const res = await driverAPI.uploadProfilePhoto(id, file);
      setEditProfilePhoto(res.data.data.profilePhoto);
      toast.success("Photo uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingProfilePhoto(false);
      e.target.value = "";
    }
  };

  const handleAddrPhotoUpload = async (type: "current" | "permanent", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAddrPhoto(type);
    try {
      const res = await driverAPI.uploadAddressPhoto(id, type, file);
      if (type === "current") setCurrentAddrPhotos(res.data.data.photos);
      else setPermanentAddrPhotos(res.data.data.photos);
      toast.success("Photo uploaded");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error("Upload failed", msg);
    } finally {
      setUploadingAddrPhoto(null);
      e.target.value = "";
    }
  };

  const handleRemoveAddrPhoto = async (type: "current" | "permanent", url: string) => {
    try {
      const res = await driverAPI.deleteAddressPhoto(id, type, url);
      if (type === "current") setCurrentAddrPhotos(res.data.data.photos);
      else setPermanentAddrPhotos(res.data.data.photos);
    } catch {
      toast.error("Remove failed");
    }
  };

  const handleSaveProfile = async () => {
    const finalPermanent = sameAsCurrent ? currentAddr : permanentAddr;
    const cleanECs = emergencyContacts
      .filter((ec) => ec.name.trim() && ec.relation.trim() && ec.phone.trim())
      .map((ec) => ({ name: ec.name.trim(), relation: ec.relation.trim(), phone: ec.phone.trim() }));

    setSavingProfile(true);
    try {
      await driverAPI.update(id, {
        ...editForm,
        currentAddress: currentAddr.address || null,
        currentAddressLat: currentAddr.lat,
        currentAddressLng: currentAddr.lng,
        permanentAddress: finalPermanent.address || null,
        permanentAddressLat: finalPermanent.lat,
        permanentAddressLng: finalPermanent.lng,
        emergencyContacts: cleanECs.length > 0 ? cleanECs : null,
        profilePhoto: editProfilePhoto,
      });
      setShowEditProfile(false);
      toast.success("Profile Updated", "Driver details saved successfully");
      fetchDriver();
      fetchChangeLog();
    } catch (err) {
      console.error(err);
      toast.error("Update Failed", "Could not save driver details");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) { setUploadError("File is required"); return; }
    if (!uploadLifetime && !uploadExpiry) { setUploadError("Expiry date is required (or select Lifetime)"); return; }
    const finalType = uploadType === "OTHER" ? uploadCustomLabel.trim() : uploadType;
    if (!finalType) { setUploadError("Please enter a document name"); return; }
    setUploading(true); setUploadError("");
    try {
      await driverAPI.uploadDocument(id, uploadFile, finalType, uploadLifetime ? undefined : uploadExpiry, uploadLifetime);
      setShowUpload(false); setUploadFile(null); setUploadExpiry(""); setUploadLifetime(false); setUploadCustomLabel("");
      toast.success("Document Uploaded", "Driver document uploaded successfully");
      fetchDriver();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setUploadError(error.response?.data?.message || "Upload failed");
      toast.error("Upload Failed", error.response?.data?.message);
    } finally { setUploading(false); }
  };

  const handleRenewDriverDoc = async () => {
    if (!renewingDriverDoc || (!renewDriverLifetime && !renewDriverExpiry)) return;
    setRenewDriverLoading(true);
    try {
      const doc = driver?.documents.find((d) => d.id === renewingDriverDoc);
      if (!doc) return;
      await driverAPI.renewDocument(id, doc.id, { type: doc.type, expiryDate: renewDriverLifetime ? undefined : renewDriverExpiry, lifetime: renewDriverLifetime }, renewDriverFile || undefined);
      setRenewingDriverDoc(null); setRenewDriverExpiry(""); setRenewDriverFile(null); setRenewDriverLifetime(false);
      toast.success("Document Renewed", "Old document archived, new one created");
      fetchDriver();
    } catch (err) { console.error(err); toast.error("Renew Failed"); }
    finally { setRenewDriverLoading(false); }
  };

  const handleDocExpiryUpdate = async (docId: string) => {
    if (!editDocLifetime && !docExpiryValue) return;
    setSavingDocExpiry(true);
    try {
      await driverAPI.updateDocExpiry(docId, editDocLifetime ? undefined : docExpiryValue, editDocLifetime);
      setEditingDocExpiry(null);
      setDocExpiryValue("");
      setEditDocLifetime(false);
      toast.success("Expiry Updated", editDocLifetime ? "Document set to lifetime validity" : "Document expiry date updated");
      fetchDriver();
    } catch (err) { console.error(err); toast.error("Update Failed"); }
    finally { setSavingDocExpiry(false); }
  };

  const handleViewDocHistory = async (driverId: string, docType: string) => {
    if (historyDocType === docType) { setHistoryDocType(null); return; }
    setHistoryDocType(docType); setHistoryLoading(true);
    try {
      const res = await driverAPI.getDocHistory(driverId, docType);
      setHistoryData(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setHistoryLoading(false); }
  };

  const daysUntilExpiry = driver
    ? Math.ceil((new Date(driver.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  if (loading) return <DriverDetailSkeleton />;

  if (!driver) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-gray-500">Driver not found</p>
        <Link href="/drivers" className="text-brand-500 hover:underline text-sm">Back to drivers</Link>
      </div>
    );
  }

  const inputClass = "w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-yellow-500 transition-all";

  const statusColor = driver.licenseStatus === "GREEN" ? "success" : driver.licenseStatus === "YELLOW" ? "warning" : driver.licenseStatus === "ORANGE" ? "orange" : "error";
  const statusLabel = driver.licenseStatus === "GREEN" ? "Active" : driver.licenseStatus === "YELLOW" ? "Expiring Soon" : driver.licenseStatus === "ORANGE" ? "Critical" : "Expired";

  return (
    <div className="space-y-6">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl shadow-gray-200/40 dark:shadow-none">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-950" />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-yellow-500/10 blur-[80px]" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 rounded-full bg-yellow-400/5 blur-[60px]" />
        <div className="absolute top-8 right-12 w-40 h-40 rounded-full border border-yellow-500/10" />
        <div className="absolute top-4 right-8 w-40 h-40 rounded-full border border-yellow-500/5" />

        <div className="relative z-10 px-6 sm:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Back + Avatar */}
            <div className="flex items-center gap-4">
              <Link href="/drivers" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all border border-white/10">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              {driver.profilePhoto ? (
                <img src={(resolveImageUrl(driver.profilePhoto) ?? "")} alt={driver.name}
                  className="w-20 h-20 rounded-2xl object-cover shadow-2xl shadow-yellow-500/30 ring-4 ring-white/10 cursor-pointer hover:ring-white/40 transition-all"
                  onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: (resolveImageUrl(driver.profilePhoto) ?? ""), x: r.right + 16, y: r.top + r.height / 2 }); }}
                  onMouseLeave={() => setHoverPhoto(null)} />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-yellow-500/30 ring-4 ring-white/10">
                  {driver.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
              )}
            </div>

            {/* Name + Meta */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-black text-white tracking-tight">{driver.name}</h1>
                <Badge color={statusColor} variant="light" size="sm">{statusLabel}</Badge>
                {driver.selfVerifiedAt ? (
                  <button
                    disabled={togglingVerify}
                    onClick={async () => {
                      setTogglingVerify(true);
                      try {
                        await driverAPI.toggleVerification(driver.id);
                        setDriver((prev) => prev ? { ...prev, adminVerified: !prev.adminVerified } : prev);
                        toast.success(driver.adminVerified ? "Unverified" : "Verified", driver.adminVerified ? "Driver can now edit their profile" : "Driver profile locked");
                      } catch { toast.error("Failed", "Could not toggle verification"); }
                      finally { setTogglingVerify(false); }
                    }}
                    className="flex items-center gap-2 cursor-pointer disabled:cursor-wait"
                  >
                    <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${togglingVerify ? "bg-white/30 animate-pulse" : driver.adminVerified ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-white/20"}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${togglingVerify ? "left-[10px]" : driver.adminVerified ? "left-[22px]" : "left-0.5"}`} />
                    </div>
                    <span className={`text-[10px] font-bold ${togglingVerify ? "text-white/40" : driver.adminVerified ? "text-emerald-300" : "text-white/50"}`}>
                      {togglingVerify ? "..." : driver.adminVerified ? "Verified" : "Unverified"}
                    </span>
                  </button>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/40 text-[10px] font-bold">Pending Submission</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  {driver.licenseNumber}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Joined {new Date(driver.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Car className="w-4 h-4" />
                  {driver.vehicleClass}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={openEditProfile}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-all">
                <Pencil className="w-4 h-4" />
                Edit Profile
              </button>
              <button onClick={() => {
                const available = DOC_TYPES.filter((dt) => !driver.documents.some((d) => d.type === dt.value));
                if (available.length === 0) { toast.warning("All Uploaded", "All document types are already uploaded. Use Renew to update."); return; }
                setUploadType(available[0].value);
                setShowUpload(!showUpload);
              }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all">
                <Upload className="w-4 h-4" />
                Upload Document
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: "License Expiry", value: new Date(driver.licenseExpiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25" },
              { label: "Days to Expiry", value: daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : "Expired", icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", color: daysUntilExpiry > 30 ? "text-emerald-400" : daysUntilExpiry > 0 ? "text-yellow-400" : "text-red-400" },
              { label: "Documents", value: `${driver.documents.length} / ${DOC_TYPES.length}`, icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" },
              { label: "Risk Score", value: `${driver.riskScore}`, icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} /></svg>
                  <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">{stat.label}</span>
                </div>
                <p className={`text-lg font-bold ${stat.color || "text-white"}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Verification Link */}
      {driver.verificationToken && (
        <VerificationLinkShare token={driver.verificationToken} driverName={driver.name} />
      )}

      {/* Upload Panel */}
      {showUpload && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50/50 p-5 dark:border-yellow-500/20 dark:bg-yellow-500/5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Upload Driver Document</h3>
          <form onSubmit={handleUpload} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Document Type</label>
                <select value={uploadType} onChange={(e) => { setUploadType(e.target.value); if (e.target.value !== "OTHER") setUploadCustomLabel(""); }} className={inputClass}>
                  {DOC_TYPES.map((dt) => {
                    const exists = driver.documents.some((d) => d.type === dt.value);
                    return <option key={dt.value} value={dt.value}>{dt.label}{exists ? " (replace)" : ""}</option>;
                  })}
                  <option value="OTHER">Other / Custom…</option>
                </select>
                {uploadType === "OTHER" && (
                  <input type="text" placeholder="e.g. Trade License, NOC" value={uploadCustomLabel} onChange={(e) => setUploadCustomLabel(e.target.value)} maxLength={60}
                    className={`${inputClass} mt-2`} />
                )}
              </div>
              {!uploadLifetime && (
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Expiry Date</label>
                  <DatePicker value={uploadExpiry} onChange={setUploadExpiry} placeholder="Select expiry date" />
                </div>
              )}
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Document File</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-yellow-700 hover:file:bg-yellow-100 dark:text-gray-400 dark:file:bg-yellow-500/10 dark:file:text-yellow-400" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={uploadLifetime} onChange={(e) => { setUploadLifetime(e.target.checked); if (e.target.checked) setUploadExpiry(""); }}
                  className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Lifetime validity (no expiry)</span>
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={uploading}
                  className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50 whitespace-nowrap transition-all">
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button type="button" onClick={() => { setShowUpload(false); setUploadError(""); setUploadLifetime(false); }}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Cancel</button>
              </div>
            </div>
          </form>
          {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
        </div>
      )}

      {/* ── MAIN CONTENT GRID ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column — Profile Info + Address */}
        <div className="space-y-6">
          {/* Personal Details Card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-yellow-500" />
                Personal Details
              </h3>
              <button onClick={openEditProfile} className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
            <div className="p-6 space-y-0">
              <InfoRow icon="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" label="Phone" value={driver.phone ? `+91 ${driver.phone}` : "Not provided"} />
              <InfoRow icon="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" label="Aadhaar" value={driver.aadhaarLast4 ? `XXXX-XXXX-${driver.aadhaarLast4}` : "Not provided"} />
              <InfoRow icon="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" label="Blood Group" value={driver.bloodGroup || "Not provided"} highlight={!!driver.bloodGroup} />
              <InfoRow icon="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" label="License" value={driver.licenseNumber} />
              <InfoRow icon="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375" label="Vehicle Class" value={driver.vehicleClass} />
              <InfoRow icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" label="Date of Birth" value={driver.dob ? new Date(driver.dob).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not available"} />
              <InfoRow icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25" label="Date of Initial Issue" value={driver.dateOfIssue ? new Date(driver.dateOfIssue).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not available"} />
            </div>
          </div>

          {/* Family & Emergency Card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-yellow-500" />
                Family & Emergency
              </h3>
              <button onClick={openEditProfile} className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
            <div className="p-6 space-y-0">
              <InfoRow icon="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" label="Father's Name" value={driver.fatherName || "Not provided"} />
              <InfoRow icon="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" label="Mother's Name" value={driver.motherName || "Not provided"} />
            </div>
            {/* Emergency Contacts */}
            {driver.emergencyContacts && driver.emergencyContacts.length > 0 && (
              <div className="px-6 pb-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Emergency Contacts ({driver.emergencyContacts.length})</p>
                <div className="space-y-2">
                  {driver.emergencyContacts.map((ec, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ec.name}</p>
                        <p className="text-xs text-gray-500">{ec.relation} &bull; +91 {ec.phone}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column — Documents + Address */}
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-yellow-500" />
                Documents ({driver.documents.length})
              </h3>
              <button onClick={() => {
                setUploadType(DOC_TYPES[0].value);
                setShowUpload(true);
              }} className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                Upload
              </button>
            </div>

            <div className="p-6">
              {driver.documents.length === 0 ? (
                <div className="p-10 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-center">
                  <FileText className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" strokeWidth={1} />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">No documents uploaded yet</p>
                  <p className="text-xs text-gray-400 mb-3">Upload driving license, medical certificate, or other documents</p>
                  <button onClick={() => { setUploadType(DOC_TYPES[0].value); setShowUpload(true); }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700">
                    <Plus className="w-4 h-4" />
                    Upload first document
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {driver.documents.map((doc) => {
                    const docExpDays = doc.expiryDate ? Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                    const docStatus = docExpDays === null ? "GREEN" : docExpDays > 30 ? "GREEN" : docExpDays > 7 ? "YELLOW" : docExpDays > 0 ? "ORANGE" : "RED";
                    const docLabel = formatDocType(doc.type);
                    const statusBg = docStatus === "GREEN" ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                      : docStatus === "YELLOW" ? "border-yellow-200 bg-yellow-50/50 dark:border-yellow-500/20 dark:bg-yellow-500/5"
                      : docStatus === "ORANGE" ? "border-orange-200 bg-orange-50/50 dark:border-orange-500/20 dark:bg-orange-500/5"
                      : "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5";
                    const dotColor = docStatus === "GREEN" ? "bg-emerald-500" : docStatus === "YELLOW" ? "bg-yellow-500" : docStatus === "ORANGE" ? "bg-orange-500" : "bg-red-500";

                    return (
                      <div key={doc.id} className={`p-5 rounded-xl border-2 transition-all hover:shadow-md ${statusBg}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${docStatus === "GREEN" ? "bg-emerald-100 dark:bg-emerald-500/20" : docStatus === "YELLOW" ? "bg-yellow-100 dark:bg-yellow-500/20" : docStatus === "ORANGE" ? "bg-orange-100 dark:bg-orange-500/20" : "bg-red-100 dark:bg-red-500/20"}`}>
                              <FileText className={`w-5 h-5 ${docStatus === "GREEN" ? "text-emerald-600" : docStatus === "YELLOW" ? "text-yellow-600" : docStatus === "ORANGE" ? "text-orange-600" : "text-red-600"}`} />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{docLabel}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                <span className="text-[11px] font-medium text-gray-500">{docStatus === "GREEN" ? "Valid" : docStatus === "YELLOW" ? "Expiring" : docStatus === "ORANGE" ? "Critical" : "Expired"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-3">
                          <Clock className="w-3.5 h-3.5" />
                          {doc.expiryDate
                            ? <>{new Date(doc.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{docExpDays !== null && docExpDays > 0 && <span className="text-gray-400">({docExpDays}d left)</span>}</>
                            : <span className="text-emerald-600 dark:text-emerald-400 font-medium">Lifetime</span>}
                          <button onClick={() => { setEditingDocExpiry(doc.id); setEditDocLifetime(!doc.expiryDate); setDocExpiryValue(doc.expiryDate ? new Date(doc.expiryDate).toISOString().split("T")[0] : ""); }}
                            className="text-yellow-500 hover:text-yellow-600 ml-1" title="Edit expiry">
                            <Pencil className="w-3 h-3" />
                          </button>
                        </p>
                        <div className="flex items-center gap-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                          {doc.documentUrl ? (
                            <>
                              <a href={(resolveImageUrl(doc.documentUrl) ?? "")} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-600 hover:text-yellow-700 dark:text-yellow-400">
                                <ExternalLink className="w-3.5 h-3.5" />
                                View File
                              </a>
                              <span className="text-gray-200 dark:text-gray-700">|</span>
                              <button onClick={() => { setRenewingDriverDoc(doc.id); setRenewDriverExpiry(""); setRenewDriverFile(null); }}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
                                <RefreshCw className="w-3.5 h-3.5" />
                                Renew
                              </button>
                              <span className="text-gray-200 dark:text-gray-700">|</span>
                              <button onClick={() => handleViewDocHistory(driver.id, doc.type)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                                <Clock className="w-3.5 h-3.5" />
                                History
                              </button>
                            </>
                          ) : (
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />
                              Upload File
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => {
                                if (e.target.files?.[0]) driverAPI.uploadDocument(id, e.target.files[0], doc.type, doc.expiryDate ? new Date(doc.expiryDate).toISOString().split("T")[0] : undefined, !doc.expiryDate).then(() => fetchDriver()).catch(console.error);
                              }} />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Document History */}
            {historyDocType && (
              <div className="px-6 pb-6">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {formatDocType(historyDocType)} History
                    </h4>
                    <button onClick={() => setHistoryDocType(null)} className="text-xs text-gray-400 hover:text-gray-600">&times; Close</button>
                  </div>
                  {historyLoading ? (
                    <div className="py-4 text-center text-xs text-gray-400">Loading...</div>
                  ) : historyData.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">No history found</div>
                  ) : (
                    <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-4">
                      {historyData.map((h) => (
                        <li key={h.id} className="ml-5">
                          <span className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full mt-1.5 ${h.isActive ? "bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-500/30" : "bg-gray-300 dark:bg-gray-600"}`} />
                          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 p-3">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${CHANGE_TYPE_COLORS[h.changeType]}`}>
                                  {CHANGE_TYPE_LABELS[h.changeType]}
                                </span>
                                {h.isActive && h.changeType !== "ARCHIVED" && (
                                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-500/20">CURRENT</span>
                                )}
                              </div>
                              <time className="text-[10px] text-gray-400 whitespace-nowrap">
                                {new Date(h.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </time>
                            </div>
                            {h.fields.length > 0 && (
                              <ul className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                                {h.fields.map((f, i) => (
                                  <li key={i} className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{FIELD_LABELS[f.field] ?? f.field}:</span>
                                    <span className="line-through text-gray-400">{formatDocFieldValue(f.before)}</span>
                                    <ChevronRight className="w-3 h-3 text-gray-300" />
                                    <span className="text-gray-800 dark:text-gray-200">{formatDocFieldValue(f.after)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {h.note && <p className="mt-1 text-[11px] italic text-gray-500 dark:text-gray-400">{h.note}</p>}
                            {h.changedBy && <p className="text-[10px] text-gray-400 mt-1">by {h.changedBy}</p>}
                            {h.documentUrl && (
                              <a href={resolveImageUrl(h.documentUrl) ?? ""} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 font-medium">
                                <ExternalLink className="w-3 h-3" /> View file
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Address Card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-yellow-500" />
                Address
              </h3>
              <button onClick={openEditProfile} className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
            <div className="p-6">
              {driver.currentAddress || driver.permanentAddress ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AddressBlock label="Current Address" address={driver.currentAddress} lat={driver.currentAddressLat} lng={driver.currentAddressLng} icon="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    <AddressBlock label="Permanent Address" address={driver.permanentAddress} lat={driver.permanentAddressLat} lng={driver.permanentAddressLng} icon="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </div>
                  {/* Address Photos */}
                  {(driver.currentAddressPhotos?.length > 0 || driver.permanentAddressPhotos?.length > 0) && (
                    <div className="space-y-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                      {driver.currentAddressPhotos?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Current Address Photos ({driver.currentAddressPhotos.length})</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {driver.currentAddressPhotos.map((url, i) => (
                              <button key={i} type="button"
                                onClick={() => setLightbox({ images: driver.currentAddressPhotos.map((u) => (resolveImageUrl(u) ?? "")), index: i })}
                                className="aspect-[4/3] rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-yellow-400 hover:shadow-lg transition-all cursor-pointer">
                                <img src={(resolveImageUrl(url) ?? "")} alt={`Current address ${i + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {driver.permanentAddressPhotos?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Permanent Address Photos ({driver.permanentAddressPhotos.length})</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {driver.permanentAddressPhotos.map((url, i) => (
                              <button key={i} type="button"
                                onClick={() => setLightbox({ images: driver.permanentAddressPhotos.map((u) => (resolveImageUrl(u) ?? "")), index: i })}
                                className="aspect-[4/3] rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-yellow-400 hover:shadow-lg transition-all cursor-pointer">
                                <img src={(resolveImageUrl(url) ?? "")} alt={`Permanent address ${i + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MapPin className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" strokeWidth={1} />
                  <p className="text-sm text-gray-400 mb-1">No address added yet</p>
                  <button onClick={openEditProfile} className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700">+ Add Address</button>
                </div>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                Activity Log
              </h3>
              {changeLog.length > 0 && (
                <span className="text-[11px] text-gray-400">{changeLog.length} {changeLog.length === 1 ? "entry" : "entries"}</span>
              )}
            </div>
            <div className="p-6">
              {changeLogLoading ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
              ) : changeLog.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No edits recorded yet. Changes to profile, addresses, photos, and emergency contacts will appear here.</p>
              ) : (
                <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-4">
                  {changeLog.map((entry) => (
                    <li key={entry.id} className="ml-5">
                      <span className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full mt-1.5 ${entry.actorRole === "ADMIN" ? "bg-yellow-400 ring-2 ring-yellow-100 dark:ring-yellow-500/30" : "bg-blue-400 ring-2 ring-blue-100 dark:ring-blue-500/30"}`} />
                      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${DRIVER_CHANGE_COLORS[entry.changeType]}`}>
                              {DRIVER_CHANGE_LABELS[entry.changeType]}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${entry.actorRole === "ADMIN" ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400" : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"}`}>
                              {entry.actorRole === "ADMIN" ? "Admin" : "Driver"}
                            </span>
                            <span className="text-[11px] text-gray-600 dark:text-gray-400">{entry.actor}</span>
                          </div>
                          <time className="text-[10px] text-gray-400 whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </div>
                        {entry.fields.length > 0 && (
                          <ul className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                            {entry.fields.map((f, i) => {
                              const beforeView = getViewUrl(f.field, f.before);
                              const afterView = getViewUrl(f.field, f.after);
                              const beforeRoute = getRouteUrl(f.field, f.before, "before", entry.fields);
                              const afterRoute = getRouteUrl(f.field, f.after, "after", entry.fields);
                              return (
                                <li key={i} className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">{FIELD_LABELS[f.field] ?? f.field}:</span>
                                  <span className="line-through text-gray-400">{formatChangeValue(f.before)}</span>
                                  {beforeView && (
                                    <a href={beforeView} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-yellow-600 dark:text-yellow-400 hover:underline font-medium">
                                      <ExternalLink className="w-3 h-3" />View
                                    </a>
                                  )}
                                  {beforeRoute && (
                                    <a href={beforeRoute} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline font-medium">
                                      <Navigation className="w-3 h-3" />Route
                                    </a>
                                  )}
                                  <ChevronRight className="w-3 h-3 text-gray-300" />
                                  <span className="text-gray-800 dark:text-gray-200">{formatChangeValue(f.after)}</span>
                                  {afterView && (
                                    <a href={afterView} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-yellow-600 dark:text-yellow-400 hover:underline font-medium">
                                      <ExternalLink className="w-3 h-3" />View
                                    </a>
                                  )}
                                  {afterRoute && (
                                    <a href={afterRoute} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline font-medium">
                                      <Navigation className="w-3 h-3" />Route
                                    </a>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {entry.note && <p className="mt-1 text-[11px] italic text-gray-500 dark:text-gray-400">{entry.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── EDIT PROFILE MODAL ── */}
      {showEditProfile && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditProfile(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-950 px-6 py-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Driver Profile</h3>
                  <p className="text-white/50 text-sm">{driver.name} &mdash; {driver.licenseNumber}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Personal */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center"><User className="w-3 h-3 text-yellow-600" /></span>
                  Personal Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</label>
                    <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+91</span><input type="tel" placeholder="9876543210" maxLength={10} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={`${inputClass} pl-12`} /></div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Blood Group</label>
                    <select value={editForm.bloodGroup} onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })} className={inputClass}>
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aadhaar (Last 4)</label>
                    <input type="text" placeholder="1234" maxLength={4} value={editForm.aadhaarLast4} onChange={(e) => setEditForm({ ...editForm, aadhaarLast4: e.target.value })} className={`${inputClass} font-mono tracking-widest text-center`} />
                  </div>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

              {/* Family */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center"><Users className="w-3 h-3 text-yellow-600" /></span>
                  Family
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Father&apos;s Name</label><input type="text" placeholder="Father's full name" value={editForm.fatherName} onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })} className={inputClass} /></div>
                  <div><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mother&apos;s Name</label><input type="text" placeholder="Mother's full name" value={editForm.motherName} onChange={(e) => setEditForm({ ...editForm, motherName: e.target.value })} className={inputClass} /></div>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

              {/* Profile Photo */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center"><Camera className="w-3 h-3 text-yellow-600" /></span>
                  Profile Photo
                </h4>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    {editProfilePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveImageUrl(editProfilePhoto) ?? undefined} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700 transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingProfilePhoto ? "Uploading…" : editProfilePhoto ? "Replace Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} disabled={uploadingProfilePhoto} />
                    </label>
                    {editProfilePhoto && (
                      <button type="button" onClick={() => setEditProfilePhoto(null)}
                        className="ml-2 inline-flex items-center gap-1 h-10 px-3 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

              {/* Current Address */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center"><MapPin className="w-3 h-3 text-yellow-600" /></span>
                  Current Address
                </h4>
                <AddressMapPicker label="" value={currentAddr} onChange={setCurrentAddr} />
                {/* Current address photos */}
                <div className="mt-3">
                  <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proof Photos ({currentAddrPhotos.length}/5)</label>
                  <div className="flex flex-wrap gap-2">
                    {currentAddrPhotos.map((url) => (
                      <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolveImageUrl(url) ?? undefined} alt="Address proof" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleRemoveAddrPhoto("current", url)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {currentAddrPhotos.length < 5 && (
                      <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 hover:border-yellow-400 hover:text-yellow-500 cursor-pointer transition-all">
                        {uploadingAddrPhoto === "current" ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <><Camera className="w-5 h-5" /><span className="text-[9px] mt-0.5 font-medium">Add</span></>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAddrPhotoUpload("current", e)} disabled={uploadingAddrPhoto !== null} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Permanent Address */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center"><MapPin className="w-3 h-3 text-yellow-600" /></span>
                    Permanent Address
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={sameAsCurrent} onChange={(e) => setSameAsCurrent(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400" />
                    <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Same as current</span>
                  </label>
                </div>
                <AddressMapPicker
                  label=""
                  value={sameAsCurrent ? currentAddr : permanentAddr}
                  onChange={setPermanentAddr}
                  disabled={sameAsCurrent}
                />
                {!sameAsCurrent && (
                  <div className="mt-3">
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proof Photos ({permanentAddrPhotos.length}/5)</label>
                    <div className="flex flex-wrap gap-2">
                      {permanentAddrPhotos.map((url) => (
                        <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resolveImageUrl(url) ?? undefined} alt="Address proof" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => handleRemoveAddrPhoto("permanent", url)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {permanentAddrPhotos.length < 5 && (
                        <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 hover:border-yellow-400 hover:text-yellow-500 cursor-pointer transition-all">
                          {uploadingAddrPhoto === "permanent" ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <><Camera className="w-5 h-5" /><span className="text-[9px] mt-0.5 font-medium">Add</span></>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAddrPhotoUpload("permanent", e)} disabled={uploadingAddrPhoto !== null} />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

              {/* Emergency Contacts */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center"><Phone className="w-3 h-3 text-yellow-600" /></span>
                    Emergency Contacts
                  </h4>
                  <button type="button" onClick={addEC} disabled={emergencyContacts.length >= 10}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-600 hover:text-yellow-700 disabled:opacity-40">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {emergencyContacts.map((ec, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                      <input type="text" placeholder="Name" value={ec.name} onChange={(e) => updateEC(i, "name", e.target.value)}
                        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/10 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                      <input type="text" placeholder="Relation" value={ec.relation} onChange={(e) => updateEC(i, "relation", e.target.value)}
                        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/10 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                      <input type="tel" placeholder="Phone" maxLength={10} value={ec.phone} onChange={(e) => updateEC(i, "phone", e.target.value.replace(/\D/g, ""))}
                        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/10 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                      <button type="button" onClick={() => removeEC(i)}
                        className="w-10 h-10 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/30">
              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {savingProfile ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>) : (<><Check className="w-4 h-4" />Save Changes</>)}
              </button>
              <button onClick={() => setShowEditProfile(false)}
                className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expiry Modal */}
      {editingDocExpiry && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setEditingDocExpiry(null); setDocExpiryValue(""); }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-400 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Edit Expiry Date</h3>
              <p className="text-white/70 text-sm mt-0.5">{(() => { const t = driver.documents.find((doc) => doc.id === editingDocExpiry)?.type; return t ? formatDocType(t) : "Document"; })()}</p>
            </div>
            <div className="p-6 space-y-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editDocLifetime} onChange={(e) => { setEditDocLifetime(e.target.checked); if (e.target.checked) setDocExpiryValue(""); }}
                  className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lifetime validity (no expiry)</span>
              </label>
              {!editDocLifetime && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">New Expiry Date</label>
                  <DatePicker value={docExpiryValue} onChange={setDocExpiryValue} placeholder="Select expiry date" />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => handleDocExpiryUpdate(editingDocExpiry)} disabled={savingDocExpiry || (!editDocLifetime && !docExpiryValue)}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 transition-all disabled:opacity-50 flex items-center justify-center">
                  {savingDocExpiry ? "Saving..." : editDocLifetime ? "Set Lifetime" : "Update Expiry"}
                </button>
                <button onClick={() => { setEditingDocExpiry(null); setDocExpiryValue(""); setEditDocLifetime(false); }}
                  className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renew Driver Doc Modal */}
      {renewingDriverDoc && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setRenewingDriverDoc(null); setRenewDriverExpiry(""); setRenewDriverFile(null); }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Renew Document</h3>
              <p className="text-white/70 text-sm mt-0.5">{(() => { const t = driver.documents.find((doc) => doc.id === renewingDriverDoc)?.type; return t ? formatDocType(t) : "Document"; })()}</p>
            </div>
            <div className="p-6 space-y-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={renewDriverLifetime} onChange={(e) => { setRenewDriverLifetime(e.target.checked); if (e.target.checked) setRenewDriverExpiry(""); }}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lifetime validity (no expiry)</span>
              </label>
              {!renewDriverLifetime && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">New Expiry Date</label>
                  <DatePicker value={renewDriverExpiry} onChange={setRenewDriverExpiry} placeholder="Select new expiry date" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Upload New Document <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                <label className={`flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${renewDriverFile ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5" : "border-gray-200 dark:border-gray-700 hover:border-emerald-400"}`}>
                  {renewDriverFile ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <Check className="w-4 h-4" />
                      <span className="font-medium truncate max-w-[200px]">{renewDriverFile.name}</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); setRenewDriverFile(null); }} className="text-red-500 hover:text-red-600 ml-1">&times;</button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                      <span className="text-xs text-gray-400 mt-1">Click to upload (PDF, JPG, PNG)</span>
                    </>
                  )}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setRenewDriverFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={handleRenewDriverDoc} disabled={renewDriverLoading || (!renewDriverLifetime && !renewDriverExpiry)}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {renewDriverLoading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Renewing...</>) : "Renew Document"}
                </button>
                <button onClick={() => { setRenewingDriverDoc(null); setRenewDriverExpiry(""); setRenewDriverFile(null); }}
                  className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hoverPhoto && (
        <div className="fixed z-[99999] pointer-events-none" style={{ left: hoverPhoto.x, top: hoverPhoto.y, transform: "translateY(-50%)" }}>
          <img src={hoverPhoto.url} alt="Driver" className="w-52 h-52 rounded-2xl object-cover shadow-2xl ring-4 ring-white dark:ring-gray-900" />
        </div>
      )}

      {/* Image Lightbox / Slider */}
      {lightbox && (
        <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col" onClick={() => setLightbox(null)}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
            <p className="text-white/70 text-sm">{lightbox.index + 1} / {lightbox.images.length}</p>
            <button onClick={() => setLightbox(null)} className="text-white/70 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">Close</button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-4 min-h-0" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.images[lightbox.index]} alt={`Photo ${lightbox.index + 1}`}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 py-6 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button disabled={lightbox.index === 0}
              onClick={() => setLightbox({ ...lightbox, index: lightbox.index - 1 })}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 flex items-center justify-center text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {lightbox.images.map((_, i) => (
                <button key={i} onClick={() => setLightbox({ ...lightbox, index: i })}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i === lightbox.index ? "bg-white scale-125" : "bg-white/30 hover:bg-white/50"}`} />
              ))}
            </div>

            <button disabled={lightbox.index === lightbox.images.length - 1}
              onClick={() => setLightbox({ ...lightbox, index: lightbox.index + 1 })}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 flex items-center justify-center text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, highlight, valueClass = "" }: { icon: string; label: string; value: string; highlight?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${highlight ? "bg-yellow-50 dark:bg-yellow-500/10" : "bg-gray-50 dark:bg-gray-800 group-hover:bg-yellow-50 dark:group-hover:bg-yellow-500/10"}`}>
        <svg className={`w-4 h-4 transition-colors ${highlight ? "text-yellow-500" : "text-gray-400 group-hover:text-yellow-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        <p className={`text-sm font-semibold text-gray-800 dark:text-gray-200 truncate ${valueClass} ${value === "Not provided" ? "!text-gray-300 dark:!text-gray-600 !font-normal italic" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function AddressBlock({
  label,
  address,
  icon,
  lat,
  lng,
}: {
  label: string;
  address: string | null;
  icon: string;
  lat?: number | null;
  lng?: number | null;
}) {
  if (!address) return null;

  // Prefer precise coords when available (Google Maps will pinpoint them);
  // fall back to the address string (Google Maps will geocode).
  // Omitting `origin` makes Google Maps use the user's current location by default —
  // it prompts for location permission on first use.
  const destination =
    lat != null && lng != null ? `${lat},${lng}` : address;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination,
  )}&travelmode=driving`;

  return (
    <div className="relative rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open directions in Google Maps (from your location to ${address})`}
          className="inline-flex items-center gap-1 rounded-md bg-white/70 dark:bg-gray-900/40 px-2 py-1 text-[10px] font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:text-brand-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300 border border-brand-200 dark:border-brand-500/20 transition-colors"
        >
          <Navigation className="w-3 h-3" strokeWidth={2.2} />
          Route
        </a>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{address}</p>
    </div>
  );
}
