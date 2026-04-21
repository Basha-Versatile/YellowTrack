import "server-only";

/**
 * Mock DL (Driving License) Verification API.
 * Simulates Sarathi/Parivahan lookup. 1:1 port of backend/src/services/mock/dl.mock.js.
 */

export type MockDlRecord = {
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  vehicleClass: string;
  aadhaarLast4: string;
  bloodGroup: string;
  fatherName: string;
  permanentAddress: string;
  verified: true;
};

const firstNames = [
  "Rajesh", "Suresh", "Manoj", "Vinod", "Arun", "Sanjay",
  "Ramesh", "Deepak", "Kiran", "Naveen",
];
const lastNames = [
  "Kumar", "Singh", "Sharma", "Reddy", "Rao", "Patel",
  "Das", "Yadav", "Verma", "Gupta",
];
const vehicleClasses = ["LMV", "HMV", "HGMV", "HPMV", "TRANS"];
const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const fatherFirstNames = [
  "Mohan", "Ramesh", "Sunil", "Ashok", "Vijay", "Prakash",
  "Mahesh", "Gopal", "Ravi", "Satish",
];

export async function fetchDriverByLicense(
  licenseNumber: string,
): Promise<MockDlRecord> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const normalized = licenseNumber.toUpperCase().replace(/\s/g, "");
  const hash = normalized
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const expiryDays = 365 + (hash % 730);
  const licenseExpiry = new Date(Date.now() + expiryDays * 86_400_000);

  const firstName = firstNames[hash % firstNames.length];
  const lastName = lastNames[(hash * 3) % lastNames.length];

  return {
    name: `${firstName} ${lastName}`,
    phone: `9${String(hash).padStart(9, "0").slice(0, 9)}`,
    licenseNumber: normalized,
    licenseExpiry: licenseExpiry.toISOString(),
    vehicleClass: vehicleClasses[hash % vehicleClasses.length],
    aadhaarLast4: String(hash).slice(-4).padStart(4, "0"),
    bloodGroup: bloodGroups[hash % bloodGroups.length],
    fatherName: `${fatherFirstNames[hash % fatherFirstNames.length]} ${lastName}`,
    permanentAddress: `${(hash % 500) + 1}, Ward ${(hash % 30) + 1}, Sector ${(hash % 50) + 1}, Bangalore, Karnataka - ${560_000 + (hash % 100)}`,
    verified: true,
  };
}
