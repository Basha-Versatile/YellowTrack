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
import { ChevronLeft, ChevronRight, Pencil, Upload, FileText, Plus, ExternalLink, RefreshCw, Clock, MapPin, Check, User, Users, Bell, CreditCard, Calendar, Car } from "lucide-react";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

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
  const [historyData, setHistoryData] = useState<DriverDoc[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "", aadhaarLast4: "", bloodGroup: "", fatherName: "", motherName: "",
    currentAddress: "", permanentAddress: "",
  });
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
      currentAddress: driver.currentAddress || "",
      permanentAddress: driver.permanentAddress || "",
    });
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await driverAPI.update(id, editForm);
      setShowEditProfile(false);
      toast.success("Profile Updated", "Driver details saved successfully");
      fetchDriver();
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
    setUploading(true); setUploadError("");
    try {
      await driverAPI.uploadDocument(id, uploadFile, uploadType, uploadLifetime ? undefined : uploadExpiry, uploadLifetime);
      setShowUpload(false); setUploadFile(null); setUploadExpiry(""); setUploadLifetime(false);
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
                <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className={inputClass}>
                  {DOC_TYPES.map((dt) => {
                    const exists = driver.documents.some((d) => d.type === dt.value);
                    return <option key={dt.value} value={dt.value}>{dt.label}{exists ? " (replace)" : ""}</option>;
                  })}
                </select>
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
                    const docLabel = DOC_TYPES.find((d) => d.value === doc.type)?.label || doc.type;
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
                      {DOC_TYPES.find((d) => d.value === historyDocType)?.label || historyDocType} History
                    </h4>
                    <button onClick={() => setHistoryDocType(null)} className="text-xs text-gray-400 hover:text-gray-600">&times; Close</button>
                  </div>
                  {historyLoading ? (
                    <div className="py-4 text-center text-xs text-gray-400">Loading...</div>
                  ) : historyData.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">No history found</div>
                  ) : (
                    <div className="space-y-2">
                      {historyData.map((h) => (
                        <div key={h.id} className={`flex items-center justify-between p-3 rounded-xl text-xs ${h.isActive ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20" : "bg-gray-50 border border-gray-100 dark:bg-gray-800/50 dark:border-gray-700"}`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full ${h.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                            <div>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {h.expiryDate ? new Date(h.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Lifetime"}
                              </span>
                              {h.isActive && <span className="ml-1.5 text-[8px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">CURRENT</span>}
                              <p className="text-gray-400 mt-0.5">Created {new Date(h.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                              {h.archivedAt && <p className="text-gray-400">Archived {new Date(h.archivedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
                            </div>
                          </div>
                          {h.documentUrl && (
                            <a href={(resolveImageUrl(h.documentUrl) ?? "")} target="_blank" rel="noopener noreferrer"
                              className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 font-medium">View</a>
                          )}
                        </div>
                      ))}
                    </div>
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
                    <AddressBlock label="Current Address" address={driver.currentAddress} icon="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    <AddressBlock label="Permanent Address" address={driver.permanentAddress} icon="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
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

              {/* Address */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center"><MapPin className="w-3 h-3 text-yellow-600" /></span>
                  Address
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Address</label>
                    <textarea placeholder="Door No, Street, Area, City, State - Pin Code" rows={2} value={editForm.currentAddress} onChange={(e) => setEditForm({ ...editForm, currentAddress: e.target.value })} className={`${inputClass} h-auto py-2.5`} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Permanent Address</label>
                    <textarea placeholder="Door No, Street, Area, City, State - Pin Code" rows={2} value={editForm.permanentAddress} onChange={(e) => setEditForm({ ...editForm, permanentAddress: e.target.value })} className={`${inputClass} h-auto py-2.5`} />
                  </div>
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
              <p className="text-white/70 text-sm mt-0.5">{DOC_TYPES.find((d) => d.value === driver.documents.find((doc) => doc.id === editingDocExpiry)?.type)?.label || "Document"}</p>
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
              <p className="text-white/70 text-sm mt-0.5">{DOC_TYPES.find((d) => d.value === driver.documents.find((doc) => doc.id === renewingDriverDoc)?.type)?.label || "Document"}</p>
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

function AddressBlock({ label, address, icon }: { label: string; address: string | null; icon: string }) {
  if (!address) return null;
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{address}</p>
    </div>
  );
}
