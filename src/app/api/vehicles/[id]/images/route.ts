import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { parseMultipart, manyFiles } from "@/lib/upload";
import { z } from "zod";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { files } = await parseMultipart(req);
    const newImages = manyFiles(files, "vehicleImages").map((f) => f.url);

    if (newImages.length === 0) throw new BadRequestError("No images uploaded");

    const vehicle = await vehicleRepo.findById(params.id);
    if (!vehicle) throw new NotFoundError("Vehicle not found");

    const allImages = [...((vehicle.images as string[]) ?? []), ...newImages];
    await vehicleRepo.update(params.id, { images: allImages });

    const updated = await vehicleRepo.findById(params.id);
    return success(updated, "Images uploaded successfully");
  },
  { auth: true },
);

const deleteBody = z.object({ imageUrl: z.string().min(1, "imageUrl is required") });

export const DELETE = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { imageUrl } = await parseJson(req, deleteBody);

    const vehicle = await vehicleRepo.findById(params.id);
    if (!vehicle) throw new NotFoundError("Vehicle not found");

    const updatedImages = ((vehicle.images as string[]) ?? []).filter(
      (img) => img !== imageUrl,
    );
    await vehicleRepo.update(params.id, { images: updatedImages });

    const updated = await vehicleRepo.findById(params.id);
    return success(updated, "Image deleted successfully");
  },
  { auth: true },
);
