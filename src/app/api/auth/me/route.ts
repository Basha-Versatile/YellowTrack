import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import { BadRequestError, UnauthorizedError } from "@/lib/errors";
import { User } from "@/models";
import { toPublicUser } from "@/server/repositories/auth.repository";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(2).max(80).trim().optional(),
  // If null/empty string is sent for profileImage we treat it as "clear".
  profileImageUrl: z.string().url().nullable().optional(),
});

export const GET = withRoute(
  async ({ session }) => {
    if (!session) throw new UnauthorizedError();
    const doc = await User.findById(session.id).lean();
    if (!doc) throw new UnauthorizedError("User not found");
    return success({ user: toPublicUser(doc) }, "User loaded");
  },
  { auth: true },
);

export const PATCH = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();

    const contentType = req.headers.get("content-type") ?? "";
    let name: string | undefined;
    let profileImageUrl: string | null | undefined;
    let removeProfileImage = false;

    if (contentType.includes("multipart/form-data")) {
      const { fields, files } = await parseMultipart(req);
      const file = firstFile(files, "profileImage");
      const removeFlag = firstString(fields, "removeProfileImage");
      const parsed = bodySchema.parse({
        name: firstString(fields, "name"),
        profileImageUrl: file?.url ?? null,
      });
      name = parsed.name;
      if (file) profileImageUrl = file.url;
      if (removeFlag === "true") removeProfileImage = true;
    } else {
      // JSON fallback — e.g. for callers who only want to update the name.
      const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const parsed = bodySchema.parse({
        name: typeof json.name === "string" ? json.name : undefined,
        profileImageUrl: undefined,
      });
      name = parsed.name;
    }

    if (!name && profileImageUrl === undefined && !removeProfileImage) {
      throw new BadRequestError("Nothing to update");
    }

    const update: Record<string, unknown> = {};
    if (name) update.name = name;
    if (profileImageUrl !== undefined) update.profileImage = profileImageUrl;
    if (removeProfileImage) update.profileImage = null;

    const updated = await User.findByIdAndUpdate(session.id, update, {
      new: true,
    }).lean();
    if (!updated) throw new UnauthorizedError("User not found");

    return success({ user: toPublicUser(updated) }, "Profile updated");
  },
  { auth: true },
);
