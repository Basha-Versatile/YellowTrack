import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const TruckIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 3h15v13H1zM16 8h4l3 4v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const BusIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    <path d="M2 10h20M7 18v2M17 18v2" />
    <circle cx="6.5" cy="14.5" r="1.5" /><circle cx="17.5" cy="14.5" r="1.5" />
  </svg>
);

const CabIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10 2h4l1 3H9l1-3Z" />
    <path d="M5 7h14l2 6v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5l2-6Z" />
    <path d="M5 13h14" /><circle cx="7.5" cy="16" r="1" /><circle cx="16.5" cy="16" r="1" />
  </svg>
);

const AutoIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2L8 6H4l-1 5v5h2a2 2 0 1 0 4 0h6a2 2 0 1 0 4 0h2v-5l-1-5h-4L12 2Z" />
    <path d="M3 11h18" /><circle cx="7" cy="16" r="2" /><circle cx="17" cy="16" r="2" />
  </svg>
);

const SUVIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 6h10l4 5v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-5Z" />
    <path d="M4 11h16" /><circle cx="7" cy="15" r="1.5" /><circle cx="17" cy="15" r="1.5" />
    <path d="M10 6v5M14 6v5" />
  </svg>
);

const SedanIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 11l2-5h10l2 5" />
    <path d="M3 11h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z" />
    <circle cx="7.5" cy="14.5" r="1.5" /><circle cx="16.5" cy="14.5" r="1.5" />
  </svg>
);

const VanIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 5h14v12H2z" /><path d="M16 9h3l3 4v4h-6V9Z" />
    <circle cx="6" cy="19" r="2" /><circle cx="18" cy="19" r="2" /><path d="M2 10h14" />
  </svg>
);

const OthersIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" /><path d="M7.5 12H3M21 12h-4.5" />
  </svg>
);

const ICON_MAP: Record<string, React.FC<IconProps>> = {
  truck: TruckIcon, bus: BusIcon, cab: CabIcon, auto: AutoIcon,
  suv: SUVIcon, sedan: SedanIcon, van: VanIcon, others: OthersIcon,
};

export const getVehicleTypeIcon = (iconKey: string): React.FC<IconProps> => ICON_MAP[iconKey] || OthersIcon;

export const VEHICLE_TYPE_ICONS = [
  { key: "truck", label: "Truck", component: TruckIcon },
  { key: "bus", label: "Bus", component: BusIcon },
  { key: "cab", label: "Cab", component: CabIcon },
  { key: "suv", label: "SUV", component: SUVIcon },
  { key: "sedan", label: "Sedan", component: SedanIcon },
  { key: "van", label: "Van", component: VanIcon },
  { key: "others", label: "Others", component: OthersIcon },
];

export default ICON_MAP;
