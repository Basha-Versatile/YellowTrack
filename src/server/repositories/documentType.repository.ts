import "server-only";
import { DocumentType, GroupDocumentType } from "@/models";

export async function findAll() {
  return DocumentType.find({ isActive: true })
    .sort({ isSystem: -1, name: 1 })
    .lean();
}

export async function findById(id: string) {
  return DocumentType.findById(id).lean();
}

export async function findByCode(code: string) {
  return DocumentType.findOne({ code: code.toUpperCase() }).lean();
}

export async function findByGroupId(groupId: string) {
  const joins = await GroupDocumentType.find({ groupId })
    .populate({ path: "documentTypeId", model: DocumentType })
    .lean();
  return joins
    .map((j) => j.documentTypeId as unknown as { _id: unknown; code: string; name: string; description?: string; hasExpiry: boolean; isSystem: boolean; isActive: boolean })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function create(data: {
  code: string;
  name: string;
  description?: string;
  hasExpiry?: boolean;
  isSystem?: boolean;
}) {
  return DocumentType.create(data);
}

export async function update(
  id: string,
  data: Partial<{ code: string; name: string; description: string; hasExpiry: boolean }>,
) {
  return DocumentType.findByIdAndUpdate(id, data, { new: true });
}

export async function remove(id: string) {
  return DocumentType.findByIdAndDelete(id);
}

export async function countGroupReferences(id: string) {
  return GroupDocumentType.countDocuments({ documentTypeId: id });
}
