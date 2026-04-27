"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { driverAPI } from "@/lib/api";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import DatePicker from "@/components/ui/DatePicker";
import VerificationLinkShare from "@/components/ui/VerificationLinkShare";
import { ChevronLeft, Search, Pencil, AlertCircle, CheckCircle2, CreditCard, UserPlus, User, Info, MapPin, Home, Lock, Plus, Check } from "lucide-react";

const VEHICLE_CLASSES = [
  { value: "LMV", label: "LMV", desc: "Light Motor Vehicle" },
  { value: "HMV", label: "HMV", desc: "Heavy Motor Vehicle" },
  { value: "HGMV", label: "HGMV", desc: "Heavy Goods Motor Vehicle" },
  { value: "HPMV", label: "HPMV", desc: "Heavy Passenger Motor Vehicle" },
  { value: "TRANS", label: "TRANS", desc: "Transport" },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar Islands", "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

const AUTO_STEPS = [
  { title: "DL Verification", desc: "License verified from Sarathi/Parivahan database" },
  { title: "Driver Profile", desc: "Name, phone, vehicle class auto-fetched" },
  { title: "Driver Created", desc: "Added to your fleet with license tracking enabled" },
];

export default function AddDriverPage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  // Auto mode
  const [autoLicense, setAutoLicense] = useState("");
  const [autoDob, setAutoDob] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoStep, setAutoStep] = useState(-1);

  // Manual mode
  const [form, setForm] = useState({
    name: "", phone: "", aadhaarLast4: "", licenseNumber: "", licenseExpiry: "", vehicleClass: "LMV",
    bloodGroup: "", fatherName: "", motherName: "", emergencyContact: "", currentAddress: "", permanentAddress: "",
  });
  const [sameAddress, setSameAddress] = useState(false);
  const emptyAddr = { doorNo: "", street: "", area: "", city: "", state: "", pinCode: "" };
  const [currentAddr, setCurrentAddr] = useState(emptyAddr);
  const [permanentAddr, setPermanentAddr] = useState(emptyAddr);

  const formatAddress = (addr: typeof emptyAddr) => {
    return [addr.doorNo, addr.street, addr.area, addr.city, addr.state, addr.pinCode].filter(Boolean).join(", ");
  };
  const [manualLoading, setManualLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdDriver, setCreatedDriver] = useState<{ id: string; name: string; verificationToken: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAutoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!autoLicense.trim() || autoLicense.trim().length < 5) {
      setError("Enter a valid driving license number"); return;
    }
    if (!autoDob) {
      setError("Date of birth is required to verify the license"); return;
    }
    setAutoLoading(true);
    for (let i = 0; i < AUTO_STEPS.length; i++) { setAutoStep(i); await new Promise((r) => setTimeout(r, 800)); }
    try {
      const res = await driverAPI.autoCreate(autoLicense.trim(), autoDob);
      setAutoStep(AUTO_STEPS.length);
      setSuccess(`${res.data.data.name} added successfully!`);
      toast.success("Driver Added!", `${res.data.data.name} verified and added`);
      setCreatedDriver({ id: res.data.data.id, name: res.data.data.name, verificationToken: res.data.data.verificationToken });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || "Verification failed"); setAutoStep(-1);
      toast.error("Verification Failed", e.response?.data?.message);
    } finally { setAutoLoading(false); }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.name || !form.licenseNumber || !form.licenseExpiry) {
      setError("Name, license number, and license expiry are required"); return;
    }
    setManualLoading(true);
    try {
      const payload = {
        ...form,
        currentAddress: formatAddress(currentAddr) || undefined,
        permanentAddress: formatAddress(sameAddress ? currentAddr : permanentAddr) || undefined,
      };
      const res = await driverAPI.create(payload);
      setSuccess(`${res.data.data.name || "Driver"} added successfully!`);
      toast.success("Driver Added!", `${res.data.data.name || "Driver"} registered successfully`);
      setCreatedDriver({ id: res.data.data.id, name: res.data.data.name, verificationToken: res.data.data.verificationToken });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || "Failed to add driver");
      toast.error("Failed", e.response?.data?.message || "Could not add driver");
    } finally { setManualLoading(false); }
  };

  const inputClass = "w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-yellow-500 group-hover:border-gray-300 dark:group-hover:border-gray-600";

  return (
    <div className="space-y-6">
      {/* Header + Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/drivers" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Driver</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Register a new driver to your fleet</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
          <button onClick={() => { setMode("auto"); setError(""); setSuccess(""); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${mode === "auto" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <Search className="w-4 h-4" />
            Auto (DL Verify)
          </button>
          <button onClick={() => { setMode("manual"); setError(""); setSuccess(""); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${mode === "manual" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <Pencil className="w-4 h-4" />
            Manual Entry
          </button>
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3.5 dark:bg-red-500/10 dark:border-red-500/20">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3.5 dark:bg-emerald-500/10 dark:border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
        </div>
      )}

      {/* ── AUTO MODE ── */}
      {mode === "auto" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden shadow-xl shadow-gray-200/30 dark:shadow-none">
              <div className="relative bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-300 px-6 py-6 overflow-hidden">
                <div className="absolute top-4 right-6 w-20 h-20 rounded-full border border-white/10" />
                <div className="absolute -bottom-6 right-16 w-28 h-28 rounded-full border border-white/5" />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">DL Auto Verification</h2>
                    <p className="text-white/70 text-xs">Enter license number — we verify and fetch details automatically</p>
                  </div>
                </div>
              </div>
              <div className="p-8">
                <form onSubmit={handleAutoSubmit}>
                  <label className="mb-2 block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Driving License Number</label>
                  <input
                    type="text" placeholder="KA01 2021 0001234" value={autoLicense}
                    onChange={(e) => setAutoLicense(e.target.value.toUpperCase())}
                    disabled={autoLoading}
                    className="w-full h-14 rounded-xl border-2 border-gray-200 bg-gray-50 px-5 text-lg font-mono font-bold tracking-widest text-gray-900 placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-60 transition-all"
                  />
                  <label className="mt-5 mb-2 block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date of Birth</label>
                  <DatePicker
                    value={autoDob}
                    onChange={setAutoDob}
                    placeholder="Select date of birth"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-400">DOB is required to verify the license against the Sarathi / Surepass database.</p>
                  <button type="submit" disabled={autoLoading || !!success}
                    className="mt-5 w-full h-12 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                    {autoLoading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Verifying...</>) : "Verify & Add Driver"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Pipeline */}
          <div>
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5">Verification Pipeline</h3>
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                  <div className="space-y-5">
                    {AUTO_STEPS.map((step, i) => {
                      const isDone = autoStep > i;
                      const isActive = autoStep === i;
                      return (
                        <div key={i} className="relative flex gap-4 pl-1">
                          <div className={`relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center transition-all duration-500 ${isDone ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : isActive ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/30 animate-pulse" : "bg-gray-100 text-gray-400 dark:bg-gray-800"}`}>
                            {isDone ? (<Check className="w-4 h-4" strokeWidth={3} />)
                              : isActive ? (<svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>)
                              : (<span className="text-xs font-bold">{i + 1}</span>)}
                          </div>
                          <div className={`transition-all ${isActive ? "opacity-100" : isDone ? "opacity-70" : "opacity-40"}`}>
                            <h4 className={`text-sm font-semibold ${isActive ? "text-yellow-600 dark:text-yellow-400" : isDone ? "text-emerald-600" : "text-gray-500"}`}>{step.title}</h4>
                            <p className="text-xs text-gray-400">{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                    {autoStep >= AUTO_STEPS.length && (
                      <div className="relative flex gap-4 pl-1">
                        <div className="relative z-10 w-[30px] h-[30px] rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
                          <Check className="w-4 h-4" strokeWidth={3} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-emerald-600">All Done!</h4>
                          <p className="text-xs text-gray-400">Redirecting to driver profile...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-yellow-200 bg-yellow-50/50 p-5 dark:border-yellow-500/20 dark:bg-yellow-500/5">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-1">Prefer manual entry?</p>
                <p className="text-xs text-yellow-700/70 dark:text-yellow-400/60 mb-3">Switch to Manual mode to enter driver details yourself.</p>
                <button onClick={() => { setMode("manual"); setError(""); setSuccess(""); }}
                  className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 flex items-center gap-1 transition-colors">
                  Switch to Manual Entry &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL MODE ── */}
      {mode === "manual" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden shadow-xl shadow-gray-200/30 dark:shadow-none">
              <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 px-6 py-6 overflow-hidden">
                <div className="absolute top-6 right-8 w-32 h-32 rounded-full border border-yellow-500/10" />
                <div className="absolute top-3 right-5 w-32 h-32 rounded-full border border-yellow-500/5" />
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                      <UserPlus className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Manual Driver Entry</h2>
                      <p className="text-white/50 text-sm mt-0.5">Fill in driver details and license information</p>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleManualSubmit} className="p-6 sm:p-8 space-y-7">
                {/* Personal Info */}
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-yellow-500/20">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Personal Info</h3>
                      <p className="text-[11px] text-gray-400">Driver identification details</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Full Name <span className="text-red-500">*</span></label><input type="text" name="name" placeholder="Rajesh Kumar" value={form.name} onChange={handleChange} className={inputClass} /></div>
                    <div className="group">
                      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</label>
                      <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+91</span><input type="tel" name="phone" placeholder="9876543210" value={form.phone} onChange={handleChange} maxLength={10} className={`${inputClass} pl-12`} /></div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aadhaar (Last 4 digits)</label>
                    <div className="flex items-center gap-0 max-w-[300px]">
                      <div className="h-11 flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                        <span className="text-xs text-gray-400 font-mono whitespace-nowrap">XXXX - XXXX -</span>
                      </div>
                      <input type="text" name="aadhaarLast4" placeholder="1234" maxLength={4} value={form.aadhaarLast4} onChange={handleChange} className="h-11 w-20 rounded-r-xl border border-gray-200 bg-white px-3 text-center text-sm font-mono font-bold tracking-[0.2em] text-gray-900 placeholder:text-gray-300 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white transition-all" />
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Only last 4 digits stored for security
                    </p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

                {/* Additional Info */}
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-yellow-500/20">
                      <Info className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Additional Info</h3>
                      <p className="text-[11px] text-gray-400">Optional personal details</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group">
                      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Blood Group</label>
                      <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className={inputClass}>
                        <option value="">Select</option>
                        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>
                    <div className="group">
                      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Emergency Contact</label>
                      <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">+91</span><input type="tel" name="emergencyContact" placeholder="9876543210" value={form.emergencyContact} onChange={handleChange} maxLength={10} className={`${inputClass} pl-12`} /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Father&apos;s Name</label><input type="text" name="fatherName" placeholder="Father's full name" value={form.fatherName} onChange={handleChange} className={inputClass} /></div>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mother&apos;s Name</label><input type="text" name="motherName" placeholder="Mother's full name" value={form.motherName} onChange={handleChange} className={inputClass} /></div>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

                {/* Current Address */}
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-yellow-500/20">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Current Address</h3>
                      <p className="text-[11px] text-gray-400">Present residential address</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Door / Flat No.</label><input type="text" placeholder="12-A" value={currentAddr.doorNo} onChange={(e) => setCurrentAddr({ ...currentAddr, doorNo: e.target.value })} className={inputClass} /></div>
                    <div className="group col-span-1 sm:col-span-2"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Street / Road</label><input type="text" placeholder="MG Road" value={currentAddr.street} onChange={(e) => setCurrentAddr({ ...currentAddr, street: e.target.value })} className={inputClass} /></div>
                    <div className="group col-span-2 sm:col-span-1"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Area / Locality</label><input type="text" placeholder="Koramangala" value={currentAddr.area} onChange={(e) => setCurrentAddr({ ...currentAddr, area: e.target.value })} className={inputClass} /></div>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">City</label><input type="text" placeholder="Bangalore" value={currentAddr.city} onChange={(e) => setCurrentAddr({ ...currentAddr, city: e.target.value })} className={inputClass} /></div>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">State</label>
                      <select value={currentAddr.state} onChange={(e) => setCurrentAddr({ ...currentAddr, state: e.target.value })} className={inputClass}>
                        <option value="">Select</option>
                        {INDIAN_STATES.map((s: string) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pin Code</label><input type="text" placeholder="560001" maxLength={6} value={currentAddr.pinCode} onChange={(e) => setCurrentAddr({ ...currentAddr, pinCode: e.target.value.replace(/\D/g, "") })} className={`${inputClass} font-mono tracking-wider`} /></div>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

                {/* Permanent Address */}
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-yellow-500/20">
                        <Home className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Permanent Address</h3>
                        <p className="text-[11px] text-gray-400">Home / native address</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={sameAddress} onChange={(e) => { setSameAddress(e.target.checked); if (e.target.checked) setPermanentAddr({ ...currentAddr }); }}
                        className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 dark:border-gray-600" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Same as current</span>
                    </label>
                  </div>
                  <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 transition-opacity ${sameAddress ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Door / Flat No.</label><input type="text" placeholder="12-A" value={permanentAddr.doorNo} onChange={(e) => setPermanentAddr({ ...permanentAddr, doorNo: e.target.value })} className={inputClass} /></div>
                    <div className="group col-span-1 sm:col-span-2"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Street / Road</label><input type="text" placeholder="MG Road" value={permanentAddr.street} onChange={(e) => setPermanentAddr({ ...permanentAddr, street: e.target.value })} className={inputClass} /></div>
                    <div className="group col-span-2 sm:col-span-1"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Area / Locality</label><input type="text" placeholder="Koramangala" value={permanentAddr.area} onChange={(e) => setPermanentAddr({ ...permanentAddr, area: e.target.value })} className={inputClass} /></div>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">City</label><input type="text" placeholder="Bangalore" value={permanentAddr.city} onChange={(e) => setPermanentAddr({ ...permanentAddr, city: e.target.value })} className={inputClass} /></div>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">State</label>
                      <select value={permanentAddr.state} onChange={(e) => setPermanentAddr({ ...permanentAddr, state: e.target.value })} className={inputClass}>
                        <option value="">Select</option>
                        {INDIAN_STATES.map((s: string) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pin Code</label><input type="text" placeholder="560001" maxLength={6} value={permanentAddr.pinCode} onChange={(e) => setPermanentAddr({ ...permanentAddr, pinCode: e.target.value.replace(/\D/g, "") })} className={`${inputClass} font-mono tracking-wider`} /></div>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

                {/* License */}
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-yellow-500/20">
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">License Details</h3>
                      <p className="text-[11px] text-gray-400">Driving license information</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">License Number <span className="text-red-500">*</span></label><input type="text" name="licenseNumber" placeholder="KA0120210001234" value={form.licenseNumber} onChange={handleChange} className={`${inputClass} font-mono tracking-wide`} /></div>
                    <div className="group"><label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">License Expiry <span className="text-red-500">*</span></label><DatePicker value={form.licenseExpiry} onChange={(v) => setForm((prev) => ({ ...prev, licenseExpiry: v }))} placeholder="Select license expiry" /></div>
                  </div>
                  <div className="mt-4">
                    <label className="mb-2.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vehicle Class</label>
                    <div className="flex flex-wrap gap-2">
                      {VEHICLE_CLASSES.map((vc) => (
                        <button key={vc.value} type="button" onClick={() => setForm({ ...form, vehicleClass: vc.value })}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${form.vehicleClass === vc.value ? "border-yellow-400 bg-yellow-50 shadow-sm dark:bg-yellow-500/10 dark:border-yellow-500" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"}`}>
                          <span className={`text-sm font-bold ${form.vehicleClass === vc.value ? "text-yellow-700 dark:text-yellow-400" : "text-gray-800 dark:text-gray-300"}`}>{vc.label}</span>
                          <span className="text-[10px] text-gray-400 hidden sm:inline">- {vc.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={manualLoading}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {manualLoading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Adding...</>)
                      : (<><Plus className="w-4 h-4" />Add Driver</>)}
                  </button>
                  <Link href="/drivers" className="h-12 px-6 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 flex items-center transition-all">Cancel</Link>
                </div>
              </form>
            </div>
          </div>

          {/* Right — Guide */}
          <div>
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5">How It Works</h3>
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                  <div className="space-y-5">
                    {[
                      { num: "1", title: "Enter Details", desc: "Name, phone, Aadhaar (masked), license info" },
                      { num: "2", title: "Set Vehicle Class", desc: "LMV, HMV, HGMV, HPMV, or Transport" },
                      { num: "3", title: "Upload Docs Later", desc: "DL, medical, police verification from detail page" },
                      { num: "4", title: "Driver Ready", desc: "Driver is active with compliance tracking enabled" },
                    ].map((s) => (
                      <div key={s.num} className="relative flex gap-4 pl-1">
                        <div className="relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-500">{s.num}</span>
                        </div>
                        <div><h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.title}</h4><p className="text-xs text-gray-400">{s.desc}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-yellow-200 bg-yellow-50/50 p-5 dark:border-yellow-500/20 dark:bg-yellow-500/5">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-1">Have a DL number?</p>
                <p className="text-xs text-yellow-700/70 dark:text-yellow-400/60 mb-3">Switch to Auto mode to verify and auto-fill driver details.</p>
                <button onClick={() => { setMode("auto"); setError(""); setSuccess(""); }}
                  className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 flex items-center gap-1 transition-colors">
                  Switch to Auto (DL Verify) &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Link Modal */}
      {createdDriver && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-5 text-center">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">Driver Created!</h3>
              <p className="text-white/70 text-sm mt-0.5">{createdDriver.name} has been added to your fleet</p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Share this verification link with the driver to complete their profile (photo, address, etc.):</p>
              <VerificationLinkShare token={createdDriver.verificationToken} driverName={createdDriver.name} />
              <button
                onClick={() => router.push(`/drivers/${createdDriver.id}`)}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all flex items-center justify-center gap-2"
              >
                Go to Driver Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
