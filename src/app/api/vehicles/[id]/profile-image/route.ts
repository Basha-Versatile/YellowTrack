import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";

export const runtime = "nodejs";

const bodySchema = z.object({
  imageUrl: z.string().min(1, "imageUrl is required"),
});

export const PUT = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { imageUrl } = await parseJson(req, bodySchema);
    await vehicleRepo.update(ctx, params.id, { profileImage: imageUrl });
    const updated = await vehicleRepo.findById(ctx, params.id);
    return success(updated, "Profile image set successfully");
  },
  { auth: true },
);
