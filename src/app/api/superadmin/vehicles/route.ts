import { withRoute, parseQuery } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { listAllVehicles } from "@/server/services/superadmin.service";

export const runtime = "nodejs";

const querySchema = z.object({
  tenantId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(["GREEN", "YELLOW", "RED"]).optional(),
});

export const GET = withRoute(
  async ({ req, session }) => {
    const query = parseQuery(req, querySchema);
    const result = await listAllVehicles(session, query);
    return success(result, "Vehicles fetched");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
