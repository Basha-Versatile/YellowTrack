import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { listEffectivePermissions } from "@/lib/auth/guard";
import { PERMISSION_GROUPS, PERMISSIONS } from "@/lib/auth/permissions";

export const runtime = "nodejs";

/**
 * GET /api/permissions
 *   Returns:
 *     - catalog: the full permission groups (for the role editor UI)
 *     - mine:   the calling user's effective permissions (for UI gating)
 */
export const GET = withRoute(
  async ({ session }) => {
    const mine = session ? await listEffectivePermissions(session) : [];
    return success(
      {
        catalog: PERMISSION_GROUPS,
        all: PERMISSIONS,
        mine,
      },
      "Permissions",
    );
  },
  { auth: true },
);
