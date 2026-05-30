import "server-only";
import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  ComplianceDocument,
  DocumentShareLink,
  Vehicle,
} from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

const SHARE_TTL_HOURS = 24;

function genToken(): string {
  // 32 url-safe chars
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Create a share link for the given compliance documents on a vehicle.
 * Validates that every doc belongs to the requesting tenant + vehicle, so a
 * shared link can never reach unrelated rows.
 */
export async function createShareLink(
  ctx: ScopedContext,
  input: {
    vehicleId: string;
    complianceDocIds: string[];
    userId: string | null;
  },
): Promise<{
  token: string;
  expiresAt: Date;
}> {
  if (input.complianceDocIds.length === 0) {
    throw new Error("Pick at least one document to share");
  }

  // Confirm every doc belongs to this vehicle (and implicitly this tenant via
  // the find filter).
  const docs = await ComplianceDocument.find(
    tenantFilter(ctx, {
      _id: { $in: input.complianceDocIds },
      vehicleId: input.vehicleId,
    }),
  )
    .select("_id")
    .lean();

  if (docs.length !== input.complianceDocIds.length) {
    throw new NotFoundError(
      "One or more documents could not be found on this vehicle",
    );
  }

  const expiresAt = new Date(Date.now() + SHARE_TTL_HOURS * 60 * 60 * 1000);
  const token = genToken();

  await DocumentShareLink.create({
    ...tenantStamp(ctx),
    vehicleId: input.vehicleId,
    complianceDocIds: input.complianceDocIds,
    createdBy: input.userId,
    token,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Public lookup by token — cross-tenant on purpose, since the token IS the
 * access control. Records the access for audit.
 */
export async function getShareByToken(token: string): Promise<{
  link: {
    token: string;
    expiresAt: Date;
    vehicleId: string;
    tenantId: string;
  };
  vehicle: {
    registrationNumber: string;
    make: string;
    model: string;
    ownerName?: string | null;
  };
  documents: Array<{
    id: string;
    type: string;
    documentNumber: string | null;
    issuedDate: Date | null;
    expiryDate: Date | null;
    documentUrls: string[];
  }>;
}> {
  const link = await DocumentShareLink.findOne({ token });
  if (!link) {
    throw new NotFoundError("Share link not found");
  }
  if ((link as { expiresAt: Date }).expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("This share link has expired");
  }

  const linkData = link as unknown as {
    tenantId: { toString(): string };
    vehicleId: { toString(): string };
    complianceDocIds: unknown[];
    expiresAt: Date;
  };
  const vehicle = await Vehicle.findById(linkData.vehicleId)
    .select("registrationNumber make model ownerName")
    .lean();
  if (!vehicle) {
    throw new NotFoundError("Linked vehicle no longer exists");
  }
  const docs = await ComplianceDocument.find({
    _id: { $in: linkData.complianceDocIds },
  })
    .select("type documentNumber issuedDate expiryDate documentUrl documentUrls")
    .lean();

  await DocumentShareLink.updateOne(
    { _id: (link as { _id: unknown })._id },
    { $set: { accessedAt: new Date() }, $inc: { accessCount: 1 } },
  );

  return {
    link: {
      token,
      expiresAt: linkData.expiresAt,
      vehicleId: String(linkData.vehicleId),
      tenantId: String(linkData.tenantId),
    },
    vehicle: {
      registrationNumber: (vehicle as { registrationNumber: string }).registrationNumber,
      make: (vehicle as { make: string }).make,
      model: (vehicle as { model: string }).model,
      ownerName: (vehicle as { ownerName?: string | null }).ownerName ?? null,
    },
    documents: docs.map((d) => {
      const doc = d as unknown as {
        _id: { toString(): string };
        type: string;
        documentNumber?: string | null;
        issuedDate?: Date | null;
        expiryDate?: Date | null;
        documentUrl?: string | null;
        documentUrls?: string[];
      };
      const urls =
        Array.isArray(doc.documentUrls) && doc.documentUrls.length > 0
          ? doc.documentUrls
          : doc.documentUrl
            ? [doc.documentUrl]
            : [];
      return {
        id: String(doc._id),
        type: doc.type,
        documentNumber: doc.documentNumber ?? null,
        issuedDate: doc.issuedDate ?? null,
        expiryDate: doc.expiryDate ?? null,
        documentUrls: urls,
      };
    }),
  };
}

/**
 * Resolve a stored asset URL (relative `/uploads/...` or absolute https://)
 * into a fetchable absolute URL.
 */
function resolveAssetUrl(rawUrl: string, requestOrigin: string): string {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  // Local storage driver returns `/uploads/...`. Resolve against the request
  // origin so server-side fetch can reach it.
  if (rawUrl.startsWith("/")) return `${requestOrigin.replace(/\/$/, "")}${rawUrl}`;
  return rawUrl;
}

/**
 * Build a single merged PDF for the share link. Bundles each selected
 * compliance document's files in order. PDFs contribute their pages 1:1;
 * images (jpg/png) become one page each, scaled to fit Letter portrait.
 * Each document gets a section header page with its number / validity.
 */
export async function bundleSharePdf(
  token: string,
  requestOrigin: string,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const share = await getShareByToken(token);
  const out = await PDFDocument.create();
  const titleFont = await out.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await out.embedFont(StandardFonts.Helvetica);
  const PAGE_W = 595.28; // A4 portrait points
  const PAGE_H = 841.89;

  const cover = out.addPage([PAGE_W, PAGE_H]);
  cover.drawText("Yellow Track", {
    x: 50,
    y: PAGE_H - 70,
    size: 22,
    font: titleFont,
    color: rgb(0.96, 0.74, 0.05),
  });
  cover.drawText("Shared compliance documents", {
    x: 50,
    y: PAGE_H - 100,
    size: 14,
    font: bodyFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  cover.drawText(
    `Vehicle: ${share.vehicle.registrationNumber} (${share.vehicle.make} ${share.vehicle.model})`,
    { x: 50, y: PAGE_H - 130, size: 11, font: bodyFont, color: rgb(0.3, 0.3, 0.3) },
  );
  cover.drawText(`Documents: ${share.documents.length}`, {
    x: 50,
    y: PAGE_H - 148,
    size: 11,
    font: bodyFont,
    color: rgb(0.3, 0.3, 0.3),
  });
  cover.drawText(
    `Link expires: ${share.link.expiresAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
    { x: 50, y: PAGE_H - 166, size: 11, font: bodyFont, color: rgb(0.3, 0.3, 0.3) },
  );

  let listY = PAGE_H - 210;
  cover.drawText("Included documents:", {
    x: 50,
    y: listY,
    size: 12,
    font: titleFont,
    color: rgb(0.15, 0.15, 0.15),
  });
  listY -= 22;
  for (const doc of share.documents) {
    const expiry = doc.expiryDate
      ? new Date(doc.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : doc.issuedDate
        ? "Lifetime"
        : "No expiry";
    const numberSuffix = doc.documentNumber ? ` · No. ${doc.documentNumber}` : "";
    cover.drawText(`• ${doc.type.replace(/_/g, " ")} (Exp: ${expiry})${numberSuffix}`, {
      x: 60,
      y: listY,
      size: 10,
      font: bodyFont,
      color: rgb(0.25, 0.25, 0.25),
    });
    listY -= 16;
    if (listY < 60) break;
  }

  for (const doc of share.documents) {
    for (const url of doc.documentUrls) {
      const absolute = resolveAssetUrl(url, requestOrigin);
      let res: Response;
      try {
        res = await fetch(absolute);
      } catch {
        continue;
      }
      if (!res.ok) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      const lower = absolute.split("?")[0].toLowerCase();
      try {
        if (lower.endsWith(".pdf")) {
          const src = await PDFDocument.load(buf, { ignoreEncryption: true });
          const copied = await out.copyPages(src, src.getPageIndices());
          for (const p of copied) out.addPage(p);
        } else if (lower.endsWith(".png")) {
          const img = await out.embedPng(buf);
          const page = out.addPage([PAGE_W, PAGE_H]);
          const margin = 30;
          const scale = Math.min(
            (PAGE_W - margin * 2) / img.width,
            (PAGE_H - margin * 2) / img.height,
          );
          page.drawImage(img, {
            x: (PAGE_W - img.width * scale) / 2,
            y: (PAGE_H - img.height * scale) / 2,
            width: img.width * scale,
            height: img.height * scale,
          });
        } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
          const img = await out.embedJpg(buf);
          const page = out.addPage([PAGE_W, PAGE_H]);
          const margin = 30;
          const scale = Math.min(
            (PAGE_W - margin * 2) / img.width,
            (PAGE_H - margin * 2) / img.height,
          );
          page.drawImage(img, {
            x: (PAGE_W - img.width * scale) / 2,
            y: (PAGE_H - img.height * scale) / 2,
            width: img.width * scale,
            height: img.height * scale,
          });
        }
      } catch (err) {
        // Skip a single bad file rather than poisoning the whole bundle.
        console.warn(
          "[documentShare] skipped file",
          absolute,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  const bytes = await out.save();
  const filename = `${share.vehicle.registrationNumber}-documents-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { bytes, filename };
}
