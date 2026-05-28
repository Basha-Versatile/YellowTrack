import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import {
  deleteBrand,
  updateBrandAsSuperadmin,
} from "@/server/services/vehicleBrand.service";
import { updateVehicleBrandSchema } from "@/validations/vehicleBrand.schema";

export const runtime = "nodejs";

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const contentType = req.headers.get("content-type") ?? "";
    let payload: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const { fields, files } = await parseMultipart(req);
      const logoFile = firstFile(files, "logo");
      payload = {
        name: firstString(fields, "name") ?? undefined,
        logoUrl: logoFile?.url ?? undefined,
        iconKey: firstString(fields, "iconKey") ?? undefined,
        description: firstString(fields, "description") ?? undefined,
      };
    } else {
      payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    }
    const input = updateVehicleBrandSchema.parse(payload);
    const brand = await updateBrandAsSuperadmin(params.id, input);
    return success(brand, "Brand updated");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params, session }) => {
    if (!session) throw new UnauthorizedError();
    await deleteBrand(params.id);
    return success({ ok: true }, "Brand deleted");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
