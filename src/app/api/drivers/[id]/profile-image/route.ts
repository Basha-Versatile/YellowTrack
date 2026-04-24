import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { firstFile, parseMultipart } from "@/lib/upload";
import { adminUploadProfilePhoto } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const { files } = await parseMultipart(req);
    const file = firstFile(files, "photo");
    if (!file) throw new BadRequestError("Photo file is required");
    const result = await adminUploadProfilePhoto(params.id, file.url, {
      name: session?.email ?? "system",
      role: "ADMIN",
    });
    return success(result, "Profile photo uploaded");
  },
  { auth: true },
);
