import { withRoute } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { onboardVehicleSchema } from "@/validations/vehicle.schema";
import { parseMultipart, manyFiles, firstString } from "@/lib/upload";
import { onboardVehicle } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req }) => {
    const { fields, files } = await parseMultipart(req);
    const input = onboardVehicleSchema.parse({
      registrationNumber: firstString(fields, "registrationNumber"),
      groupId: firstString(fields, "groupId"),
    });

    const images = manyFiles(files, "vehicleImages").map((f) => f.url);
    const vehicle = await onboardVehicle(
      input.registrationNumber,
      images,
      input.groupId,
    );
    return created(vehicle, "Vehicle onboarded successfully");
  },
  { auth: true },
);
