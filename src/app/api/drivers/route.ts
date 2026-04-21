import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { createDriverSchema } from "@/validations/driver.schema";
import {
  createDriver,
  getAllDrivers,
} from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => {
    const drivers = await getAllDrivers();
    return success(drivers, "Drivers fetched successfully");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req }) => {
    const input = await parseJson(req, createDriverSchema);
    const driver = await createDriver(input);
    return created(driver, "Driver created successfully");
  },
  { auth: true },
);
