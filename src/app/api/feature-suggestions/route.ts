import { withRoute, parseJson } from "@/lib/api-handler";
import { created, success } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { createFeatureSuggestionSchema } from "@/validations/featureSuggestion.schema";
import {
  createSuggestion,
  listOwnSuggestions,
} from "@/server/services/featureSuggestion.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();
    const input = await parseJson(req, createFeatureSuggestionSchema);
    const suggestion = await createSuggestion(
      { id: session.id, email: session.email },
      input,
    );
    return created(suggestion, "Thanks! Your suggestion has been submitted.");
  },
  { auth: true },
);

export const GET = withRoute(
  async ({ session }) => {
    if (!session) throw new UnauthorizedError();
    const items = await listOwnSuggestions(session.id);
    return success(items, "Suggestions fetched");
  },
  { auth: true },
);
