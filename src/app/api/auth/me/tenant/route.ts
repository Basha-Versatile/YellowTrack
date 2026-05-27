import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import { updateTenantSchema } from "@/validations/tenant.schema";
import {
  getTenantById,
  updateTenant,
} from "@/server/services/tenant.service";

export const runtime = "nodejs";

// GET — return the signed-in user's tenant. Any authenticated user with a
// tenant scope may read it (ADMIN, OPERATOR). SUPERADMIN has tenantId=null
// and would 400 here; they manage tenants from the superadmin UI instead.
export const GET = withRoute(
  async ({ session }) => {
    if (!session) throw new UnauthorizedError();
    if (!session.tenantId) {
      throw new BadRequestError("No tenant scope on this account");
    }
    const tenant = await getTenantById(session.tenantId);
    return success(tenant, "Tenant loaded");
  },
  { auth: true },
);

// PATCH — update workspace details (name, billing email, GST/PAN, address, logo).
// Tenant ADMIN only — operators can read but not edit billing/tax/branding.
// Accepts either:
//   - JSON  → text fields only (no logo change)
//   - multipart/form-data → text fields + optional `logo` file + `removeLogo`
export const PATCH = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();
    if (!session.tenantId) {
      throw new BadRequestError("No tenant scope on this account");
    }
    if (session.role !== "ADMIN") throw new ForbiddenError();

    const contentType = req.headers.get("content-type") ?? "";

    let input: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const { fields, files } = await parseMultipart(req);
      const logoFile = firstFile(files, "logo");
      const removeLogo = firstString(fields, "removeLogo") === "true";

      // logoUrl precedence: new file > explicit remove flag > undefined (no change)
      let logoUrl: string | null | undefined = undefined;
      if (logoFile) logoUrl = logoFile.url;
      else if (removeLogo) logoUrl = null;

      input = updateTenantSchema.parse({
        name: firstString(fields, "name"),
        billingEmail: firstString(fields, "billingEmail") ?? undefined,
        logoUrl,
        gstNumber: firstString(fields, "gstNumber") ?? undefined,
        panNumber: firstString(fields, "panNumber") ?? undefined,
        addressLine: firstString(fields, "addressLine") ?? undefined,
        city: firstString(fields, "city") ?? undefined,
        state: firstString(fields, "state") ?? undefined,
        pinCode: firstString(fields, "pinCode") ?? undefined,
      });
    } else {
      input = (await parseJson(req, updateTenantSchema)) as Record<string, unknown>;
    }

    // Drop keys the caller didn't set, so we never overwrite an existing field
    // with `undefined` (Mongoose would treat undefined as "no change" anyway,
    // but stripping makes the patch payload explicit).
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) patch[k] = v;
    }

    const tenant = await updateTenant(session.tenantId, patch);
    return success(tenant, "Workspace updated");
  },
  { auth: true },
);
