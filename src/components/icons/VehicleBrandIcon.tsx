"use client";
import React from "react";
import {
  SiAudi,
  SiBmw,
  SiChevrolet,
  SiFiat,
  SiFord,
  SiHonda,
  SiHyundai,
  SiJaguar,
  SiJeep,
  SiKia,
  SiLandrover,
  SiMahindra,
  SiMaserati,
  SiMazda,
  SiMclaren,
  SiMg,
  SiMini,
  SiMitsubishi,
  SiNissan,
  SiPeugeot,
  SiPorsche,
  SiRenault,
  SiSkoda,
  SiSubaru,
  SiSuzuki,
  SiTata,
  SiTesla,
  SiToyota,
  SiVolkswagen,
  SiVolvo,
} from "react-icons/si";
import type { IconType } from "react-icons";
import { VEHICLE_BRAND_ICON_KEYS, type VehicleBrandIconKey } from "@/lib/vehicle-brand-icons";

/** Map of allowed iconKey → react-icons component. Keep in sync with the
 *  lib/vehicle-brand-icons.ts allow-list so unknown keys can't be referenced. */
export const BRAND_ICON_COMPONENTS: Record<VehicleBrandIconKey, IconType> = {
  SiAudi,
  SiBmw,
  SiChevrolet,
  SiFiat,
  SiFord,
  SiHonda,
  SiHyundai,
  SiJaguar,
  SiJeep,
  SiKia,
  SiLandrover,
  SiMahindra,
  SiMaserati,
  SiMazda,
  SiMclaren,
  SiMg,
  SiMini,
  SiMitsubishi,
  SiNissan,
  SiPeugeot,
  SiPorsche,
  SiRenault,
  SiSkoda,
  SiSubaru,
  SiSuzuki,
  SiTata,
  SiTesla,
  SiToyota,
  SiVolkswagen,
  SiVolvo,
};

export type BrandLike = {
  name: string;
  logoUrl?: string | null;
  iconKey?: string | null;
};

/**
 * Visual for a brand. Priority: uploaded `logoUrl` → react-icons `iconKey` →
 * a circle with the brand's initial.
 */
export function VehicleBrandIcon({
  brand,
  size = 24,
  className,
}: {
  brand: BrandLike;
  size?: number;
  className?: string;
}) {
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logoUrl}
        alt={brand.name}
        width={size}
        height={size}
        className={`object-contain ${className ?? ""}`}
      />
    );
  }
  if (
    brand.iconKey &&
    (VEHICLE_BRAND_ICON_KEYS as readonly string[]).includes(brand.iconKey)
  ) {
    const Comp = BRAND_ICON_COMPONENTS[brand.iconKey as VehicleBrandIconKey];
    return <Comp size={size} className={className} />;
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 font-bold ${className ?? ""}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {brand.name.charAt(0).toUpperCase()}
    </span>
  );
}
