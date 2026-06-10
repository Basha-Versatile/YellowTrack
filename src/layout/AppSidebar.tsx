"use client";
import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import {
  ChevronDownIcon,
  HorizontaLDots,
  // TaskIcon,
  UserCircleIcon,
} from "../icons/index";
import { BsFillCarFrontFill } from "react-icons/bs";
import { MdSpaceDashboard } from "react-icons/md";
import { Activity, CreditCard, Database, FolderArchive, Lightbulb, Shield, UsersRound,
  // Bell

} from "lucide-react";

type NavSubItem = {
  name: string;
  path: string;
  pro?: boolean;
  new?: boolean;
  perm?: string;
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  new?: boolean;
  perm?: string;
  /** Optional per-tenant feature flag gate. Item only renders when the
   *  tenant has the flag enabled (via superadmin → Features). */
  featureFlag?: import("@/lib/feature-flags").FeatureFlagKey;
  subItems?: NavSubItem[];
};

const navItems: NavItem[] = [
  {
    icon: <MdSpaceDashboard className="h-5 w-5" />,
    name: "Dashboard",
    path: "/dashboard",
    // Dashboard is the workspace home — visible to anyone in the tenant.
  },
  {
    icon: <BsFillCarFrontFill className="h-5 w-5" />,
    name: "Vehicles",
    subItems: [
      { name: "All Vehicles", path: "/vehicles", perm: "vehicles:read" },
      { name: "Vehicle Groups", path: "/vehicles/groups", perm: "groups:read" },
      // { name: "Onboard Vehicle", path: "/vehicles/onboard", perm: "vehicles:create" },
      { name: "Compliance", path: "/compliance", perm: "compliance:read" },
      { name: "Challans", path: "/challans", perm: "challans:read" },
      { name: "FASTag", path: "/fastag", perm: "fastag:read" },
      // { name: "Service Costs", path: "/vehicles/services", perm: "services:read" },
      { name: "Expenses", path: "/vehicles/expenses", perm: "expenses:read" },
      { name: "EMI Tracker", path: "/vehicles/emi", perm: "emi:read" },
      { name: "Sold Vehicles", path: "/vehicles/sold", perm: "vehicles:read" },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "Drivers",
    subItems: [
      { name: "All Drivers", path: "/drivers", perm: "drivers:read" },
      // { name: "Add Driver", path: "/drivers/add", perm: "drivers:create" },
      { name: "Compliance", path: "/drivers/compliance", perm: "drivers:read" },
    ],
  },
  {
    icon: <FolderArchive className="h-5 w-5" />,
    name: "Custom Compliance",
    path: "/custom-compliance",
    // Reuses the existing compliance read gate — anyone who can see vehicle
    // compliance can see the documents bank too.
    perm: "compliance:read",
  },
  {
    // Manual credit-card bill tracker. Hidden until a superadmin enables
    // `creditCardTracking` on the tenant. No `perm` — any user in the tenant
    // sees it once the flag is on.
    icon: <CreditCard className="h-5 w-5" />,
    name: "Credit Cards",
    path: "/credit-cards",
    featureFlag: "creditCardTracking",
  },
  {
    icon: <UsersRound className="h-5 w-5" />,
    name: "Users",
    path: "/settings/users",
    perm: "settings.users:manage",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    name: "Roles & permissions",
    path: "/settings/roles",
    perm: "settings.roles:manage",
  },
  {
    icon: <Database className="h-5 w-5" />,
    name: "Masters",
    subItems: [
      { name: "Document Types", path: "/settings/document-types", perm: "settings.documentTypes:manage" },
    ],
  },
  {
    icon: <Activity className="h-5 w-5" />,
    name: "Activity Log",
    path: "/activity",
    perm: "activityLog:read",
  },
  // {
  //   icon: <Bell className="h-5 w-5" />,
  //   name: "Notifications",
  //   path: "/settings/notifications",
  //   perm: "settings.users:manage",
  // },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    name: "Feedback",
    path: "/suggest-feature",
    new: true,
  },
  // {
  //   icon: <TaskIcon />,
  //   name: "Buy Insurance",
  //   path: "/buy-insurance",
  // },
];

const othersItems: NavItem[] = [];
const supportItems: NavItem[] = [];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { user, tenant, logout, hasPermission } = useAuth();
  const pathname = usePathname();
  const expanded = isExpanded || isHovered || isMobileOpen;

  // Filter nav items by the current user's permissions + per-tenant
  // feature flags.
  //   - Admin gets every permission via defaultPermissionsForRole("ADMIN").
  //   - Items with no `perm` (e.g. Dashboard, Feedback) are always visible.
  //   - Items with `featureFlag` hide unless the tenant has that flag on.
  //     Flags default to false at the model layer so a missing flag map
  //     keeps the item hidden — which is the correct safe default.
  //   - Parent items hide entirely when ALL their sub-items are hidden.
  const tenantFeatures = tenant?.features ?? {};
  const visibleNavItems = React.useMemo(() => {
    const featurePasses = (nav: NavItem) =>
      !nav.featureFlag || Boolean(tenantFeatures[nav.featureFlag]);
    return navItems
      .map((nav) => {
        if (nav.subItems) {
          const visibleSubs = nav.subItems.filter(
            (s) => !s.perm || hasPermission(s.perm),
          );
          if (visibleSubs.length === 0) return null;
          if (!featurePasses(nav)) return null;
          return { ...nav, subItems: visibleSubs };
        }
        if (nav.perm && !hasPermission(nav.perm)) return null;
        if (!featurePasses(nav)) return null;
        return nav;
      })
      .filter((n): n is NavItem => n !== null);
  }, [hasPermission, tenantFeatures]);

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "support" | "others"
  ) => (
    <ul className="flex flex-col gap-1">
      {navItems.map((nav, index) => {
        const isOpen =
          openSubmenu?.type === menuType && openSubmenu?.index === index;
        const active = nav.path ? isActive(nav.path) : isOpen;

        return (
          <li key={nav.name}>
            {nav.subItems ? (
              <button
                onClick={() => handleSubmenuToggle(index, menuType)}
                className={`group relative flex items-center w-full gap-3 rounded-xl px-3 py-2.5 font-medium text-sm transition-all duration-200 cursor-pointer ${
                  isOpen
                    ? "bg-white/70 text-gray-900 shadow-sm dark:bg-yellow-500/10 dark:text-yellow-400"
                    : "text-gray-700 hover:bg-white/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
                } ${!expanded ? "lg:justify-center" : "lg:justify-start"}`}
              >
                <span
                  className={`flex-shrink-0 transition-colors duration-200 ${
                    isOpen
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-gray-500 group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-300"
                  }`}
                >
                  {nav.icon}
                </span>
                {expanded && (
                  <span className="flex-1 text-left">{nav.name}</span>
                )}
                {nav.new && expanded && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-success-100 text-success-600 dark:bg-success-500/20 dark:text-success-400">
                    new
                  </span>
                )}
                {expanded && (
                  <ChevronDownIcon
                    className={`w-4 h-4 transition-transform duration-300 ${
                      isOpen
                        ? "rotate-180 text-yellow-600 dark:text-yellow-400"
                        : "text-gray-400"
                    }`}
                  />
                )}
              </button>
            ) : (
              nav.path && (
                <Link
                  href={nav.path}
                  className={`group relative flex items-center w-full gap-3 rounded-xl px-3 py-2.5 font-medium text-sm transition-all duration-200 ${
                    active
                      ? "bg-white/70 text-gray-900 shadow-sm dark:bg-yellow-500/10 dark:text-yellow-400"
                      : "text-gray-700 hover:bg-white/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
                  }`}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-yellow-500 dark:bg-yellow-400" />
                  )}
                  <span
                    className={`flex-shrink-0 transition-colors duration-200 ${
                      active
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-gray-500 group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-300"
                    }`}
                  >
                    {nav.icon}
                  </span>
                  {expanded && <span>{nav.name}</span>}
                </Link>
              )
            )}
            {nav.subItems && expanded && (
              <div
                ref={(el) => {
                  subMenuRefs.current[`${menuType}-${index}`] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height: isOpen
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
                }}
              >
                <ul className="mt-1 ml-5 pl-4 space-y-0.5 border-l-2 border-yellow-300/50 dark:border-gray-700/40">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                          isActive(subItem.path)
                            ? "text-gray-900 bg-white/60 dark:text-yellow-400 dark:bg-yellow-500/10"
                            : "text-gray-600 hover:text-gray-900 hover:bg-white/40 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/5"
                        }`}
                      >
                        {/* Active dot */}
                        {isActive(subItem.path) && (
                          <span className="absolute -left-[21px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-yellow-500 dark:bg-yellow-400 ring-2 ring-yellow-100 dark:ring-gray-900" />
                        )}
                        {subItem.name}
                        {subItem.new && (
                          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-success-100 text-success-600 dark:bg-success-500/20 dark:text-success-400">
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-brand-100 text-brand-600 dark:bg-brand-400/20 dark:text-brand-400">
                            pro
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "support" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    let submenuMatched = false;
    ["main", "support", "others"].forEach((menuType) => {
      const items =
        menuType === "main"
          ? navItems
          : menuType === "support"
          ? supportItems
          : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "support" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (
    index: number,
    menuType: "main" | "support" | "others"
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  // Initials for the tenant bottom card (fallback when no logo image is set).
  // We use the tenant's name first (since the bottom card shows the tenant);
  // falls back to the user's name only if there is no tenant (superadmin).
  const tenantInitials = (tenant?.name ?? user?.name ?? "Yellow Track")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className={`fixed flex flex-col top-0 left-0 h-full transition-all duration-300 ease-in-out z-50
        bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 border-r border-gray-200 dark:border-gray-800/50
        ${
          expanded
            ? "w-[320px]"
            : "w-[80px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        max-w-[85vw] lg:max-w-none lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo — header section. Sidebar is 320px / 80px when expanded /
          collapsed. Zero padding around the logo container so all the
          visible whitespace comes only from inside the SVG itself (the
          brand mark's own breathing room inside its 1080×1080 viewBox). */}
      <div
        className={`flex items-center justify-center transition-all duration-300 ${
          expanded ? "p-0" : "px-2 pt-4 pb-3"
        }`}
      >
        <Link
          href="/dashboard"
          aria-label="Yellow Track"
          // SVG vector source → infinitely sharp at this or any rendered
          // size. Square container + 1:1 SVG viewBox (1080×1080) + the
          // object-contain on the inner Image preserve the aspect ratio.
          className={`relative block flex-shrink-0 transition-all duration-300 ${
            expanded ? "size-64" : "size-16"
          }`}
        >
          <Image
            src="/images/logo/yellow-track-logo.svg"
            alt="Yellow Track"
            fill
            sizes="256px"
            className="object-contain"
            priority
          />
        </Link>
      </div>

      {/* Divider — zero margin below so the menu sits as close as possible
          to the brand mark. */}
      <div className="mx-5">
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300/60 to-transparent dark:via-gray-700/50" />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 no-scrollbar">
        <nav className="flex flex-col gap-6">
          {/* Main menu */}
          <div>
            {expanded && (
              <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-700/60 dark:text-gray-500">
                Menu
              </h2>
            )}
            {!expanded && (
              <div className="flex justify-center mb-2">
                <HorizontaLDots className="text-gray-400" />
              </div>
            )}
            {renderMenuItems(visibleNavItems, "main")}
          </div>

          {/* Support section */}
          {supportItems.length > 0 && (
            <div>
              {expanded && (
                <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-700/60 dark:text-gray-500">
                  Support
                </h2>
              )}
              {renderMenuItems(supportItems, "support")}
            </div>
          )}

          {/* Others section */}
          {othersItems.length > 0 && (
            <div>
              {expanded && (
                <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-700/60 dark:text-gray-500">
                  Others
                </h2>
              )}
              {renderMenuItems(othersItems, "others")}
            </div>
          )}
        </nav>
      </div>

      {/* Bottom tenant card — workspace identity (logo + name + billing email).
          Falls back to the user's name when no tenant is loaded (superadmin). */}
      <div className="mt-auto px-4 pb-5">
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300/60 to-transparent dark:via-gray-700/50 mb-4" />
        {expanded ? (
          <div className="flex items-center gap-3 rounded-xl bg-gray-100/70 dark:bg-white/5 p-3">
            <Link
              href="/profile"
              className="flex items-center gap-3 flex-1 min-w-0 rounded-lg -m-1 p-1 hover:bg-gray-200/50 dark:hover:bg-white/5 transition-colors"
              title="View profile"
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-yellow-500/20 flex-shrink-0">
                {tenant?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
                ) : (
                  tenantInitials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 truncate">
                  {tenant?.name ?? user?.name ?? "Workspace"}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                  {tenant?.billingEmail ?? user?.email ?? "—"}
                </p>
              </div>
            </Link>
            <button
              onClick={() => logout()}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-100/50 dark:hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => logout()}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-100/50 dark:hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
