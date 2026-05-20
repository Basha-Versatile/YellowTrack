import React from "react";

// Inline SVG version of the "The Yellow Track" mark used in the sidebar
// header. Lives here so we don't depend on the PNG file and so the logo
// scales crisply at any size. Black rounded card + dashed white border +
// stacked "The / Yellow / TRACK" wordmark with a small arrow on the right.
//
// Pass any Tailwind sizing classes via `className` (e.g. "h-full w-auto").
export function YellowTrackLogo({
  className = "",
  title = "The Yellow Track",
  stretch = false,
}: {
  className?: string;
  title?: string;
  /** When true, the SVG stretches to fill both axes of its parent (used in
   *  the expanded sidebar so the logo spans the full width). */
  stretch?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 400 240"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
      preserveAspectRatio={stretch ? "none" : "xMidYMid meet"}
    >
      <title>{title}</title>

      {/* Black rounded card */}
      <rect width="400" height="240" rx="20" ry="20" fill="#0a0a0a" />

      {/* Dashed white border, slightly inset */}
      <rect
        x="18"
        y="18"
        width="364"
        height="204"
        rx="14"
        ry="14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeDasharray="14 10"
      />

      {/* Arrow tab on the right edge */}
      <g fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="360" y1="198" x2="390" y2="198" />
        <polyline points="382,190 390,198 382,206" />
      </g>

      {/* "The" */}
      <text
        x="48"
        y="92"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight={900}
        fontSize={56}
        fill="#ffffff"
      >
        The
      </text>

      {/* "Yellow" — the brand colour pulled from the existing PNG */}
      <text
        x="48"
        y="168"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight={900}
        fontSize={72}
        fill="#facc15"
      >
        Yellow
      </text>

      {/* "TRACK" — smaller, letter-spaced caption under Yellow */}
      <text
        x="120"
        y="206"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight={700}
        fontSize={24}
        fill="#ffffff"
        letterSpacing="6"
      >
        TRACK
      </text>
    </svg>
  );
}
