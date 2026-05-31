import "server-only";
import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  CustomComplianceDocument,
  CustomComplianceGroup,
  CustomDocumentShareLink,
} from "@/models";
import {
  type ScopedContext,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { resolveShareDocIds } from "./customCompliance.service";

const SHARE_TTL_HOURS = 24;

function genToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function resolveAssetUrl(rawUrl: string, requestOrigin: string): string {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith("/")) return `${requestOrigin.replace(/\/$/, "")}${rawUrl}`;
  return rawUrl;
}

/**
 * Mint a 24h public share for custom compliance documents. Caller picks
 * EITHER a `groupId` (whole-group share — resolves to its docs at view time)
 * OR an explicit `documentIds` list.
 */
export async function createCustomShareLink(
  ctx: ScopedContext,
  input: {
    groupId?: string;
    documentIds?: string[];
    userId: string | null;
  },
): Promise<{ token: string; expiresAt: Date; isGroupShare: boolean }> {
  // Validate ownership through the service helper before persisting.
  await resolveShareDocIds(ctx, {
    groupId: input.groupId,
    documentIds: input.documentIds,
  });

  const expiresAt = new Date(Date.now() + SHARE_TTL_HOURS * 60 * 60 * 1000);
  const token = genToken();

  await CustomDocumentShareLink.create({
    ...tenantStamp(ctx),
    groupId: input.groupId ?? null,
    // When sharing a whole group, freeze documentIds=[] and re-resolve at
    // view time so docs added later show up automatically. When sharing an
    // explicit list, persist the doc ids.
    documentIds: input.groupId ? [] : input.documentIds ?? [],
    token,
    createdBy: input.userId,
    expiresAt,
  });

  return {
    token,
    expiresAt,
    isGroupShare: Boolean(input.groupId),
  };
}

type ShareLookupResult = {
  link: {
    token: string;
    expiresAt: Date;
    isGroupShare: boolean;
  };
  group: { id: string; name: string; description: string | null } | null;
  documents: Array<{
    id: string;
    label: string;
    documentNumber: string | null;
    issuedDate: Date | null;
    expiryDate: Date | null;
    documentUrls: string[];
  }>;
};

export async function getCustomShareByToken(
  token: string,
): Promise<ShareLookupResult> {
  const link = await CustomDocumentShareLink.findOne({ token });
  if (!link) throw new NotFoundError("Share link not found");
  const linkData = link as unknown as {
    _id: unknown;
    tenantId: { toString(): string };
    groupId: { toString(): string } | null;
    documentIds: unknown[];
    expiresAt: Date;
  };
  if (linkData.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("This share link has expired");
  }

  let group: ShareLookupResult["group"] = null;
  let docFilter: Record<string, unknown>;
  if (linkData.groupId) {
    const g = await CustomComplianceGroup.findById(linkData.groupId).lean();
    if (!g) throw new NotFoundError("Linked group no longer exists");
    const gd = g as unknown as {
      _id: unknown;
      name: string;
      description?: string | null;
    };
    group = { id: String(gd._id), name: gd.name, description: gd.description ?? null };
    docFilter = { groupId: linkData.groupId };
  } else {
    docFilter = { _id: { $in: linkData.documentIds } };
  }

  const docs = await CustomComplianceDocument.find(docFilter)
    .select("label documentNumber issuedDate expiryDate documentUrl documentUrls groupId")
    .lean();

  // Best-effort group resolution when sharing an explicit list — uses the
  // first doc's group as the display context.
  if (!group && docs.length > 0) {
    const firstGroupId = (docs[0] as { groupId?: unknown }).groupId;
    if (firstGroupId) {
      const g = await CustomComplianceGroup.findById(firstGroupId).lean();
      if (g) {
        const gd = g as unknown as {
          _id: unknown;
          name: string;
          description?: string | null;
        };
        group = { id: String(gd._id), name: gd.name, description: gd.description ?? null };
      }
    }
  }

  await CustomDocumentShareLink.updateOne(
    { _id: linkData._id },
    { $set: { accessedAt: new Date() }, $inc: { accessCount: 1 } },
  );

  return {
    link: {
      token,
      expiresAt: linkData.expiresAt,
      isGroupShare: Boolean(linkData.groupId),
    },
    group,
    documents: docs.map((d) => {
      const doc = d as unknown as {
        _id: { toString(): string };
        label: string;
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
        label: doc.label,
        documentNumber: doc.documentNumber ?? null,
        issuedDate: doc.issuedDate ?? null,
        expiryDate: doc.expiryDate ?? null,
        documentUrls: urls,
      };
    }),
  };
}

/**
 * Build a merged PDF of every document in this share. Mirrors the vehicle
 * share bundle — cover page + appended PDFs + image pages.
 */
export async function bundleCustomSharePdf(
  token: string,
  requestOrigin: string,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const share = await getCustomShareByToken(token);
  const out = await PDFDocument.create();
  const titleFont = await out.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await out.embedFont(StandardFonts.Helvetica);
  const PAGE_W = 595.28;
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
  if (share.group) {
    cover.drawText(`Group: ${share.group.name}`, {
      x: 50,
      y: PAGE_H - 130,
      size: 11,
      font: bodyFont,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  cover.drawText(`Documents: ${share.documents.length}`, {
    x: 50,
    y: PAGE_H - 148,
    size: 11,
    font: bodyFont,
    color: rgb(0.3, 0.3, 0.3),
  });
  cover.drawText(
    `Link expires: ${share.link.expiresAt.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`,
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
      ? new Date(doc.expiryDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : doc.issuedDate
        ? "Lifetime"
        : "No expiry";
    const numberSuffix = doc.documentNumber ? ` · No. ${doc.documentNumber}` : "";
    cover.drawText(`• ${doc.label} (Exp: ${expiry})${numberSuffix}`, {
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
        console.warn(
          "[customComplianceShare] skipped file",
          absolute,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  const bytes = await out.save();
  const slug = (share.group?.name ?? "documents")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "documents";
  const filename = `${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { bytes, filename };
}

