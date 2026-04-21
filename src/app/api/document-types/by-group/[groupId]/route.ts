import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as service from "@/server/services/documentType.service";

export const runtime = "nodejs";

export const GET = withRoute<{ groupId: string }>(
  async ({ params }) => {
    return success(
      await service.getByGroupId(params.groupId),
      "Group document types fetched",
    );
  },
  { auth: true },
);
