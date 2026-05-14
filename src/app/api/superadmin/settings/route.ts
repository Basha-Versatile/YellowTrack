import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import {
  getSettings,
  updateSettings,
} from "@/server/services/platformSettings.service";

export const runtime = "nodejs";

const updateSchema = z.object({
  trialDays: z.coerce.number().int().min(0).max(365).optional(),
});

export const GET = withRoute(
  async () => {
    const settings = await getSettings();
    return success(settings, "Platform settings");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const PATCH = withRoute(
  async ({ req }) => {
    const input = await parseJson(req, updateSchema);
    const settings = await updateSettings(input);
    return success(settings, "Settings updated");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
