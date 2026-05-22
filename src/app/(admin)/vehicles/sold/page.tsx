"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { vehicleAPI } from "@/lib/api";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";
import { SearchInput } from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import { VehiclesListSkeleton } from "@/components/ui/Skeleton";
import {
  ChevronRight,
  Truck,
  Phone,
  Mail,
  IndianRupee,
  Calendar,
  Check,
  AlertTriangle,
  FileText,
  User,
} from "lucide-react";

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

interface SoldVehicle {
  id: string;
  registrationNumber: string;
  ownerName: string | null;
  make: string;
  model: string;
  fuelType: string;
  profileImage: string | null;
  vehicleUsage: "PRIVATE" | "COMMERCIAL" | null;
  group?: { id: string; name: string; icon: string; color?: string } | null;
  sale: {
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
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function SoldVehiclesPage() {
  const [vehicles, setVehicles] = useState<SoldVehicle[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchSold = async (page = 1) => {
    setLoading(true);
    try {
      const res = await vehicleAPI.getAll({
        page,
        limit: 10,
        lifecycle: "SOLD",
        search: search.trim() || undefined,
      });
      setVehicles(res.data.data.vehicles);
      setPagination(res.data.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSold(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search
  const [didMount, setDidMount] = useState(false);
  useEffect(() => {
    if (!didMount) {
      setDidMount(true);
      return;
    }
    const t = setTimeout(() => fetchSold(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalProceeds = useMemo(
    () =>
      vehicles.reduce((sum, v) => sum + (v.sale?.soldPrice ?? 0), 0),
    [vehicles],
  );

  if (loading) return <VehiclesListSkeleton view="list" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Sold Vehicles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {pagination.total} vehicle{pagination.total !== 1 ? "s" : ""} sold {totalProceeds > 0 && <>· total proceeds &#8377;{totalProceeds.toLocaleString("en-IN")}</>}
          </p>
        </div>
        <SearchInput
          className="w-full sm:w-72"
          value={search}
          onChange={setSearch}
          placeholder="Search by reg, make, model…"
        />
      </div>

      {/* Empty state */}
      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-white/[0.02] p-16 text-center">
          <Truck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No sold vehicles yet</p>
          <p className="text-xs text-gray-400 mt-1">When you mark a vehicle as sold, it appears here with full sale details.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => {
            const sale = v.sale;
            return (
              <div
                key={v.id}
                className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden"
              >
                {/* Header row */}
                <div className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-800">
                  {(() => {
                    const GroupIcon = v.group?.icon ? getVehicleTypeIcon(v.group.icon) : Truck;
                    return v.profileImage ? (
                      <img
                        src={`${resolveImageUrl(v.profileImage) ?? ""}`}
                        alt={v.registrationNumber}
                        className="w-12 h-12 rounded-xl object-cover shadow-sm flex-shrink-0"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 bg-gray-100 dark:bg-gray-800"
                        style={v.group?.color ? { backgroundColor: v.group.color + "12" } : undefined}
                      >
                        <GroupIcon className="w-5 h-5" style={v.group?.color ? { color: v.group.color } : { color: "#9ca3af" }} />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white font-mono tracking-wider">
                        {v.registrationNumber}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">Sold</span>
                      {sale && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(sale.saleDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    {v.ownerName && (
                      <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate mt-0.5" title={v.ownerName}>{titleCase(v.ownerName)}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-400 dark:text-gray-500">{titleCase(v.make)}</span>
                      <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{titleCase(v.model)}</span>
                      <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                      <span>{titleCase(v.fuelType)}</span>
                      {v.group && (() => {
                        const GIcon = getVehicleTypeIcon(v.group.icon);
                        return (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                            <span className="text-brand-500 dark:text-brand-400 font-medium inline-flex items-center gap-0.5">
                              <GIcon className="w-3 h-3" />
                              {v.group.name}
                            </span>
                          </>
                        );
                      })()}
                    </p>
                  </div>
                  <Link
                    href={`/vehicles/${v.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors flex-shrink-0"
                  >
                    View
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Sale details */}
                {sale ? (
                  <div className="p-4 grid grid-cols-1 2xsm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3" /> Buyer
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{sale.buyerName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone
                      </p>
                      <a href={`tel:+91${sale.buyerPhone}`} className="text-sm font-semibold text-gray-900 dark:text-white truncate hover:text-brand-500">
                        +91 {sale.buyerPhone}
                      </a>
                    </div>
                    {sale.buyerEmail && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Mail className="w-3 h-3" /> Email
                        </p>
                        <a href={`mailto:${sale.buyerEmail}`} className="text-sm font-semibold text-gray-900 dark:text-white truncate hover:text-brand-500 block">
                          {sale.buyerEmail}
                        </a>
                      </div>
                    )}
                    {sale.soldPrice != null && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" /> Sold Price
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          &#8377;{sale.soldPrice.toLocaleString("en-IN")}
                        </p>
                      </div>
                    )}

                    {/* Status pills row */}
                    <div className="col-span-full flex items-center gap-2 flex-wrap pt-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${sale.pendingChallansCleared ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}>
                        {sale.pendingChallansCleared ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {sale.pendingChallansCleared ? "Challans Cleared" : "Challans Pending"}
                      </span>
                      {sale.buyerDocumentUrls.map((u, i) => (
                        <a
                          key={`b-${i}`}
                          href={resolveImageUrl(u) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20 transition-colors"
                        >
                          <FileText className="w-3 h-3" /> Buyer #{i + 1}
                        </a>
                      ))}
                      {sale.transferDocumentUrls.map((u, i) => (
                        <a
                          key={`t-${i}`}
                          href={resolveImageUrl(u) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20 transition-colors"
                        >
                          <FileText className="w-3 h-3" /> Transfer #{i + 1}
                        </a>
                      ))}
                    </div>

                    {sale.notes && (
                      <div className="col-span-full pt-1">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{sale.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-xs text-gray-400">No sale record attached.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          itemLabel="vehicles"
          onPageChange={(p) => fetchSold(p)}
        />
      )}
    </div>
  );
}
