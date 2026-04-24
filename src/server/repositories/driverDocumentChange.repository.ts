import "server-only";
import {
  DriverDocumentChange,
  type DocChangeType,
} from "@/models/DriverDocumentChange";
import { DriverDocument } from "@/models/DriverDocument";

export type ChangedField = {
  field: string;
  before: unknown;
  after: unknown;
};

export async function logChange(params: {
  documentId: string;
  driverId: string;
  type: string;
  changeType: DocChangeType;
  fields?: ChangedField[];
  note?: string;
  changedBy?: string;
}) {
  try {
    await DriverDocumentChange.create({
      documentId: params.documentId,
      driverId: params.driverId,
      type: params.type,
      changeType: params.changeType,
      fields: params.fields ?? [],
      note: params.note,
      changedBy: params.changedBy,
    });
  } catch (err) {
    // Audit logging must never block the primary operation
    console.error(
      "[DriverDocChange] failed to log change:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function findByDriverAndType(driverId: string, type: string) {
  const changes = await DriverDocumentChange.find({ driverId, type })
    .sort({ createdAt: -1 })
    .lean();

  const docIds = Array.from(new Set(changes.map((c) => String(c.documentId))));
  const docs = await DriverDocument.find({ _id: { $in: docIds } })
    .select("documentUrl expiryDate isActive archivedAt")
    .lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));

  return changes.map((c) => {
    const doc = byId.get(String(c.documentId));
    return {
      id: String(c._id),
      createdAt: c.createdAt,
      changeType: c.changeType,
      fields: c.fields,
      note: c.note ?? null,
      changedBy: c.changedBy ?? null,
      documentId: String(c.documentId),
      documentUrl: doc?.documentUrl ?? null,
      isActive: doc?.isActive ?? false,
    };
  });
}
