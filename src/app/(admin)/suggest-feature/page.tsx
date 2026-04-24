"use client";
import React, { useCallback, useEffect, useState } from "react";
import { featureSuggestionAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Lightbulb, Send, Clock, CheckCircle2, XCircle, Eye, Sparkles } from "lucide-react";

type Suggestion = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: "NEW" | "UNDER_REVIEW" | "PLANNED" | "IMPLEMENTED" | "REJECTED";
  adminResponse: string | null;
  createdAt: string;
};

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "NEW_FEATURE", label: "New Feature" },
  { value: "IMPROVEMENT", label: "Improvement" },
  { value: "BUG_REPORT", label: "Bug Report" },
  { value: "UI_UX", label: "UI / UX" },
  { value: "PERFORMANCE", label: "Performance" },
  { value: "INTEGRATION", label: "Integration" },
  { value: "OTHER", label: "Other" },
];

const PRIORITIES: Array<{ value: string; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const STATUS_STYLES: Record<Suggestion["status"], { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  NEW: { label: "New", className: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20", Icon: Sparkles },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", Icon: Eye },
  PLANNED: { label: "Planned", className: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20", Icon: Clock },
  IMPLEMENTED: { label: "Implemented", className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20", Icon: CheckCircle2 },
  REJECTED: { label: "Not Planned", className: "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700", Icon: XCircle },
};

export default function SuggestFeaturePage() {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("NEW_FEATURE");
  const [priority, setPriority] = useState("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await featureSuggestionAPI.getMine();
      setSuggestions(res.data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) { toast.error("Title too short", "Please enter at least 5 characters"); return; }
    if (description.trim().length < 20) { toast.error("More detail needed", "Please describe your idea in at least 20 characters"); return; }
    setSubmitting(true);
    try {
      await featureSuggestionAPI.create({ title: title.trim(), description: description.trim(), category, priority });
      toast.success("Suggestion submitted", "Thanks for helping us improve YellowTrack!");
      setTitle(""); setDescription(""); setCategory("NEW_FEATURE"); setPriority("MEDIUM");
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error("Submission failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase = "w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white transition-all";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Hero */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-300 px-6 sm:px-8 py-6 relative overflow-hidden">
          <div className="absolute top-4 right-6 w-20 h-20 rounded-full border border-white/10" />
          <div className="absolute -bottom-6 right-16 w-28 h-28 rounded-full border border-white/5" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 flex-shrink-0">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Share your feedback</h1>
              <p className="text-white/80 text-xs sm:text-sm mt-0.5">Have an idea, a bug report, or an improvement that would make YellowTrack better? Tell us about it.</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</label>
            <input type="text" placeholder="e.g. Bulk upload vehicles from CSV" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
              className={`${inputBase} h-11`} />
            <p className="mt-1 text-[10px] text-gray-400">{title.length}/120</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputBase} h-11`}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => (
                  <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                    className={`h-11 rounded-xl border-2 text-xs font-semibold transition-all ${priority === p.value ? "border-yellow-400 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-500 dark:text-yellow-400" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Describe your idea</label>
            <textarea rows={6} placeholder="What problem does this solve? How should it work? Any examples from other tools you've used?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000}
              className={`${inputBase} py-3 resize-y`} />
            <p className="mt-1 text-[10px] text-gray-400">{description.length}/2000 · Minimum 20 characters</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="submit" disabled={submitting}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 disabled:opacity-50 flex items-center gap-2 transition-all">
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Submitting…
                </>
              ) : (
                <><Send className="w-4 h-4" /> Submit Suggestion</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* My submissions */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">My Suggestions</h3>
          {!loading && (
            <span className="text-[11px] text-gray-400">{suggestions.length} {suggestions.length === 1 ? "entry" : "entries"}</span>
          )}
        </div>
        <div className="p-6">
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-8">Loading…</p>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-10">
              <Lightbulb className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">You haven&apos;t submitted any suggestions yet.</p>
              <p className="text-xs text-gray-400 mt-1">Your submitted ideas will appear here with their review status.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => {
                const st = STATUS_STYLES[s.status];
                return (
                  <div key={s.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex-1 min-w-0">{s.title}</h4>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md ${st.className}`}>
                        <st.Icon className="w-3 h-3" />
                        {st.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-md">
                        {CATEGORIES.find((c) => c.value === s.category)?.label ?? s.category}
                      </span>
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-md">
                        {s.priority} priority
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{s.description}</p>
                    {s.adminResponse && (
                      <div className="mt-3 pl-3 border-l-2 border-yellow-400 bg-yellow-50/50 dark:bg-yellow-500/5 rounded-r-md py-2 pr-3">
                        <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-1">Team Response</p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{s.adminResponse}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
