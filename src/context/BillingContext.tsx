"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { billingAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export type BillingPlan = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  fleetSizeMin: number;
  fleetSizeMax: number | null;
  perVehiclePerMonth: number;
  perVehiclePerYear: number;
  perDriverPerMonth: number;
  customComplianceGroupPerMonth: number;
  gstPercent: number;
};

export type BillLineItem = {
  label: string;
  unitCount: number;
  unitPrice: number;
  amount: number;
};

export type BillingProjection = {
  tenantId: string;
  planId: string | null;
  planName: string | null;
  billingCycle: "MONTHLY" | "YEARLY";
  lineItems: BillLineItem[];
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
};

export type PendingUpgrade = {
  id: string;
  fromPlan: { id: string; name: string } | null;
  toPlan: { id: string; name: string };
  vehicleCountAtTrigger: number;
  expiresAt: string;
  createdAt: string;
};

export type BillingOverview = {
  tenant: {
    id: string;
    name: string;
    billingCycle: "MONTHLY" | "YEARLY";
    walletBalance: number;
    billingStatus: "ACTIVE" | "PAYMENT_DUE" | "SUSPENDED";
    paymentDueSince: string | null;
    lastBilledAt: string | null;
  };
  plan: BillingPlan | null;
  projection: BillingProjection;
  pendingUpgrade: PendingUpgrade | null;
};

type BillingContextType = {
  overview: BillingOverview | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const BillingContext = createContext<BillingContextType | undefined>(undefined);

/**
 * Wraps the admin app shell so the header badge, /billing page, banner and
 * upgrade modal all read from one cached overview. Refresh is exposed so
 * actions (recharge, decide upgrade) can re-pull without re-mounting.
 *
 * Quietly noops for SUPERADMIN sessions — they don't have a tenant scope
 * and the /billing/me endpoint rejects them on purpose.
 */
export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  const tenantScope =
    user && user.role !== "SUPERADMIN" && user.tenantId ? user.tenantId : null;

  const refresh = useCallback(async () => {
    if (!tenantScope) return;
    setLoading(true);
    try {
      const res = await billingAPI.getOverview();
      setOverview(res.data?.data as BillingOverview);
    } catch (err) {
      // Quietly fail — header badge just won't render. Console log so devs
      // can see when /billing/me is misbehaving.
      console.error("[billing] overview failed", err);
    } finally {
      setLoading(false);
    }
  }, [tenantScope]);

  // Initial pull whenever the signed-in tenant changes.
  useEffect(() => {
    if (!tenantScope) {
      setOverview(null);
      fetchedFor.current = null;
      return;
    }
    if (fetchedFor.current === tenantScope) return;
    fetchedFor.current = tenantScope;
    refresh();
  }, [tenantScope, refresh]);

  const value = useMemo(
    () => ({ overview, loading, refresh }),
    [overview, loading, refresh],
  );
  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
};

export function useBilling(): BillingContextType {
  const ctx = useContext(BillingContext);
  if (!ctx) {
    throw new Error("useBilling must be used inside a BillingProvider");
  }
  return ctx;
}
