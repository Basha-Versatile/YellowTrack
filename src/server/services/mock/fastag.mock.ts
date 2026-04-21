import "server-only";

const tollPlazas = [
  "Kherki Daula Toll, NH-48", "Hirana Toll, NH-44", "Durgapur Expressway Toll",
  "Agra-Lucknow Expressway Toll", "Attari-Wagah Toll, NH-1", "Rajahmundry Toll, NH-16",
  "Shadnagar Toll, NH-44", "Tumkur Toll, NH-48", "Udaipur Toll, NH-8",
  "Bhopal Toll, NH-12", "Nagpur Toll, NH-7", "Raipur Toll, NH-6",
  "Vijayawada Toll, NH-65", "Shamshabad Toll, ORR", "Gachibowli Toll, ORR",
  "Patancheru Toll, NH-65", "Kurnool Toll, NH-44", "Anantapur Toll, NH-44",
  "Chitradurga Toll, NH-48", "Davangere Toll, NH-48", "Hubli Toll, NH-4",
  "Belagavi Toll, NH-4", "Kolhapur Toll, NH-4", "Satara Toll, NH-4",
  "Pune Toll, NH-4", "Mumbai-Pune Expressway Toll", "Vashi Toll, NH-4",
  "Navi Mumbai Toll, NH-4", "Thane Toll, NH-3", "Bhiwandi Toll, NH-3",
  "Nashik Toll, NH-3", "Aurangabad Toll, NH-211", "Jalna Toll, NH-211",
];

const providers = [
  "ICICI", "Paytm", "Airtel", "HDFC", "Axis", "Kotak", "SBI", "IndusInd",
];

export function generateTagId(): string {
  const prefix = "34";
  const mid = String(Math.floor(Math.random() * 9000) + 1000);
  const suffix = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
  return `${prefix}${mid}${suffix}`;
}

export function getRandomTollAmount(): number {
  const amounts = [35, 45, 55, 65, 75, 85, 95, 105, 115, 135, 145, 165, 195, 215, 245];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

export function getRandomTollPlaza(): string {
  return tollPlazas[Math.floor(Math.random() * tollPlazas.length)];
}

export function getRandomProvider(): string {
  return providers[Math.floor(Math.random() * providers.length)];
}

export { tollPlazas, providers };
