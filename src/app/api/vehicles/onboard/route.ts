import { withRoute } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { onboardVehicleSchema } from "@/validations/vehicle.schema";
import { parseMultipart, manyFiles, firstString } from "@/lib/upload";
import { onboardVehicle } from "@/server/services/vehicle.service";
import { getRequestOrigin } from "@/lib/request-origin";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);
    const input = onboardVehicleSchema.parse({
      registrationNumber: firstString(fields, "registrationNumber"),
      groupId: firstString(fields, "groupId"),
      vehicleUsage: firstString(fields, "vehicleUsage"),
    });

    const images = manyFiles(files, "vehicleImages").map((f) => f.url);
    const vehicle = await onboardVehicle(
      ctx,
      input.registrationNumber,
      images,
      input.groupId ?? null,
      getRequestOrigin(req),
      input.vehicleUsage ?? null,
    );
    await logFromRequest(req, ctx, session, {
      action: "vehicle.create",
      entityType: "vehicle",
      entityId: String((vehicle as { id?: string; _id?: string }).id ?? (vehicle as { _id?: string })._id ?? ""),
      entityLabel: input.registrationNumber,
      summary: `Onboarded vehicle ${input.registrationNumber}`,
      metadata: { groupId: input.groupId ?? null, vehicleUsage: input.vehicleUsage ?? null },
    });
    return created(vehicle, "Vehicle onboarded successfully");
  },
  { auth: true },
);
