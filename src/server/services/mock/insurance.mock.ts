import "server-only";

const providers = [
  { name: "ICICI Lombard", logo: "icici", claimRatio: "98.2%", rating: 4.5 },
  { name: "HDFC Ergo", logo: "hdfc", claimRatio: "97.8%", rating: 4.4 },
  { name: "Bajaj Allianz", logo: "bajaj", claimRatio: "96.5%", rating: 4.3 },
  { name: "New India Assurance", logo: "newindia", claimRatio: "95.1%", rating: 4.1 },
  { name: "Tata AIG", logo: "tata", claimRatio: "97.0%", rating: 4.4 },
  { name: "Acko", logo: "acko", claimRatio: "98.5%", rating: 4.6 },
  { name: "Digit Insurance", logo: "digit", claimRatio: "97.3%", rating: 4.5 },
  { name: "SBI General", logo: "sbi", claimRatio: "94.8%", rating: 4.0 },
];

const coverageOptions: Record<string, string[]> = {
  Comprehensive: ["Own Damage", "Third Party Liability", "Personal Accident", "Fire & Theft"],
  "Third Party": ["Third Party Liability", "Personal Accident"],
  "Own Damage": ["Own Damage", "Fire & Theft", "Natural Calamity"],
};

const addOnsList = [
  "Zero Depreciation", "Engine Protect", "Roadside Assistance", "Return to Invoice",
  "Key Replacement", "Tyre Protect", "Consumables Cover", "NCB Protect",
  "Passenger Cover", "EMI Protect", "Daily Allowance",
];

function getBasePremium(vehicleType: string): number {
  const base: Record<string, number> = {
    "Private Car": 3500,
    Commercial: 8000,
    "Two Wheeler": 1200,
    Passenger: 12000,
    SUV: 5500,
    Truck: 9500,
  };
  return base[vehicleType] ?? 4000;
}

export type InsurancePlan = {
  id: string;
  provider: string;
  providerLogo: string;
  planName: string;
  premium: number;
  coverage: string[];
  addOns: string[];
  claimSettlementRatio: string;
  rating: number;
  isRenewal: boolean;
  features: string[];
};

export function getPlans(
  _vehicleNumber: string,
  vehicleType: string,
  previousInsurer: string | null,
): InsurancePlan[] {
  const basePremium = getBasePremium(vehicleType || "Private Car");

  return providers
    .map((provider, i) => {
      const isRenewal = Boolean(previousInsurer) && provider.name === previousInsurer;
      const discount = isRenewal ? 0.15 : Math.random() * 0.1;
      const variation = 0.8 + Math.random() * 0.5;

      const plans: InsurancePlan[] = [];
      const compPremium = Math.round(basePremium * variation * (1 - discount));
      const numAddOns = 3 + Math.floor(Math.random() * 4);
      const selectedAddOns = [...addOnsList]
        .sort(() => Math.random() - 0.5)
        .slice(0, numAddOns);

      plans.push({
        id: `plan-${provider.logo}-comp-${i}`,
        provider: provider.name,
        providerLogo: provider.logo,
        planName: "Comprehensive",
        premium: compPremium,
        coverage: coverageOptions.Comprehensive,
        addOns: selectedAddOns,
        claimSettlementRatio: provider.claimRatio,
        rating: provider.rating,
        isRenewal,
        features: [
          "Cashless repairs at 5000+ garages",
          "24/7 claim assistance",
          isRenewal ? "Renewal discount applied" : "New customer offer",
        ],
      });

      if (i % 2 === 0) {
        plans.push({
          id: `plan-${provider.logo}-tp-${i}`,
          provider: provider.name,
          providerLogo: provider.logo,
          planName: "Third Party Only",
          premium: Math.round(compPremium * 0.35),
          coverage: coverageOptions["Third Party"],
          addOns: ["Personal Accident Cover"],
          claimSettlementRatio: provider.claimRatio,
          rating: provider.rating,
          isRenewal,
          features: ["Mandatory as per law", "Third party liability coverage"],
        });
      }

      return plans;
    })
    .flat()
    .sort((a, b) => a.premium - b.premium);
}

export { providers };
