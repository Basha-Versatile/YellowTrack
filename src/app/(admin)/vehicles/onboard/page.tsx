"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { vehicleAPI, vehicleGroupAPI, documentTypeAPI } from "@/lib/api";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import DatePicker from "@/components/ui/DatePicker";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";
import { Search, FileText, AlertTriangle, LayoutGrid, ChevronLeft, Pencil, Car, X, Info, CheckCircle2, ImageIcon, Upload, Plus, Check, Flame, Moon, Sun, Zap, Radio, Package, Users, MapPin, Globe, Circle, ChevronDown, ShieldCheck, Lightbulb } from "lucide-react";

interface VehicleGroup { id: string; name: string; icon: string; color?: string; tyreCount?: number; }
interface DocumentType { id: string; code: string; name: string; hasExpiry: boolean; isSystem: boolean; }

const TYRE_POSITIONS: Record<number, string[]> = {
  3: ["FL", "FR", "R"],
  4: ["FL", "FR", "RL", "RR"],
  6: ["FL", "FR", "RL_O", "RL_I", "RR_O", "RR_I"],
  10: ["FL", "FR", "ML_O", "ML_I", "MR_O", "MR_I", "RL_O", "RL_I", "RR_O", "RR_I"],
};
const TYRE_LABELS: Record<string, string> = {
  FL: "Front Left", FR: "Front Right", R: "Rear", RL: "Rear Left", RR: "Rear Right",
  RL_O: "Rear L Out", RL_I: "Rear L In", RR_O: "Rear R Out", RR_I: "Rear R In",
  ML_O: "Mid L Out", ML_I: "Mid L In", MR_O: "Mid R Out", MR_I: "Mid R In", SPARE: "Spare",
};

const STEPS = [
  {
    icon: <Search className="w-5 h-5" />,
    title: "VAHAN Lookup",
    desc: "Vehicle details fetched from government database",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "Compliance Docs",
    desc: "Documents auto-created based on vehicle group",
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    title: "Challan Sync",
    desc: "Pending traffic violations are pulled automatically",
  },
  {
    icon: <LayoutGrid className="w-5 h-5" />,
    title: "QR Code",
    desc: "Unique QR generated for instant vehicle verification",
  },
];


export default function OnboardVehiclePage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vehicleUsage, setVehicleUsage] = useState<"PRIVATE" | "COMMERCIAL">("PRIVATE");
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [vehicleImages, setVehicleImages] = useState<File[]>([]);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Dynamic doc types based on selected group
  const [requiredDocTypes, setRequiredDocTypes] = useState<DocumentType[]>([]);
  const [loadingDocTypes, setLoadingDocTypes] = useState(false);

  useEffect(() => { vehicleGroupAPI.getAll().then((res) => setGroups(res.data.data)).catch(() => {}); }, []);

  // Fetch required doc types when group changes + reset tyre form
  useEffect(() => {
    if (selectedGroupId) {
      setLoadingDocTypes(true);
      documentTypeAPI.getByGroupId(selectedGroupId)
        .then((res) => setRequiredDocTypes(res.data.data))
        .catch(() => setRequiredDocTypes([]))
        .finally(() => setLoadingDocTypes(false));
      // Reset tyre form for new group
      const group = groups.find((g) => g.id === selectedGroupId);
      const count = group?.tyreCount || 4;
      const base = TYRE_POSITIONS[count] || Array.from({ length: count }, (_, i) => `T${i + 1}`);
      setTyreForm([...base, "SPARE"].map((pos) => ({ position: pos, brand: "", size: "", condition: "GOOD" })));
      setShowTyreSection(false);
    } else {
      setRequiredDocTypes([]);
      setTyreForm([]);
    }
  }, [selectedGroupId, groups]);

  // Manual mode state -- dynamic
  const [mf, setMf] = useState<Record<string, string>>({ registrationNumber: "", ownerName: "", make: "", model: "", fuelType: "Petrol", chassisNumber: "", engineNumber: "", gvw: "", seatingCapacity: "", permitType: "PASSENGER" });
  const [docExpiries, setDocExpiries] = useState<Record<string, string>>({});
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({});
  const [manualLoading, setManualLoading] = useState(false);
  const [showTyreSection, setShowTyreSection] = useState(false);
  const [tyreForm, setTyreForm] = useState<Array<{ position: string; brand: string; size: string; condition: string }>>([]);
  const handleMfChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setMf({ ...mf, [e.target.name]: e.target.value });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess(null);
    if (!mf.registrationNumber || !mf.make || !mf.model) { setError("Registration number, make, and model are required"); return; }
    if (!selectedGroupId) { setError("Please select a vehicle group"); return; }
    setManualLoading(true);
    try {
      const payload: Record<string, string | File | undefined> = {
        ...mf,
        groupId: selectedGroupId,
        vehicleUsage,
        gvw: mf.gvw || undefined,
        seatingCapacity: mf.seatingCapacity || undefined,
      };
      // Add dynamic doc expiries
      Object.entries(docExpiries).forEach(([key, val]) => {
        if (val) payload[key] = val;
      });
      // Add dynamic doc files
      Object.entries(docFiles).forEach(([key, f]) => {
        if (f) payload[key] = f;
      });
      // Add tyres if any data was entered
      if (showTyreSection) {
        const tyresWithData = tyreForm.filter((t) => t.brand || t.size);
        if (tyresWithData.length > 0) {
          payload.tyres = JSON.stringify(tyresWithData);
        }
      }
      const res = await vehicleAPI.onboardManual(payload, vehicleImages.length > 0 ? vehicleImages : undefined);
      setSuccess(`${res.data.data.registrationNumber} onboarded successfully!`);
      toast.success("Vehicle Onboarded!", `${res.data.data.registrationNumber} added to your fleet`);
      setTimeout(() => router.push(`/vehicles/${res.data.data.id}`), 1200);
    } catch (err: unknown) { const e = err as { response?: { data?: { message?: string } } }; setError(e.response?.data?.message || "Failed to onboard"); toast.error("Onboarding Failed", e.response?.data?.message || "Please try again"); }
    finally { setManualLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(null);

    const trimmed = registrationNumber.trim();
    if (!trimmed) { setError("Registration number is required"); return; }
    if (!selectedGroupId) { setError("Please select a vehicle group"); return; }

    setLoading(true);

    // Animate through steps
    for (let i = 0; i < STEPS.length; i++) {
      setActiveStep(i);
      await new Promise((r) => setTimeout(r, 800));
    }

    try {
      const res = await vehicleAPI.onboard(trimmed, vehicleImages.length > 0 ? vehicleImages : undefined, selectedGroupId, vehicleUsage);
      const vehicle = res.data.data;
      const warnings: string[] = Array.isArray(vehicle?.warnings) ? vehicle.warnings : [];
      setActiveStep(STEPS.length); // all done
      setSuccess(`${vehicle.registrationNumber} — ${vehicle.make} ${vehicle.model} onboarded successfully!`);
      toast.success("Vehicle Onboarded!", `${vehicle.registrationNumber} added to your fleet`);
      // Surface partial-save warnings so the operator knows what to follow up on
      warnings.forEach((w) => toast.warning("Heads up", w));
      setTimeout(() => router.push(`/vehicles/${vehicle.id}`), warnings.length > 0 ? 2500 : 1500);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      const status = error.response?.status;
      const message = error.response?.data?.message || "Failed to onboard vehicle";
      setError(message);
      // Distinct titles help the operator scan failures at a glance
      if (status === 409) toast.error("Already Onboarded", message);
      else if (status === 403) toast.error("Onboarding Blocked", message);
      else if (status === 400) toast.error("Invalid Request", message);
      else if (status === 429) toast.warning("Slow down", message);
      else if (status === 502 || status === 503 || status === 504) toast.error("RTA Service Unavailable", message);
      else toast.error("Onboarding Failed", message);
      setActiveStep(-1);
    } finally {
      setLoading(false);
    }
  };

  // Shared vehicle group selector component
  const renderGroupSelector = () => (
    groups.length > 0 ? (
      <div>
        <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <LayoutGrid className="w-4 h-4 text-yellow-500" />
          Vehicle Group <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {groups.map((g) => { const Icon = getVehicleTypeIcon(g.icon); return (
            <button key={g.id} type="button" onClick={() => setSelectedGroupId(selectedGroupId === g.id ? "" : g.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 transition-all ${selectedGroupId === g.id ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 dark:border-yellow-500" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800"}`}>
              <Icon className="w-6 h-6" style={g.color ? { color: g.color } : undefined} />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{g.name}</span>
            </button>
          ); })}
        </div>
        {!selectedGroupId && (
          <p className="mt-1.5 text-[11px] text-amber-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Vehicle group is required for onboarding
          </p>
        )}
        {selectedGroupId && requiredDocTypes.length > 0 && (
          <p className="mt-1.5 text-[11px] text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {requiredDocTypes.length} document{requiredDocTypes.length !== 1 ? "s" : ""} required for this group
          </p>
        )}
      </div>
    ) : null
  );

  return (
    <div className="space-y-6">
      {/* Header + Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/vehicles"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Onboard Vehicle</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Add a new vehicle to your fleet</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
          <button onClick={() => { setMode("auto"); setError(""); setSuccess(null); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${mode === "auto" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <Search className="w-4 h-4" />
            Auto (VAHAN)
          </button>
          <button onClick={() => { setMode("manual"); setError(""); setSuccess(null); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${mode === "manual" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <Pencil className="w-4 h-4" />
            Manual Onboard
          </button>
        </div>
      </div>

      {mode === "auto" && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Form */}
        <div>
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
            {/* Hero banner */}
            <div className="relative bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-300 px-8 py-10 overflow-hidden">
              <div className="absolute top-4 right-6 w-20 h-20 rounded-full border border-white/10" />
              <div className="absolute -bottom-6 right-16 w-28 h-28 rounded-full border border-white/5" />
              <div className="absolute top-8 right-32 w-3 h-3 rounded-full bg-white/20" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 flex-shrink-0">
                  <Car className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Enter Registration Number</h2>
                  <p className="text-white/70 text-sm">We&apos;ll fetch everything from VAHAN automatically</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Vehicle Number */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <Car className="w-4 h-4 text-yellow-500" />
                    Vehicle Number
                  </label>
                  <div className="relative">
                    <input type="text" placeholder="KA 01 AB 1234" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} disabled={loading}
                      className="w-full h-14 rounded-xl border-2 border-gray-200 bg-gray-50 px-5 text-xl font-mono font-black tracking-[0.25em] text-gray-900 placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal placeholder:text-base focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-60 transition-all" />
                    {registrationNumber && !loading && (
                      <button type="button" onClick={() => setRegistrationNumber("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Enter exactly as shown on the number plate
                  </p>
                </div>

                {/* Vehicle Usage */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-yellow-500" />
                    Vehicle Usage
                  </label>
                  <div className="relative inline-flex w-80 p-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span
                      aria-hidden
                      className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-yellow-400 shadow-sm transition-transform duration-300 ease-out ${vehicleUsage === "COMMERCIAL" ? "translate-x-full" : "translate-x-0"}`}
                    />
                    {[
                      { val: "PRIVATE" as const, label: "Private", Icon: ShieldCheck },
                      { val: "COMMERCIAL" as const, label: "Commercial", Icon: Package },
                    ].map((u) => (
                      <button
                        key={u.val}
                        type="button"
                        onClick={() => setVehicleUsage(u.val)}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-1 h-8 rounded-full text-xs font-semibold transition-colors ${vehicleUsage === u.val ? "text-gray-900" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
                      >
                        <u.Icon className="w-3.5 h-3.5" />
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error / Success */}
                {error && (
                  <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3.5 dark:bg-red-500/10 dark:border-red-500/20">
                    <Info className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3.5 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
                  </div>
                )}

                {/* Vehicle Group (required) */}
                {renderGroupSelector()}

                {/* Vehicle Photos */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <ImageIcon className="w-4 h-4 text-yellow-500" />
                    Vehicle Photos <span className="text-gray-400 font-normal normal-case">(optional)</span>
                  </label>
                  {vehicleImages.length > 0 ? (
                    <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50/50 dark:border-yellow-500/20 dark:bg-yellow-500/5 p-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {vehicleImages.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-500/20 text-xs">
                            <ImageIcon className="w-4 h-4 text-yellow-500" />
                            <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px] font-medium">{f.name}</span>
                            <button type="button" onClick={() => setVehicleImages((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-500 ml-0.5">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-yellow-700 dark:text-yellow-400 font-medium">{vehicleImages.length} photo{vehicleImages.length > 1 ? "s" : ""} selected</span>
                        <div className="flex gap-2">
                          <label className="text-[11px] font-semibold text-yellow-600 hover:text-yellow-700 cursor-pointer">
                            + Add more
                            <input type="file" accept=".jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const newFiles = Array.from(e.target.files || []); setVehicleImages((prev) => [...prev, ...newFiles]); e.target.value = ""; }} />
                          </label>
                          <button type="button" onClick={() => setVehicleImages([])} className="text-[11px] font-semibold text-red-500 hover:text-red-600">Clear all</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500/50 cursor-pointer transition-all group">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-yellow-100 dark:group-hover:bg-yellow-500/10 flex items-center justify-center transition-colors flex-shrink-0">
                        <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-yellow-500 transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-yellow-600 transition-colors">Upload vehicle photos</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">JPG, PNG — max 10MB each, up to 10 photos</p>
                      </div>
                      <input type="file" accept=".jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const newFiles = Array.from(e.target.files || []); setVehicleImages((prev) => [...prev, ...newFiles]); e.target.value = ""; }} />
                    </label>
                  )}
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading || !!success}
                  className="w-full h-13 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold text-base shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] flex items-center justify-center gap-2">
                  {loading ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processing...</>
                  ) : success ? (
                    <><Check className="w-4 h-4" />Redirecting...</>
                  ) : (
                    <><Plus className="w-4 h-4" />Onboard Vehicle</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right — Steps */}
        <div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02] sticky top-24">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5">Onboarding Pipeline</h3>
            <div className="relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-5">
                {STEPS.map((step, i) => {
                  const isDone = activeStep > i;
                  const isActive = activeStep === i;
                  return (
                    <div key={i} className="relative flex gap-4 pl-1">
                      <div className={`relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center transition-all duration-500 ${isDone ? "bg-success-500 text-white shadow-md shadow-success-500/30" : isActive ? "bg-brand-500 text-white shadow-md shadow-brand-500/30 animate-pulse" : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"}`}>
                        {isDone ? (
                          <Check className="w-4 h-4" strokeWidth={3} />
                        ) : isActive ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <span className="text-xs font-bold">{i + 1}</span>
                        )}
                      </div>
                      <div className={`flex-1 pb-1 transition-all duration-300 ${isActive ? "opacity-100" : isDone ? "opacity-70" : "opacity-50"}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`${isActive || isDone ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>{step.icon}</span>
                          <h4 className={`text-sm font-semibold ${isActive ? "text-brand-600 dark:text-brand-400" : isDone ? "text-success-600 dark:text-success-400" : "text-gray-600 dark:text-gray-400"}`}>{step.title}</h4>
                          {isDone && <span className="text-[10px] font-bold text-success-600 bg-success-50 dark:bg-success-500/10 dark:text-success-400 px-1.5 py-0.5 rounded-md">DONE</span>}
                          {isActive && <span className="text-[10px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-500/10 dark:text-brand-400 px-1.5 py-0.5 rounded-md">IN PROGRESS</span>}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 ml-7">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
                {activeStep >= STEPS.length && (
                  <div className="relative flex gap-4 pl-1">
                    <div className="relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center bg-success-500 text-white shadow-md shadow-success-500/30">
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-success-600 dark:text-success-400">Vehicle Onboarded!</h4>
                      <p className="text-xs text-gray-400 ml-0 mt-0.5">Redirecting to vehicle details...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tips */}
            {activeStep < 0 && (
              <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Tips</h4>
                <ul className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <li className="flex items-start gap-2"><span className="text-brand-500 mt-0.5">&#x2022;</span>Enter the number exactly as shown on the plate</li>
                  <li className="flex items-start gap-2"><span className="text-brand-500 mt-0.5">&#x2022;</span>Select a vehicle group to determine required documents</li>
                  <li className="flex items-start gap-2"><span className="text-brand-500 mt-0.5">&#x2022;</span>A unique QR code will be generated for each vehicle</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* ── MANUAL MODE ── */}
      {mode === "manual" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden shadow-xl shadow-gray-200/30 dark:shadow-none">
            {/* Hero */}
            <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 px-8 py-10 overflow-hidden">
              <div className="absolute top-6 right-8 w-32 h-32 rounded-full border border-yellow-500/10" />
              <div className="absolute top-3 right-5 w-32 h-32 rounded-full border border-yellow-500/5" />
              <div className="absolute bottom-4 left-1/3 w-20 h-20 rounded-full bg-yellow-500/5 blur-xl" />
              <div className="absolute top-1/2 right-1/4 w-2 h-2 rounded-full bg-yellow-500/30" />
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                    <Pencil className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Manual Vehicle Onboard</h2>
                    <p className="text-white/50 text-sm mt-0.5">Enter details manually and upload compliance documents</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-5">
                  {["Vehicle Info", "Documents"].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-[10px] font-bold text-yellow-400">{i + 1}</div>
                      <span className="text-xs text-white/40 font-medium">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="p-6 sm:p-8 space-y-8">
              {/* Vehicle Info */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-yellow-500/20">
                    <Car className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Vehicle Information</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Basic vehicle details and specifications</p>
                  </div>
                </div>

                {/* Registration Number */}
                <div className="mb-5 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <label className="mb-2 block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Registration Number <span className="text-red-500">*</span></label>
                  <input type="text" name="registrationNumber" placeholder="KA 01 AB 1234" value={mf.registrationNumber} onChange={handleMfChange} className="w-full h-14 rounded-xl border-2 border-gray-300 bg-white px-5 text-xl font-mono font-black tracking-[0.25em] text-gray-900 placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal placeholder:text-base focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-600 dark:bg-gray-900 dark:text-white transition-all" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {([
                    { name: "ownerName", label: "Owner Name", placeholder: "Vehicle owner", req: false },
                    { name: "make", label: "Make", placeholder: "e.g. Tata, Mahindra", req: true },
                    { name: "model", label: "Model", placeholder: "e.g. Ace Gold, Bolero", req: true },
                  ]).map((f) => (
                    <div key={f.name} className="group">
                      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{f.label} {f.req && <span className="text-red-500">*</span>}</label>
                      <input type="text" name={f.name} placeholder={f.placeholder} value={mf[f.name] || ""} onChange={handleMfChange} className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-yellow-500 transition-all group-hover:border-gray-300 dark:group-hover:border-gray-600" />
                    </div>
                  ))}
                </div>

                {/* Vehicle Group (required) */}
                <div className="mt-5">
                  {renderGroupSelector()}
                </div>

                {/* Fuel Type */}
                <div className="mt-5">
                  <label className="mb-2.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fuel Type</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                    {[
                      { val: "Petrol", Icon: Flame },
                      { val: "Diesel", Icon: Moon },
                      { val: "CNG", Icon: Sun },
                      { val: "Electric", Icon: Zap },
                      { val: "Hybrid", Icon: Radio },
                    ].map((f) => (
                      <button key={f.val} type="button" onClick={() => setMf({ ...mf, fuelType: f.val })}
                        className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all ${mf.fuelType === f.val ? "border-yellow-400 bg-yellow-50 shadow-sm dark:bg-yellow-500/10 dark:border-yellow-500" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"}`}>
                        <f.Icon className={`w-5 h-5 ${mf.fuelType === f.val ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400"}`} />
                        <span className={`text-xs font-semibold ${mf.fuelType === f.val ? "text-yellow-700 dark:text-yellow-400" : "text-gray-600 dark:text-gray-400"}`}>{f.val}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vehicle Usage */}
                <div className="mt-5">
                  <label className="mb-2.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vehicle Usage</label>
                  <div className="relative inline-flex w-80 p-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span
                      aria-hidden
                      className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-yellow-400 shadow-sm transition-transform duration-300 ease-out ${vehicleUsage === "COMMERCIAL" ? "translate-x-full" : "translate-x-0"}`}
                    />
                    {[
                      { val: "PRIVATE" as const, label: "Private", Icon: ShieldCheck },
                      { val: "COMMERCIAL" as const, label: "Commercial", Icon: Package },
                    ].map((u) => (
                      <button
                        key={u.val}
                        type="button"
                        onClick={() => setVehicleUsage(u.val)}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-1 h-8 rounded-full text-xs font-semibold transition-colors ${vehicleUsage === u.val ? "text-gray-900" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
                      >
                        <u.Icon className="w-3.5 h-3.5" />
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Permit Type */}
                <div className="mt-5">
                  <label className="mb-2.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Permit Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { val: "GOODS", label: "Goods", desc: "Cargo transport", Icon: Package },
                      { val: "PASSENGER", label: "Passenger", desc: "People transport", Icon: Users },
                      { val: "NATIONAL", label: "National", desc: "All India permit", Icon: MapPin },
                      { val: "STATE", label: "State", desc: "Within state", Icon: Globe },
                    ].map((p) => (
                      <button key={p.val} type="button" onClick={() => setMf({ ...mf, permitType: p.val })}
                        className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl border-2 transition-all ${mf.permitType === p.val ? "border-yellow-400 bg-yellow-50 shadow-sm dark:bg-yellow-500/10 dark:border-yellow-500" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"}`}>
                        <p.Icon className={`w-5 h-5 ${mf.permitType === p.val ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400"}`} />
                        <span className={`text-xs font-bold ${mf.permitType === p.val ? "text-yellow-700 dark:text-yellow-400" : "text-gray-700 dark:text-gray-300"}`}>{p.label}</span>
                        <span className="text-[9px] text-gray-400 leading-tight">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Technical specs */}
                <div className="mt-5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Technical Specs (Optional)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {([
                      { name: "chassisNumber", label: "Chassis No.", placeholder: "CHAS...", inputType: "text" },
                      { name: "engineNumber", label: "Engine No.", placeholder: "ENG...", inputType: "text" },
                      { name: "gvw", label: "GVW (kg)", placeholder: "9000", inputType: "number" },
                      { name: "seatingCapacity", label: "Seats", placeholder: "5", inputType: "number" },
                    ]).map((f) => (
                      <div key={f.name}>
                        <label className="mb-1 block text-[10px] font-medium text-gray-400 dark:text-gray-500">{f.label}</label>
                        <input type={f.inputType} name={f.name} placeholder={f.placeholder} value={mf[f.name] || ""} onChange={handleMfChange} className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs text-gray-800 placeholder:text-gray-400 focus:border-yellow-400 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white transition-all" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

              {/* Dynamic Compliance Documents */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-yellow-500/20">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Compliance Documents</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Upload documents and set expiry dates (defaults to 1 year if blank)</p>
                  </div>
                </div>

                {!selectedGroupId ? (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
                    <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Select a vehicle group above</p>
                    <p className="text-xs text-gray-400 mt-1">Required documents will appear based on the selected group</p>
                  </div>
                ) : loadingDocTypes ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
                          <div><div className="h-3.5 w-28 bg-gray-200 dark:bg-gray-700 rounded" /><div className="h-2.5 w-12 bg-gray-200 dark:bg-gray-700 rounded mt-1.5" /></div>
                        </div>
                        <div className="h-9 w-full bg-gray-100 dark:bg-gray-800 rounded-lg" />
                        <div className="h-16 w-full bg-gray-100 dark:bg-gray-800 rounded-lg mt-3 border-2 border-dashed border-gray-200 dark:border-gray-700" />
                      </div>
                    ))}
                  </div>
                ) : requiredDocTypes.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5 p-6 text-center">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">No document types configured for this group</p>
                    <p className="text-xs text-amber-600/70 mt-1">Go to Vehicle Groups settings to configure required documents</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {requiredDocTypes.map((dt) => {
                      const expiryKey = `${dt.code.toLowerCase()}Expiry`;
                      const fileKey = `${dt.code.toLowerCase()}File`;
                      const hasFile = !!docFiles[fileKey];
                      return (
                        <div key={dt.id} className={`relative rounded-xl border-2 p-4 transition-all duration-200 ${hasFile ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-500/30 dark:bg-emerald-500/5" : "border-gray-200 bg-white hover:border-yellow-300 dark:border-gray-700 dark:bg-gray-800/30 dark:hover:border-yellow-500/30"}`}>
                          {hasFile && (
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </div>
                          )}
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hasFile ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-gray-100 dark:bg-gray-700"}`}>
                              <FileText className={`w-4 h-4 ${hasFile ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500"}`} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{dt.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] text-gray-400 font-mono">{dt.code}</p>
                                {!dt.hasExpiry && <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">NO EXPIRY</span>}
                              </div>
                            </div>
                          </div>

                          {dt.hasExpiry && (
                            <div className="mb-3">
                              <label className="mb-1 block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Expiry Date</label>
                              <DatePicker value={docExpiries[expiryKey] || ""} onChange={(v) => setDocExpiries({ ...docExpiries, [expiryKey]: v })} placeholder="Select expiry date" />
                            </div>
                          )}

                          {!hasFile ? (
                            <label className="flex flex-col items-center justify-center py-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500/50 cursor-pointer transition-colors group">
                              <Upload className="w-6 h-6 text-gray-300 dark:text-gray-600 group-hover:text-yellow-500 transition-colors" />
                              <span className="text-[11px] text-gray-400 group-hover:text-yellow-600 font-medium mt-1">Click to upload</span>
                              <span className="text-[9px] text-gray-300 dark:text-gray-600 mt-0.5">PDF, JPG, PNG (max 10MB)</span>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setDocFiles((prev) => ({ ...prev, [fileKey]: e.target.files?.[0] || null }))} />
                            </label>
                          ) : (
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium truncate">{docFiles[fileKey]!.name}</span>
                              </div>
                              <button type="button" onClick={() => setDocFiles((prev) => ({ ...prev, [fileKey]: null }))} className="text-[10px] text-red-500 hover:text-red-600 font-semibold flex-shrink-0 ml-2">Remove</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedGroupId && requiredDocTypes.length > 0 && (
                  <p className="mt-3 text-[11px] text-gray-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Accepted: PDF, JPG, JPEG, PNG (max 10MB). Documents can also be uploaded later.
                  </p>
                )}
              </div>

              {/* Vehicle Images */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-yellow-500/20">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Vehicle Photos</h3>
                    <p className="text-[11px] text-gray-400">Upload multiple photos of the vehicle (optional)</p>
                  </div>
                </div>
                <label className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-yellow-400 dark:hover:border-yellow-500/50 cursor-pointer transition-colors group">
                  <ImageIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 group-hover:text-yellow-500 transition-colors" />
                  <span className="text-xs text-gray-400 group-hover:text-yellow-600 font-medium mt-2">Click to upload vehicle photos</span>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">JPG, PNG (max 10MB each, up to 10 photos)</span>
                  <input type="file" accept=".jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const newFiles = Array.from(e.target.files || []); setVehicleImages((prev) => [...prev, ...newFiles]); e.target.value = ""; }} />
                </label>
                {vehicleImages.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {vehicleImages.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-400">
                        <ImageIcon className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{f.name}</span>
                        <button type="button" onClick={() => setVehicleImages((prev) => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-600 ml-0.5">&times;</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setVehicleImages([])} className="text-[10px] text-red-500 hover:text-red-600 font-medium px-2 py-1">Clear all</button>
                  </div>
                )}
              </div>

              {/* Tyre Profile (Optional) */}
              {selectedGroupId && tyreForm.length > 0 && (
                <div>
                  <div className={`rounded-xl border-2 transition-all ${showTyreSection ? "border-gray-200 dark:border-gray-700" : "border-dashed border-gray-200 dark:border-gray-700"}`}>
                    <button type="button" onClick={() => setShowTyreSection(!showTyreSection)}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <Circle className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tyre Profile <span className="text-gray-400 font-normal normal-case">(optional)</span></p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{tyreForm.length} positions based on vehicle group</p>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTyreSection ? "rotate-180" : ""}`} />
                    </button>
                    {showTyreSection && (
                      <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {tyreForm.map((tyre, idx) => (
                            <div key={tyre.position} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                                  {TYRE_LABELS[tyre.position] || tyre.position}
                                </span>
                                <select value={tyre.condition} onChange={(e) => { const n = [...tyreForm]; n[idx] = { ...n[idx], condition: e.target.value }; setTyreForm(n); }}
                                  className="text-[10px] font-semibold rounded-lg border border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none">
                                  <option value="GOOD">Good</option>
                                  <option value="AVERAGE">Average</option>
                                  <option value="REPLACE">Replace</option>
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Brand" value={tyre.brand} onChange={(e) => { const n = [...tyreForm]; n[idx] = { ...n[idx], brand: e.target.value }; setTyreForm(n); }}
                                  className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                <input type="text" placeholder="Size (215/60 R16)" value={tyre.size} onChange={(e) => { const n = [...tyreForm]; n[idx] = { ...n[idx], size: e.target.value }; setTyreForm(n); }}
                                  className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] text-gray-400">Fill in details for tyres you know. Leave blank for positions you want to add later.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 dark:bg-red-500/10 dark:border-red-500/20">
                  <Info className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={manualLoading}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {manualLoading ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Onboarding...</>
                  ) : (
                    <><Plus className="w-4 h-4" />Onboard Vehicle</>
                  )}
                </button>
                <Link href="/vehicles" className="h-12 px-6 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 flex items-center transition-all">
                  Cancel
                </Link>
              </div>
            </form>
          </div>

          {/* Right — Guide Panel */}
          <div>
            <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5">How Manual Onboarding Works</h3>
              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-5">
                  {[
                    { num: "1", title: "Select Vehicle Group", desc: "Choose the vehicle type to determine required documents", Icon: LayoutGrid },
                    { num: "2", title: "Enter Vehicle Info", desc: "Registration number, make, model, fuel type, and permit details", Icon: Car },
                    { num: "3", title: "Upload Documents", desc: "Upload required compliance documents for the selected group", Icon: Upload },
                    { num: "4", title: "QR Code Generated", desc: "A unique QR code is auto-generated for instant vehicle verification", Icon: LayoutGrid },
                    { num: "5", title: "Vehicle Ready", desc: "Vehicle is added to your fleet with compliance tracking enabled", Icon: CheckCircle2 },
                  ].map((step) => (
                    <div key={step.num} className="relative flex gap-4 pl-1">
                      <div className="relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{step.num}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <step.Icon className="w-4 h-4 text-yellow-500" />
                          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{step.title}</h4>
                        </div>
                        <p className="text-xs text-gray-400 ml-6">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                Tips
              </h3>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li className="flex items-start gap-2"><span className="text-yellow-500 mt-0.5 flex-shrink-0">&#x2022;</span>Select a vehicle group first — required documents depend on it</li>
                <li className="flex items-start gap-2"><span className="text-yellow-500 mt-0.5 flex-shrink-0">&#x2022;</span>Documents can be uploaded now or later from the vehicle detail page</li>
                <li className="flex items-start gap-2"><span className="text-yellow-500 mt-0.5 flex-shrink-0">&#x2022;</span>Accepted formats: PDF, JPG, JPEG, PNG (max 10MB each)</li>
                <li className="flex items-start gap-2"><span className="text-yellow-500 mt-0.5 flex-shrink-0">&#x2022;</span>Expiry dates left blank default to 1 year from today</li>
                <li className="flex items-start gap-2"><span className="text-yellow-500 mt-0.5 flex-shrink-0">&#x2022;</span>Compliance status auto-calculated: Green ({">"}30d), Yellow (8-30d), Red ({"<"}7d)</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-yellow-200 bg-yellow-50/50 p-5 dark:border-yellow-500/20 dark:bg-yellow-500/5">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-1">Prefer auto onboarding?</p>
              <p className="text-xs text-yellow-700/70 dark:text-yellow-400/60 mb-3">Switch to Auto mode to fetch vehicle details from VAHAN database automatically.</p>
              <button onClick={() => { setMode("auto"); setError(""); setSuccess(null); }}
                className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 flex items-center gap-1 transition-colors">
                Switch to Auto (VAHAN) &rarr;
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
