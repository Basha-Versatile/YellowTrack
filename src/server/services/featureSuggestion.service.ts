import "server-only";
import { FeatureSuggestion } from "@/models/FeatureSuggestion";
import type { CreateFeatureSuggestionInput } from "@/validations/featureSuggestion.schema";

type Actor = {
  id: string;
  email: string;
};

export async function createSuggestion(
  actor: Actor,
  input: CreateFeatureSuggestionInput,
) {
  const doc = await FeatureSuggestion.create({
    userId: actor.id,
    userEmail: actor.email,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
  });
  return serialize(doc.toObject() as Record<string, unknown>);
}

export async function listOwnSuggestions(userId: string) {
  const docs = await FeatureSuggestion.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  return docs.map((d) => serialize(d as Record<string, unknown>));
}

function serialize(d: Record<string, unknown>) {
  return {
    id: String(d._id),
    title: d.title,
    description: d.description,
    category: d.category,
    priority: d.priority,
    status: d.status,
    adminResponse: d.adminResponse ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}
