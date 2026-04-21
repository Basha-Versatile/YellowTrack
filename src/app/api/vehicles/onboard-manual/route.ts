import { withRoute } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { manualOnboardSchema } from "@/validations/vehicle.schema";
import { parseMultipart } from "@/lib/upload";
import { manualOnboard } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req }) => {
    const { fields, files } = await parseMultipart(req);

    // Normalize fields (take first value for each key) for zod
    const flatFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      flatFields[k] = Array.isArray(v) ? v[0] : v;
    }

    const validated = manualOnboardSchema.parse(flatFields);

    // Bucket files by field name (vehicleImages → images, rest → docFiles map)
    const images: string[] = [];
    const docFiles: Record<string, string> = {};
    for (const [field, entry] of Object.entries(files)) {
      const list = Array.isArray(entry) ? entry : [entry];
      for (const f of list) {
        if (field === "vehicleImages") images.push(f.url);
        else docFiles[field] = f.url;
      }
    }

    const vehicle = await manualOnboard(
      { ...validated, ...flatFields },
      docFiles,
      images,
    );
    return created(vehicle, "Vehicle onboarded manually");
  },
  { auth: true },
);
