import "server-only";

/**
 * Mock Challan API — simulates traffic violation lookup.
 * 1:1 port of backend/src/services/mock/challan.mock.js.
 */

const officers = [
  "SI Ramesh Kumar",
  "ASI Priya Sharma",
  "HC Suresh Rao",
  "Insp. Manoj Verma",
  "SI Deepak Singh",
  "ASI Kavitha R.",
];
const violations = [
  "Overspeeding",
  "Signal jump",
  "No parking",
  "Wrong lane driving",
  "No helmet",
  "Without seatbelt",
  "Overloading",
  "Expired permit",
  "Using mobile phone while driving",
  "Lane violation",
];
const locations = [
  "MG Road Junction",
  "Silk Board Signal",
  "KR Puram Flyover",
  "Electronic City Toll",
  "Hebbal Flyover",
  "Marathahalli Bridge",
  "Hosur Road",
  "Outer Ring Road",
];
const unitNames = [
  "Hyderabad",
  "Bangalore",
  "Mumbai",
  "Pune",
  "Delhi",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
];
const psLimitsList = [
  "Santosh Nagar Tr PS",
  "Madhapur Tr PS",
  "Banjara Hills Tr PS",
  "Begumpet Tr PS",
  "Jubilee Hills Tr PS",
  "Kukatpally Tr PS",
  "Miyapur Tr PS",
  "Gachibowli Tr PS",
];
const proofImages = [
  "https://placehold.co/600x400/ef4444/ffffff?text=Speed+Camera+Proof",
  "https://placehold.co/600x400/f97316/ffffff?text=CCTV+Capture",
  "https://placehold.co/600x400/eab308/ffffff?text=Traffic+Camera",
  "https://placehold.co/600x400/dc2626/ffffff?text=Red+Light+Camera",
  "https://placehold.co/600x400/d97706/ffffff?text=ANPR+Capture",
];

export type MockChallan = {
  amount: number;
  userCharges: number;
  issuedAt: string;
  source: string;
  status: "PENDING" | "PAID";
  location?: string | null;
  unitName?: string | null;
  psLimits?: string | null;
  challanNumber?: string | null;
  authorizedBy?: string | null;
  violation?: string | null;
  proofImageUrl?: string | null;
};

const challanDatabase: Record<string, MockChallan[]> = {
  KA01AB1234: [
    { amount: 500, userCharges: 0, issuedAt: "2025-12-15T10:30:00Z", source: "Bangalore Traffic Police", status: "PENDING", location: "MG Road Junction", unitName: "Bangalore", psLimits: "Madhapur Tr PS", challanNumber: "BTP-2025-00451", authorizedBy: "SI Ramesh Kumar", violation: "Overspeeding - 80km/h in 50km/h zone", proofImageUrl: "https://placehold.co/600x400/ef4444/ffffff?text=Speed+Camera+Proof" },
    { amount: 1000, userCharges: 50, issuedAt: "2025-11-20T14:15:00Z", source: "Karnataka RTO", status: "PAID", location: "KR Puram Flyover", unitName: "Bangalore", psLimits: "Begumpet Tr PS", challanNumber: "KRTO-2025-01234", authorizedBy: "ASI Priya Sharma", violation: "Signal jump at red light", proofImageUrl: "https://placehold.co/600x400/dc2626/ffffff?text=Red+Light+Camera" },
  ],
  MH02CD5678: [
    { amount: 2000, userCharges: 100, issuedAt: "2026-01-10T09:00:00Z", source: "Mumbai Traffic Police", status: "PENDING", location: "Andheri Signal", unitName: "Mumbai", psLimits: "Santosh Nagar Tr PS", challanNumber: "MTP-2026-00089", authorizedBy: "Insp. Manoj Verma", violation: "Wrong lane driving on highway", proofImageUrl: "https://placehold.co/600x400/f97316/ffffff?text=CCTV+Capture" },
    { amount: 500, userCharges: 0, issuedAt: "2025-10-05T16:45:00Z", source: "Pune RTO", status: "PENDING", location: "Hinjewadi Chowk", unitName: "Pune", psLimits: "Kukatpally Tr PS", challanNumber: "PRTO-2025-04521", authorizedBy: "HC Suresh Rao", violation: "No parking violation", proofImageUrl: null },
    { amount: 1500, userCharges: 75, issuedAt: "2025-09-22T11:30:00Z", source: "Maharashtra RTO", status: "PAID", location: "Pune-Mumbai Expressway", unitName: "Pune", psLimits: "Banjara Hills Tr PS", challanNumber: "MRTO-2025-07890", authorizedBy: "SI Deepak Singh", violation: "Overloading goods vehicle", proofImageUrl: "https://placehold.co/600x400/eab308/ffffff?text=Traffic+Camera" },
  ],
  DL04GH3456: [
    { amount: 5000, userCharges: 200, issuedAt: "2026-02-28T08:00:00Z", source: "Delhi Traffic Police", status: "PENDING", location: "ITO Signal", unitName: "Delhi", psLimits: "Jubilee Hills Tr PS", challanNumber: "DTP-2026-00234", authorizedBy: "ASI Kavitha R.", violation: "Driving without valid permit - commercial vehicle", proofImageUrl: "https://placehold.co/600x400/d97706/ffffff?text=ANPR+Capture" },
  ],
};

export async function fetchChallans(
  registrationNumber: string,
): Promise<MockChallan[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const normalized = registrationNumber.toUpperCase().replace(/\s/g, "");
  if (challanDatabase[normalized]) return challanDatabase[normalized];

  // deterministic pseudo-random challans for unknown vehicles
  const hash = normalized
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const count = (hash % 3) + 1;

  const sources = ["Traffic Police", "State RTO", "Highway Authority", "National Highway Patrol"];
  const challans: MockChallan[] = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = (hash + i * 37) % 180;
    const issuedDate = new Date(Date.now() - daysAgo * 86_400_000);
    const isPaid = i % 3 === 2;
    const fineAmount = (((hash + i * 13) % 10) + 1) * 500;
    const userCharge = ((hash + i) % 4) * 25;
    challans.push({
      amount: fineAmount,
      userCharges: userCharge,
      issuedAt: issuedDate.toISOString(),
      source: sources[(hash + i) % sources.length],
      status: isPaid ? "PAID" : "PENDING",
      location: locations[(hash + i) % locations.length],
      unitName: unitNames[(hash + i) % unitNames.length],
      psLimits: psLimitsList[(hash + i) % psLimitsList.length],
      challanNumber: `CH-${String(hash).slice(0, 4)}-${String(i + 1).padStart(3, "0")}`,
      authorizedBy: officers[(hash + i) % officers.length],
      violation: violations[(hash + i) % violations.length],
      proofImageUrl:
        (hash + i) % 3 !== 0 ? proofImages[(hash + i) % proofImages.length] : null,
    });
  }
  return challans;
}
