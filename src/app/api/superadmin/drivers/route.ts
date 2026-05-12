import { withRoute, parseQuery } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { listAllDrivers } from "@/server/services/superadmin.service";

export const runtime = "nodejs";

const querySchema = z.object({
  tenantId: z.string().optional(),
});

export const GET = withRoute(
  async ({ req, session }) => {
    const query = parseQuery(req, querySchema);
    const result = await listAllDrivers(session, query);
    return success(result, "Drivers fetched");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
