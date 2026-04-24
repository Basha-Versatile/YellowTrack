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
import { Lightbulb } from "lucide-react";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  new?: boolean;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <MdSpaceDashboard className="h-5 w-5" />,
    name: "Dashboard",
    path: "/",
  },
  {
    icon: <BsFillCarFrontFill className="h-5 w-5" />,
    name: "Vehicles",
    subItems: [
      { name: "All Vehicles", path: "/vehicles" },
      { name: "Vehicle Groups", path: "/vehicles/groups" },
      { name: "Onboard Vehicle", path: "/vehicles/onboard" },
      { name: "Compliance", path: "/compliance" },
      { name: "Challans", path: "/challans" },
      { name: "FASTag", path: "/fastag" },
      { name: "Services", path: "/vehicles/services"},
      { name: "Expenses", path: "/vehicles/expenses"},
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "Drivers",
    subItems: [
      { name: "All Drivers", path: "/drivers" },
      { name: "Add Driver", path: "/drivers/add" },
      { name: "Compliance", path: "/drivers/compliance" },
    ],
  },
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
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const expanded = isExpanded || isHovered || isMobileOpen;

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

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <aside
      className={`fixed flex flex-col top-0 left-0 h-full transition-all duration-300 ease-in-out z-50
        bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 border-r border-gray-200 dark:border-gray-800/50
        ${
          expanded
            ? "w-[280px]"
            : "w-[80px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        xl:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div
        className={`px-5 pt-7 pb-4 flex bg-gray-100/70 dark:bg-white/5 ${
          !expanded ? "justify-center" : "justify-start"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/images/logo/yellow-track-logo.png" alt="Yellow Track" width={40} height={40} className="flex-shrink-0 rounded-xl object-contain" />
          {expanded && (
            <span className="text-lg font-extrabold tracking-tight">
              <span className="text-yellow-500">Yellow</span>
              <span className="text-gray-900 dark:text-white"> Track</span>
            </span>
          )}
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-5 mb-4">
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
            {renderMenuItems(navItems, "main")}
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

      {/* Bottom user card */}
      <div className="mt-auto px-4 pb-5">
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300/60 to-transparent dark:via-gray-700/50 mb-4" />
        {expanded ? (
          <div className="flex items-center gap-3 rounded-xl bg-gray-100/70 dark:bg-white/5 p-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-yellow-500/20 flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 truncate">
                {user?.name || "User"}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                {user?.role || "Member"}
              </p>
            </div>
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
