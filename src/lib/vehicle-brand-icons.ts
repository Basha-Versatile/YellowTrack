/**
 * Allowed `iconKey` values for VehicleBrand. Each key maps to an icon from
 * `react-icons/si`. Both server (validation) and client (rendering) import
 * from this file so the contract stays in one place.
 *
 * Adding a new brand icon is two steps:
 *   1. Add the key here (matches the react-icons/si export name).
 *   2. Add the icon to the renderer in components/icons/VehicleBrandIcon.tsx.
 */
export const VEHICLE_BRAND_ICON_KEYS = [
  "SiAudi",
  "SiBmw",
  "SiChevrolet",
  "SiFiat",
  "SiFord",
  "SiHonda",
  "SiHyundai",
  "SiJaguar",
  "SiJeep",
  "SiKia",
  "SiLandrover",
  "SiMahindra",
  "SiMaserati",
  "SiMazda",
  "SiMclaren",
  "SiMg",
  "SiMini",
  "SiMitsubishi",
  "SiNissan",
  "SiPeugeot",
  "SiPorsche",
  "SiRenault",
  "SiSkoda",
  "SiSubaru",
  "SiSuzuki",
  "SiTata",
  "SiTesla",
  "SiToyota",
  "SiVolkswagen",
  "SiVolvo",
] as const;

export type VehicleBrandIconKey = (typeof VEHICLE_BRAND_ICON_KEYS)[number];
