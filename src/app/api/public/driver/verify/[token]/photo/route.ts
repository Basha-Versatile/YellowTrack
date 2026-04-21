import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { firstFile, parseMultipart } from "@/lib/upload";
import { uploadDriverPhoto } from "@/server/services/public.service";

export const runtime = "nodejs";

export const POST = withRoute<{ token: string }>(async ({ req, params }) => {
  const { files } = await parseMultipart(req);
  const file = firstFile(files, "photo");
  if (!file) throw new BadRequestError("Photo file is required");
  const result = await uploadDriverPhoto(params.token, file.url);
  return success(result, "Photo uploaded successfully");
});
