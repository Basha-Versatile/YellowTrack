/**
 * Permission catalog (resource:action). Static — the catalog is part of the
 * code, not the database, because a permission only matters if there's a
 * route handler that checks it. The Role.permissions[] array stores subsets
 * of these strings.
 *
 * Conventions:
 *   - resource is plural lowercase
 *   - action is one of: read, create, update, delete, manage
 *   - "manage" implies all CRUD on that resource
 *
 * Adding a new permission:
 *   1. Add the string here under the right group.
 *   2. Update PERMISSION_GROUPS to expose it in the UI.
 *   3. Call `requirePermission(ctx, "resource:action")` in the route handler.
 *   4. The default Admin role gets every permission automatically (see
 *      `defaultPermissionsFor("ADMIN")` in role.service); add it explicitly
 *      to the Operator default if Operators should have it.
 */

export const PERMISSIONS = [
  // Vehicles
  "vehicles:read",
  "vehicles:create",
  "vehicles:update",
  "vehicles:delete",

  // Drivers
  "drivers:read",
  "drivers:create",
  "drivers:update",
  "drivers:delete",
  "drivers:assign", // assign driver to a vehicle

  // Compliance documents
  "compliance:read",
  "compliance:upload",
  "compliance:update",
  "compliance:delete",

  // Challans
  "challans:read",
  "challans:pay",
  "challans:sync",

  // Insurance
  "insurance:read",
  "insurance:purchase",
  "insurance:upload",

  // FASTag
  "fastag:read",
  "fastag:manage",

  // Vehicle services + expenses
  "services:read",
  "services:create",
  "services:update",
  "services:delete",
  "expenses:read",
  "expenses:create",

  // EMI tracking
  "emi:read",
  "emi:create",
  "emi:update",
  "emi:close",

  // Vehicle groups
  "groups:read",
  "groups:manage",

  // Notifications
  "notifications:read",
  "notifications:manage",

  // Settings (tenant-admin only)
  "settings.roles:manage",
  "settings.users:manage",
  "settings.tenant:read",
  "settings.documentTypes:manage",

  // Activity log (tenant-admin audit trail)
  "activityLog:read",
  "activityLog:revert",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Groups for the role-editor UI. Each group has a label and the list of
 * permissions it contains, plus a short description per permission.
 */
export const PERMISSION_GROUPS: Array<{
  key: string;
  label: string;
  description: string;
  items: Array<{ key: Permission; label: string; description: string }>;
}> = [
  {
    key: "vehicles",
    label: "Vehicles",
    description: "Fleet, registration data, profile.",
    items: [
      { key: "vehicles:read", label: "View vehicles", description: "List, search, view details." },
      { key: "vehicles:create", label: "Onboard vehicles", description: "Add new vehicles to the fleet." },
      { key: "vehicles:update", label: "Edit vehicles", description: "Update vehicle details and group." },
      { key: "vehicles:delete", label: "Delete vehicles", description: "Remove vehicles from the fleet." },
    ],
  },
  {
    key: "drivers",
    label: "Drivers",
    description: "Driver records, licenses, assignments.",
    items: [
      { key: "drivers:read", label: "View drivers", description: "List, search, view driver details." },
      { key: "drivers:create", label: "Add drivers", description: "Create new driver records." },
      { key: "drivers:update", label: "Edit drivers", description: "Update profile, address, photos." },
      { key: "drivers:delete", label: "Delete drivers", description: "Remove driver records." },
      { key: "drivers:assign", label: "Assign drivers", description: "Assign drivers to vehicles." },
    ],
  },
  {
    key: "compliance",
    label: "Compliance",
    description: "RC, insurance, permit, fitness, PUCC, tax documents.",
    items: [
      { key: "compliance:read", label: "View documents", description: "Read compliance documents." },
      { key: "compliance:upload", label: "Upload documents", description: "Upload new compliance documents." },
      { key: "compliance:update", label: "Update expiry / file", description: "Renew or update document details." },
      { key: "compliance:delete", label: "Delete documents", description: "Remove compliance documents." },
    ],
  },
  {
    key: "challans",
    label: "Challans",
    description: "Traffic e-challans for the fleet.",
    items: [
      { key: "challans:read", label: "View challans", description: "List and view challan details." },
      { key: "challans:pay", label: "Pay challans", description: "Record payments for challans." },
      { key: "challans:sync", label: "Sync challans", description: "Fetch fresh challans from source." },
    ],
  },
  {
    key: "insurance",
    label: "Insurance",
    description: "Vehicle insurance policies.",
    items: [
      { key: "insurance:read", label: "View policies", description: "List and view insurance policies." },
      { key: "insurance:purchase", label: "Buy insurance", description: "Purchase new policies." },
      { key: "insurance:upload", label: "Upload policy PDF", description: "Upload + extract policy data." },
    ],
  },
  {
    key: "fastag",
    label: "FASTag",
    description: "FASTag tags, balances, transactions.",
    items: [
      { key: "fastag:read", label: "View FASTag", description: "View tag balances and transactions." },
      { key: "fastag:manage", label: "Manage FASTag", description: "Create tags, top-up, deactivate." },
    ],
  },
  {
    key: "service-cost",
    label: "Service & expenses",
    description: "Vehicle service records and operating expenses.",
    items: [
      { key: "services:read", label: "View services", description: "List and view service history." },
      { key: "services:create", label: "Add services", description: "Log new service records." },
      { key: "services:update", label: "Edit services", description: "Update service entries." },
      { key: "services:delete", label: "Delete services", description: "Remove service entries." },
      { key: "expenses:read", label: "View expenses", description: "List and view fleet expenses." },
      { key: "expenses:create", label: "Log expenses", description: "Add new expense entries." },
    ],
  },
  {
    key: "groups",
    label: "Vehicle groups",
    description: "Logical groupings of the fleet.",
    items: [
      { key: "groups:read", label: "View groups", description: "View vehicle group list." },
      { key: "groups:manage", label: "Manage groups", description: "Create, edit, delete groups." },
    ],
  },
  {
    key: "emi",
    label: "EMI tracking",
    description: "Vehicle loan EMIs, schedules, payments.",
    items: [
      { key: "emi:read", label: "View EMI", description: "View EMI plans and payment schedules." },
      { key: "emi:create", label: "Add EMI", description: "Create new EMI plans for vehicles." },
      { key: "emi:update", label: "Mark paid / update", description: "Mark installments paid, update plan details." },
      { key: "emi:close", label: "Close EMI", description: "Pause, default, or close an EMI plan." },
    ],
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Alerts and notifications.",
    items: [
      { key: "notifications:read", label: "View notifications", description: "Read own notifications." },
      { key: "notifications:manage", label: "Manage notifications", description: "Configure notification rules." },
    ],
  },
  {
    key: "settings",
    label: "Workspace settings",
    description: "Tenant-admin scope.",
    items: [
      { key: "settings.roles:manage", label: "Manage roles", description: "Create and edit custom roles." },
      { key: "settings.users:manage", label: "Manage users", description: "Invite users and assign roles." },
      { key: "settings.tenant:read", label: "View tenant settings", description: "View workspace details and plan." },
      { key: "settings.documentTypes:manage", label: "Manage document types", description: "Add or edit compliance document trackers (Masters)." },
    ],
  },
  {
    key: "activity-log",
    label: "Activity log",
    description: "Audit trail of every action by users in this workspace.",
    items: [
      { key: "activityLog:read", label: "View activity log", description: "See who did what and when across the workspace." },
      { key: "activityLog:revert", label: "Revert actions", description: "Undo a recorded action — restore prior state. Use with care." },
    ],
  },
];

/**
 * Default permission sets for the built-in role enum. Used when a user has
 * `roleId == null` (no custom role assigned) — they get the permissions of
 * their `role` enum bucket.
 *
 * ADMIN: every permission. OPERATOR: read-only + day-to-day ops.
 */
export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const DEFAULT_OPERATOR_PERMISSIONS: Permission[] = [
  "vehicles:read",
  "drivers:read",
  "compliance:read",
  "compliance:upload",
  "challans:read",
  "challans:sync",
  "insurance:read",
  "fastag:read",
  "services:read",
  "services:create",
  "expenses:read",
  "expenses:create",
  "emi:read",
  "groups:read",
  "notifications:read",
];

export function defaultPermissionsForRole(role: string): Permission[] {
  if (role === "ADMIN") return DEFAULT_ADMIN_PERMISSIONS;
  if (role === "OPERATOR") return DEFAULT_OPERATOR_PERMISSIONS;
  // SUPERADMIN doesn't need permissions inside the tenant scope — it gets
  // platform-wide power via /superadmin instead.
  return [];
}
