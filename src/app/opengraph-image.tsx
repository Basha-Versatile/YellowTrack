import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Next.js auto-discovers this file and serves it as the site's Open Graph
// preview image. Replaces the broken behaviour where WhatsApp / Slack / etc.
// were scraping the favicon and rendering a glitched crop of it.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Yellow Track — Fleet Compliance Management";

export default async function OpenGraphImage() {
  // Read the SVG once at build time, embed as a base64 data-URL inside an
  // <img>. Next's ImageResponse renders SVG via this path reliably.
  let logoDataUrl: string | null = null;
  try {
    const svgPath = path.join(
      process.cwd(),
      "public",
      "images",
      "logo",
      "yellow-track-logo.svg",
    );
    const svg = await readFile(svgPath, "utf-8");
    const base64 = Buffer.from(svg).toString("base64");
    logoDataUrl = `data:image/svg+xml;base64,${base64}`;
  } catch {
    // Falls back to text-only branding if the SVG can't be read for any
    // reason — won't block the build.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 50%, #FFF7E1 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* subtle decorative yellow corner glows */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 420,
            height: 420,
            borderRadius: 420,
            background: "rgba(252, 211, 77, 0.35)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -140,
            left: -120,
            width: 420,
            height: 420,
            borderRadius: 420,
            background: "rgba(255, 205, 9, 0.25)",
            filter: "blur(80px)",
          }}
        />

        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoDataUrl}
            alt="Yellow Track"
            width={340}
            height={340}
            style={{ marginBottom: 30 }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: "-2px",
              marginBottom: 24,
            }}
          >
            <span style={{ color: "#FFCD09" }}>Yellow</span>
            <span style={{ color: "#111827", marginLeft: 16 }}>Track</span>
          </div>
        )}

        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "#111827",
            letterSpacing: "-0.5px",
            display: "flex",
          }}
        >
          Fleet management that doesn&apos;t miss a beat.
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 26,
            color: "#6B7280",
            display: "flex",
          }}
        >
          RC · Insurance · PUC · Permit · FASTag · Challans · EMIs
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 36,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 20,
            color: "#9CA3AF",
            fontWeight: 600,
            letterSpacing: "2px",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 8,
              background: "#FFCD09",
              display: "inline-block",
            }}
          />
          THEYELLOWTRACK.COM
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
