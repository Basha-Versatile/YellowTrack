import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { firstFile, firstString, parseMultipart } from "@/lib/upload";
import {
  adminDeleteAddressPhoto,
  adminUploadAddressPhoto,
} from "@/server/services/driver.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string; type: string }>(
  async ({ req, params, session }) => {
    if (params.type !== "current" && params.type !== "permanent") {
      throw new BadRequestError("Invalid address type");
    }
    const { files } = await parseMultipart(req);
    const file = firstFile(files, "photo");
    if (!file) throw new BadRequestError("Photo file is required");
    const result = await adminUploadAddressPhoto(
      params.id,
      params.type,
      file.url,
      { name: session?.email ?? "system", role: "ADMIN" },
    );
    return success(result, "Address photo uploaded");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string; type: string }>(
  async ({ req, params, session }) => {
    if (params.type !== "current" && params.type !== "permanent") {
      throw new BadRequestError("Invalid address type");
    }
    const { fields } = await parseMultipart(req);
    const url = firstString(fields, "url");
    if (!url) throw new BadRequestError("Photo URL is required");
    const result = await adminDeleteAddressPhoto(params.id, params.type, url, {
      name: session?.email ?? "system",
      role: "ADMIN",
    });
    return success(result, "Address photo removed");
  },
  { auth: true },
);
