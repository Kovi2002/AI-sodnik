import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as app/icon.svg, full-bleed so iOS can round the corners itself.
export default async function AppleIcon() {
  const svg = await readFile(path.join(process.cwd(), "app", "icon.svg"), "utf8");
  const fullBleed = svg.replace('rx="7"', 'rx="0"');
  const src = `data:image/svg+xml;base64,${Buffer.from(fullBleed).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <img src={src} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
