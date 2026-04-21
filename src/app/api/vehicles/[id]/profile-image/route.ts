import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";

export const runtime = "nodejs";

const bodySchema = z.object({
  imageUrl: z.string().min(1, "imageUrl is required"),
});

export const PUT = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { imageUrl } = await parseJson(req, bodySchema);
    await vehicleRepo.update(params.id, { profileImage: imageUrl });
    const updated = await vehicleRepo.findById(params.id);
    return success(updated, "Profile image set successfully");
  },
  { auth: true },
);
