import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { firstFile, parseMultipart } from "@/lib/upload";
import { uploadAddressPhoto } from "@/server/services/public.service";

export const runtime = "nodejs";

export const POST = withRoute<{ token: string; type: string }>(
  async ({ req, params }) => {
    const { files } = await parseMultipart(req);
    const file = firstFile(files, "photo");
    if (!file) throw new BadRequestError("Photo file is required");
    if (params.type !== "current" && params.type !== "permanent") {
      throw new BadRequestError("Invalid address type");
    }
    const result = await uploadAddressPhoto(
      params.token,
      params.type,
      file.url,
    );
    return success(result, "Address photo uploaded");
  },
);
