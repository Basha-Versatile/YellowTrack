import "server-only";
import { promises as fs } from "fs";
import path from "path";

export type ExtractedInsurance = {
  policyNumber: string | null;
  insurer: string | null;
  vehicleNumber: string | null;
  startDate: string | null;
  expiryDate: string | null;
  premium: number | null;
  vehicleType: string | null;
  coverageType: string | null;
  raw: string;
};

/**
 * Extract insurance details from PDF text.
 * Uses pdf-parse for text-based PDFs, falls back to mock data for scanned/empty PDFs.
 */
export async function extractFromPDF(filePath: string): Promise<ExtractedInsurance> {
  let text = "";

  try {
    const pdfParseMod = (await import("pdf-parse")) as unknown as {
      default?: (buffer: Buffer) => Promise<{ text?: string }>;
    } & ((buffer: Buffer) => Promise<{ text?: string }>);
    const pdfParse = pdfParseMod.default ?? pdfParseMod;
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    text = data.text ?? "";
  } catch (err) {
    console.log(
      "PDF parse failed, using mock extraction:",
      err instanceof Error ? err.message : err,
    );
  }

  if (text.length > 50) return parseInsuranceText(text);
  return getMockExtraction(filePath);
}

function parseInsuranceText(text: string): ExtractedInsurance {
  const result: ExtractedInsurance = {
    policyNumber: null,
    insurer: null,
    vehicleNumber: null,
    startDate: null,
    expiryDate: null,
    premium: null,
    vehicleType: null,
    coverageType: null,
    raw: text.substring(0, 500),
  };

  const policyPatterns = [
    /policy\s*(?:no|number|#)[:\s]*([A-Z0-9\-/]+)/i,
    /certificate\s*(?:no|number)[:\s]*([A-Z0-9\-/]+)/i,
    /(?:OG|P|INS)[/-]?\d{2}[/-]\d{4,}/,
  ];
  for (const p of policyPatterns) {
    const m = text.match(p);
    if (m) {
      result.policyNumber = (m[1] ?? m[0]).trim();
      break;
    }
  }

  const insurers = [
    "ICICI Lombard", "HDFC Ergo", "Bajaj Allianz", "New India Assurance",
    "Tata AIG", "Acko", "Digit", "GoDigit", "National Insurance",
    "Oriental Insurance", "United India", "SBI General", "Reliance General",
    "Cholamandalam", "Royal Sundaram", "Bharti AXA", "Iffco Tokio",
    "Future Generali",
  ];
  for (const ins of insurers) {
    if (text.toLowerCase().includes(ins.toLowerCase())) {
      result.insurer = ins;
      break;
    }
  }

  const vehMatch = text.match(/[A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{1,4}/);
  if (vehMatch) result.vehicleNumber = vehMatch[0].replace(/\s/g, "");

  const datePatterns = [
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/g,
    /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/g,
  ];
  const dates: Date[] = [];
  for (const dp of datePatterns) {
    let dm: RegExpExecArray | null;
    while ((dm = dp.exec(text)) !== null) {
      try {
        const d = new Date(dm[0].replace(/[.]/g, "/"));
        if (!Number.isNaN(d.getTime()) && d.getFullYear() > 2000) dates.push(d);
      } catch {
        /* skip */
      }
    }
  }
  if (dates.length >= 2) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    result.startDate = dates[0].toISOString();
    result.expiryDate = dates[dates.length - 1].toISOString();
  } else if (dates.length === 1) {
    result.startDate = dates[0].toISOString();
  }

  const premMatch = text.match(
    /(?:premium|total)[:\s]*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{2})?)/i,
  );
  if (premMatch) result.premium = parseFloat(premMatch[1].replace(/,/g, ""));

  if (/comprehensive/i.test(text)) result.coverageType = "Comprehensive";
  else if (/third\s*party/i.test(text)) result.coverageType = "Third Party";
  else if (/own\s*damage/i.test(text)) result.coverageType = "Own Damage";

  if (/two\s*wheeler|bike|scooter/i.test(text)) result.vehicleType = "Two Wheeler";
  else if (/truck|lorry|goods/i.test(text)) result.vehicleType = "Commercial";
  else if (/bus|passenger/i.test(text)) result.vehicleType = "Passenger";
  else result.vehicleType = "Private Car";

  return result;
}

function getMockExtraction(filePath: string): ExtractedInsurance {
  const fileName = path.basename(filePath || "");
  return {
    policyNumber: `POL-${Date.now().toString().slice(-8)}`,
    insurer: "Unable to detect — please fill manually",
    vehicleNumber: null,
    startDate: null,
    expiryDate: null,
    premium: null,
    vehicleType: "Private Car",
    coverageType: null,
    raw: `Scanned/unreadable PDF: ${fileName}. Please fill details manually.`,
  };
}
