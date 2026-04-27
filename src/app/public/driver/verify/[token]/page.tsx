"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { publicAPI } from "@/lib/api";
import PhotoCapture from "@/components/public/PhotoCapture";
import AddressMapPicker from "@/components/public/AddressMapPicker";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";
import { validateUploadFile } from "@/lib/file-validation";

interface DriverData {
  id: string;
  name: string;
  phone: string | null;
  aadhaarLast4: string | null;
  licenseNumber: string;
  licenseExpiry: string;
  vehicleClass: string;
  bloodGroup: string | null;
  fatherName: string | null;
  motherName: string | null;
  emergencyContact: string | null;
  emergencyContacts: Array<{ name: string; relation: string; phone: string }> | null;
  currentAddress: string | null;
  currentAddressPhotos: string[];
  permanentAddress: string | null;
  permanentAddressPhotos: string[];
  currentAddressLat: number | null;
  currentAddressLng: number | null;
  permanentAddressLat: number | null;
  permanentAddressLng: number | null;
  profilePhoto: string | null;
  selfVerifiedAt: string | null;
  adminVerified: boolean;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const RELATIONS = ["Father", "Mother", "Spouse", "Brother", "Sister", "Son", "Daughter", "Friend", "Relative", "Others"];

interface EmergencyContact {
  name: string;
  relation: string;
  customRelation: string;
  phone: string;
}

export default function DriverVerifyPage() {
  const params = useParams();
  const token = params.token as string;

  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", phone: "", aadhaarLast4: "", vehicleClass: "",
    bloodGroup: "", fatherName: "", motherName: "",
  });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { name: "", relation: "", customRelation: "", phone: "" },
    { name: "", relation: "", customRelation: "", phone: "" },
  ]);
  const [currentAddr, setCurrentAddr] = useState({ address: "", lat: null as number | null, lng: null as number | null });
  const [permanentAddr, setPermanentAddr] = useState({ address: "", lat: null as number | null, lng: null as number | null });
  const [sameAsCurrent, setSameAsCurrent] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [currentAddrPhotos, setCurrentAddrPhotos] = useState<string[]>([]);
  const [permanentAddrPhotos, setPermanentAddrPhotos] = useState<string[]>([]);
  const [uploadingAddrPhoto, setUploadingAddrPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    publicAPI.getDriverVerification(token)
      .then((res) => {
        const d: DriverData = res.data.data;
        setDriver(d);
        setForm({
          name: d.name || "",
          phone: d.phone || "",
          aadhaarLast4: d.aadhaarLast4 || "",
          vehicleClass: d.vehicleClass || "",
          bloodGroup: d.bloodGroup || "",
          fatherName: d.fatherName || "",
          motherName: d.motherName || "",
        });
        if (d.emergencyContacts && Array.isArray(d.emergencyContacts) && d.emergencyContacts.length > 0) {
          setEmergencyContacts(d.emergencyContacts.map((ec: { name: string; relation: string; phone: string }) => ({
            name: ec.name || "", relation: RELATIONS.includes(ec.relation) ? ec.relation : "Others",
            customRelation: RELATIONS.includes(ec.relation) ? "" : ec.relation, phone: ec.phone || "",
          })));
        }
        setCurrentAddr({ address: d.currentAddress || "", lat: d.currentAddressLat, lng: d.currentAddressLng });
        setPermanentAddr({ address: d.permanentAddress || "", lat: d.permanentAddressLat, lng: d.permanentAddressLng });
        setProfilePhoto(d.profilePhoto);
        setCurrentAddrPhotos(d.currentAddressPhotos || []);
        setPermanentAddrPhotos(d.permanentAddressPhotos || []);
      })
      .catch(() => setError("Invalid or expired verification link"))
      .finally(() => setLoading(false));
  }, [token]);

  // Address camera
  const [addrCameraOpen, setAddrCameraOpen] = useState<"current" | "permanent" | null>(null);
  const [addrCameraFacing, setAddrCameraFacing] = useState<"environment" | "user">("environment");
  const addrVideoRef = useRef<HTMLVideoElement>(null);
  const addrCanvasRef = useRef<HTMLCanvasElement>(null);
  const addrStreamRef = useRef<MediaStream | null>(null);

  const startAddrStream = async (facing: "environment" | "user") => {
    // Stop existing stream
    if (addrStreamRef.current) { addrStreamRef.current.getTracks().forEach((t) => t.stop()); }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
    } catch {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
      catch { /* no camera */ }
    }
    if (stream) {
      addrStreamRef.current = stream;
      setTimeout(() => { if (addrVideoRef.current) { addrVideoRef.current.srcObject = stream; addrVideoRef.current.play(); } }, 100);
    }
    return stream;
  };

  const openAddrCamera = async (type: "current" | "permanent") => {
    const facing: "environment" | "user" = "environment";
    setAddrCameraFacing(facing);
    setAddrCameraOpen(type);
    setTimeout(async () => {
      const stream = await startAddrStream(facing);
      if (!stream) {
        setAddrCameraOpen(null);
        alert("Camera access denied or not available. Please allow camera permission in your browser settings, or use the Gallery button to upload a photo.");
        const input = document.createElement("input");
        input.type = "file"; input.accept = "image/*";
        input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleAddressPhoto(type, f); };
        input.click();
      }
    }, 100);
  };

  const switchAddrCamera = async () => {
    const newFacing = addrCameraFacing === "environment" ? "user" : "environment";
    setAddrCameraFacing(newFacing);
    await startAddrStream(newFacing);
  };

  const captureAddrPhoto = () => {
    if (!addrVideoRef.current || !addrCanvasRef.current || !addrCameraOpen) return;
    const video = addrVideoRef.current;
    const canvas = addrCanvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `addr-${Date.now()}.jpg`, { type: "image/jpeg" });
      const type = addrCameraOpen;
      closeAddrCamera();
      await handleAddressPhoto(type, file);
    }, "image/jpeg", 0.85);
  };

  const closeAddrCamera = () => {
    if (addrStreamRef.current) { addrStreamRef.current.getTracks().forEach((t) => t.stop()); addrStreamRef.current = null; }
    setAddrCameraOpen(null);
  };

  const handleAddressPhoto = async (type: "current" | "permanent", file: File) => {
    const validation = validateUploadFile(file);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError(null);
    setUploadingAddrPhoto(type);
    try {
      const res = await publicAPI.uploadAddressPhoto(token, type, file);
      if (type === "current") setCurrentAddrPhotos(res.data.data.photos);
      else setPermanentAddrPhotos(res.data.data.photos);
    } catch { /* ignore */ }
    finally { setUploadingAddrPhoto(null); }
  };

  const handleRemoveAddressPhoto = async (type: "current" | "permanent", url: string) => {
    try {
      const res = await publicAPI.deleteAddressPhoto(token, type, url);
      if (type === "current") setCurrentAddrPhotos(res.data.data.photos);
      else setPermanentAddrPhotos(res.data.data.photos);
    } catch { /* ignore */ }
  };

  const handlePhotoUpload = async (file: File): Promise<string | null> => {
    const validation = validateUploadFile(file);
    if (!validation.ok) {
      setError(validation.message);
      return null;
    }
    setError(null);
    try {
      const res = await publicAPI.uploadDriverPhoto(token, file);
      const url = res.data.data.profilePhoto;
      setProfilePhoto(url);
      return url;
    } catch {
      return null;
    }
  };

  const updateEC = (index: number, field: keyof EmergencyContact, value: string) => {
    setEmergencyContacts((prev) => prev.map((ec, i) => i === index ? { ...ec, [field]: value } : ec));
  };
  const addEC = () => { if (emergencyContacts.length < 10) setEmergencyContacts([...emergencyContacts, { name: "", relation: "", customRelation: "", phone: "" }]); };
  const removeEC = (index: number) => { if (emergencyContacts.length > 2) setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index)); };

  const validECs = emergencyContacts.filter((ec) => ec.name && ec.phone && (ec.relation && (ec.relation !== "Others" || ec.customRelation)));
  const ecError = validECs.length < 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (ecError) { setError("At least 2 emergency contacts are required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const finalPermanent = sameAsCurrent ? currentAddr : permanentAddr;
      const formattedECs = emergencyContacts
        .filter((ec) => ec.name && ec.phone)
        .map((ec) => ({ name: ec.name, relation: ec.relation === "Others" ? ec.customRelation : ec.relation, phone: ec.phone }));
      await publicAPI.updateDriverVerification(token, {
        ...form,
        emergencyContacts: formattedECs,
        currentAddress: currentAddr.address || null,
        currentAddressLat: currentAddr.lat,
        currentAddressLng: currentAddr.lng,
        permanentAddress: finalPermanent.address || null,
        permanentAddressLat: finalPermanent.lat,
        permanentAddressLng: finalPermanent.lng,
      });
      setSubmitted(true);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 transition-all";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error && !driver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Link Not Found</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (driver?.adminVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Profile Verified</h2>
          <p className="text-sm text-gray-500 mb-2">Your profile has been reviewed and verified by the admin.</p>
          <p className="text-xs text-gray-400">If you need to make changes, please contact your fleet manager.</p>
        </div>
      </div>
    );
  }

  // Already submitted and pending admin review — block editing
  if ((submitted || driver?.selfVerifiedAt) && !driver?.adminVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Pending Verification</h2>
          <p className="text-sm text-gray-500">Your profile has been submitted and is currently under review by the admin.</p>
          <p className="text-xs text-gray-400 mt-2">You will be able to access this page once the admin completes the review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-yellow-500 via-yellow-400 to-amber-400 px-6 pt-8 pb-24 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full border-2 border-white" />
          <div className="absolute bottom-5 right-10 w-48 h-48 rounded-full border-2 border-white" />
          <div className="absolute top-20 right-20 w-20 h-20 rounded-full border border-white" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl bg-white shadow-xl shadow-yellow-600/20 flex items-center justify-center mb-4">
            <img src="/images/logo/yellow-track-logo.png" alt="Yellow Track" className="w-12 h-12 rounded-xl object-contain" />
          </div>
          {/* Brand name */}
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            <span className="text-white">Yellow</span>
            <span className="text-gray-900/80"> Track</span>
          </h1>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mt-3">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-semibold text-white/90">Driver Profile Verification</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 sm:px-6 -mt-16 relative z-10 pb-10">

        {/* ── CARD 1: Profile Photo ── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-8 mb-6">
          <div className="text-center">
            <PhotoCapture currentPhoto={profilePhoto} onUpload={handlePhotoUpload} />
            <h2 className="text-xl font-black text-gray-900 mt-4">{form.name || "Driver"}</h2>
            <p className="text-sm text-gray-400 font-mono mt-1">{driver?.licenseNumber}</p>
          </div>
        </div>

        {/* ── CARD 2: License Info (Read-Only) ── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 sm:px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">License Information</h3>
              <p className="text-[10px] text-gray-400">Verified from government records</p>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-4 divide-y divide-gray-50">
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-500">License Number</span>
              <span className="text-sm font-bold text-gray-900 font-mono tracking-wide">{driver?.licenseNumber}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-500">License Expiry</span>
              <span className="text-sm font-semibold text-gray-900">
                {driver?.licenseExpiry ? new Date(driver.licenseExpiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-500">Vehicle Class</span>
              <span className="text-sm font-semibold text-gray-900">{driver?.vehicleClass}</span>
            </div>
          </div>
        </div>

        {/* ── CARD 3: Personal Details ── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 sm:px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Personal Details</h3>
              <p className="text-[10px] text-gray-400">Review and update your information</p>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-6 space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Full name as on license" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+91</span>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${inputClass} pl-12`} placeholder="9876543210" maxLength={10} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Aadhaar (Last 4)</label>
                <input type="text" maxLength={4} value={form.aadhaarLast4} onChange={(e) => setForm({ ...form, aadhaarLast4: e.target.value })} className={`${inputClass} font-mono tracking-[0.3em] text-center`} placeholder="1234" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Blood Group</label>
              <select value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} className={inputClass}>
                <option value="">Select blood group</option>
                {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── CARD 4: Family Details ── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 sm:px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Family Details</h3>
              <p className="text-[10px] text-gray-400">Parent information for records</p>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Father&apos;s Name</label>
                <input type="text" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} className={inputClass} placeholder="Father's full name" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Mother&apos;s Name</label>
                <input type="text" value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} className={inputClass} placeholder="Mother's full name" />
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 5: Emergency Contacts ── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 sm:px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Emergency Contacts</h3>
                <p className="text-[10px] text-gray-400">Minimum 2 contacts required <span className="text-red-500">*</span></p>
              </div>
            </div>
            {emergencyContacts.length < 10 && (
              <button type="button" onClick={addEC}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add
              </button>
            )}
          </div>
          <div className="px-6 sm:px-8 py-6 space-y-4">
            {emergencyContacts.map((ec, idx) => (
              <div key={idx} className="relative p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact {idx + 1} {idx < 2 && <span className="text-red-500">*</span>}</span>
                  {idx >= 2 && (
                    <button type="button" onClick={() => removeEC(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors" title="Remove">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">Full Name</label>
                  <input type="text" value={ec.name} onChange={(e) => updateEC(idx, "name", e.target.value)} className={inputClass} placeholder="Contact person's name" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Relation</label>
                    <select value={ec.relation} onChange={(e) => updateEC(idx, "relation", e.target.value)} className={inputClass}>
                      <option value="">Select relation</option>
                      {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {ec.relation === "Others" && (
                      <input type="text" value={ec.customRelation} onChange={(e) => updateEC(idx, "customRelation", e.target.value)}
                        className={`${inputClass} mt-2`} placeholder="Specify relation" />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Phone Number</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+91</span>
                      <input type="tel" value={ec.phone} onChange={(e) => updateEC(idx, "phone", e.target.value)}
                        className={`${inputClass} pl-12`} placeholder="9876543210" maxLength={10} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 text-center">{emergencyContacts.length}/10 contacts added {ecError && <span className="text-red-500 font-medium">&mdash; minimum 2 valid contacts required</span>}</p>
          </div>
        </div>

        {/* ── CARD 5: Current Address ── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 sm:px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Current Address</h3>
              <p className="text-[10px] text-gray-400">Your present residential address</p>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-6 space-y-4">
            <AddressMapPicker label="" value={currentAddr} onChange={setCurrentAddr} autoDetect />
            {/* Address Photos */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Address Proof Photos</p>
              {currentAddrPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-3">
                  {currentAddrPhotos.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group">
                      <img src={(resolveImageUrl(url) ?? "")} alt="Address" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => handleRemoveAddressPhoto("current", url)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                    </div>
                  ))}
                </div>
              )}
              {currentAddrPhotos.length < 5 && (
                <div className="flex gap-2">
                  {uploadingAddrPhoto === "current" ? (
                    <div className="flex items-center gap-2 text-xs text-yellow-600">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Uploading...
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => openAddrCamera("current")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500 text-white text-xs font-semibold hover:bg-yellow-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
                        Take Photo
                      </button>
                      <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold cursor-pointer hover:bg-gray-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                        Gallery
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAddressPhoto("current", e.target.files[0]); e.target.value = ""; }} />
                      </label>
                    </>
                  )}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-2">{currentAddrPhotos.length}/5 photos &mdash; Take or upload address proof</p>
            </div>
          </div>
        </div>

        {/* ── CARD 6: Permanent Address ── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 sm:px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Permanent Address</h3>
                <p className="text-[10px] text-gray-400">Your permanent residential address <span className="text-gray-300">(optional)</span></p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-white rounded-lg px-3 py-1.5 border border-gray-200 hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={sameAsCurrent} onChange={(e) => {
                setSameAsCurrent(e.target.checked);
                if (e.target.checked) setPermanentAddr({ ...currentAddr });
              }} className="w-3.5 h-3.5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400" />
              <span className="text-[11px] font-medium text-gray-600">Same as current</span>
            </label>
          </div>
          <div className="px-6 sm:px-8 py-6 space-y-4">
            <AddressMapPicker label="" value={sameAsCurrent ? currentAddr : permanentAddr} onChange={setPermanentAddr} disabled={sameAsCurrent} />
            {/* Address Photos (optional) */}
            {!sameAsCurrent && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Address Proof Photos <span className="text-gray-300 font-normal normal-case">(optional)</span></p>
                {permanentAddrPhotos.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {permanentAddrPhotos.map((url, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group">
                        <img src={(resolveImageUrl(url) ?? "")} alt="Address" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleRemoveAddressPhoto("permanent", url)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
                {permanentAddrPhotos.length < 5 && (
                  <div className="flex gap-2">
                    {uploadingAddrPhoto === "permanent" ? (
                      <div className="flex items-center gap-2 text-xs text-indigo-600">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Uploading...
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => openAddrCamera("permanent")}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-600 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
                          Take Photo
                        </button>
                        <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold cursor-pointer hover:bg-gray-50 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                          Gallery
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAddressPhoto("permanent", e.target.files[0]); e.target.value = ""; }} />
                        </label>
                      </>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-2">{permanentAddrPhotos.length}/5 photos</p>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600 mb-6 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !form.name}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-black text-base shadow-xl shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2.5"
        >
          {submitting ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              Verify &amp; Submit Profile
            </>
          )}
        </button>

        {/* Footer */}
        <div className="text-center mt-8 pb-6">
          <div className="flex items-center justify-center gap-2">
            <img src="/images/logo/yellow-track-logo.png" alt="Yellow Track" className="w-5 h-5 rounded object-contain" />
            <p className="text-[11px] text-gray-400">Secured by <span className="font-bold text-yellow-600">Yellow</span> <span className="font-bold text-gray-500">Track</span></p>
          </div>
        </div>
      </form>

      {/* Address Camera Overlay */}
      {addrCameraOpen && (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/90 to-transparent absolute top-0 left-0 right-0 z-10">
            <button type="button" onClick={closeAddrCamera} className="text-white text-sm font-medium px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              Cancel
            </button>
            <p className="text-white text-sm font-semibold">
              {addrCameraOpen === "current" ? "Current" : "Permanent"} Address
            </p>
            <button type="button" onClick={switchAddrCamera}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title={`Switch to ${addrCameraFacing === "environment" ? "front" : "rear"} camera`}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
              </svg>
            </button>
          </div>

          {/* Camera feed */}
          <div className="flex-1 flex items-center justify-center">
            <video ref={addrVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <canvas ref={addrCanvasRef} className="hidden" />

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pb-8 pt-16 flex items-center justify-center gap-8">
            {/* Camera facing label */}
            <div className="text-white/50 text-[10px] font-medium uppercase tracking-wider absolute top-4 left-0 right-0 text-center">
              {addrCameraFacing === "environment" ? "Rear Camera" : "Front Camera"}
            </div>
            {/* Capture button */}
            <button type="button" onClick={captureAddrPhoto}
              className="w-18 h-18 rounded-full bg-white/90 hover:bg-white border-4 border-white/30 transition-all active:scale-90 flex items-center justify-center shadow-2xl"
              style={{ width: 72, height: 72 }}>
              <div className="w-14 h-14 rounded-full border-2 border-gray-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
