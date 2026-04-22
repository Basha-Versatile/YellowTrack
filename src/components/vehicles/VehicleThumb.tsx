"use client";
import React, { useState, useEffect } from "react";
import { Car } from "lucide-react";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";

type Group = { icon?: string; color?: string } | null | undefined;

/**
 * Resolves a stored image path into a browser-loadable URL.
 * - Absolute URLs (Vercel Blob, S3, Cloudinary, data:, blob:) → returned as-is
 * - Relative paths (legacy /uploads/...) → ensured to start with `/` so the
 *   browser loads them from same origin (Next.js serves them from public/)
 *
 * Exported so callers (hover-preview overlays etc.) can use the same logic.
 */
export function resolveImageUrl(
  src: string | null | undefined,
): string | null {
  if (!src) return null;
  if (/^(https?:)?\/\//.test(src) || /^(data|blob):/.test(src)) return src;
  return src.startsWith("/") ? src : `/${src}`;
}

interface VehicleThumbProps {
  profileImage?: string | null;
  group?: Group;
  size?: number; // px, default 40
  className?: string;
  iconClassName?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a vehicle avatar with this priority:
 *   1. `profileImage` (if set and loads successfully)
 *   2. `group.icon` tinted with `group.color`
 *   3. Generic Car icon (when group is missing)
 *
 * Handles absolute URLs (Vercel Blob, S3, Cloudinary) and relative `/uploads/...`
 * paths. Falls back to the group icon on image load errors (404 / broken).
 */
export function VehicleThumb({
  profileImage,
  group,
  size = 40,
  className = "",
  iconClassName = "",
  style,
}: VehicleThumbProps) {
  const [broken, setBroken] = useState(false);

  // Reset error state when the image source changes so retries re-render.
  useEffect(() => {
    setBroken(false);
  }, [profileImage]);

  const resolvedSrc = React.useMemo(
    () => resolveImageUrl(profileImage),
    [profileImage],
  );

  const showImage = resolvedSrc && !broken;
  const GroupIcon = group?.icon ? getVehicleTypeIcon(group.icon) : Car;

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    ...(!showImage && group?.color ? { backgroundColor: `${group.color}12` } : null),
    ...style,
  };

  return (
    <div
      className={`flex-shrink-0 rounded-xl flex items-center justify-center overflow-hidden ${
        !showImage ? "bg-gray-100 dark:bg-gray-800" : ""
      } ${className}`}
      style={wrapperStyle}
    >
      {showImage ? (
        <img
          src={resolvedSrc}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <GroupIcon
          className={`w-5 h-5 ${iconClassName}`}
          style={group?.color ? { color: group.color } : undefined}
        />
      )}
    </div>
  );
}
