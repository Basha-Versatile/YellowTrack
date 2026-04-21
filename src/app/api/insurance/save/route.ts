import { withRoute, parseJson } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { savePolicySchema } from "@/validations/insurance.schema";
import { savePolicy } from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req }) => {
    const input = await parseJson(req, savePolicySchema);
    return created(await savePolicy(input), "Insurance policy saved");
  },
  { auth: true },
);
