import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getVerdictForImage } from "@/lib/cases";
import { errorResponse } from "@/lib/errors";

type FontSpec = { name: string; file: string; weight: 400 | 500 | 600 };

const FONT_FILES: FontSpec[] = [
  { name: "Plex Sans", file: "IBMPlexSans-Regular.woff", weight: 400 },
  { name: "Plex Sans", file: "IBMPlexSans-SemiBold.woff", weight: 600 },
  { name: "Plex Serif", file: "IBMPlexSerif-Medium.woff", weight: 500 },
  { name: "Plex Mono", file: "IBMPlexMono-Regular.woff", weight: 400 },
];

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 600; style: "normal" }[]> | undefined;

function loadFonts() {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async (f) => ({
      name: f.name,
      weight: f.weight,
      style: "normal" as const,
      data: await readFile(path.join(process.cwd(), "assets", "fonts", f.file)),
    })),
  ).catch((err) => {
    fontsPromise = undefined;
    throw err;
  });
  return fontsPromise;
}

const C = {
  bg: "#F4F2EE",
  ink: "#17171A",
  muted: "#66646B",
  line: "#D6D2CA",
  accent: "#B23A1E",
  quiet: "#3D3C42",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { nameA, nameB, topic, verdict } = await getVerdictForImage(id);
    const fonts = await loadFonts();
    const aGuiltier = verdict.blameA >= verdict.blameB;
    const parties = [
      { name: nameA, blame: verdict.blameA, color: aGuiltier ? C.accent : C.quiet },
      { name: nameB, blame: verdict.blameB, color: aGuiltier ? C.quiet : C.accent },
    ];

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: C.bg,
            color: C.ink,
            padding: "84px 88px 72px",
            fontFamily: "Plex Sans",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "Plex Mono",
              fontSize: 26,
              letterSpacing: 3,
              paddingBottom: 26,
              borderBottom: `3px solid ${C.ink}`,
            }}
          >
            <div style={{ display: "flex" }}>KDO JE KRIV?</div>
            <div style={{ display: "flex" }}>{`RAZSODBA · ${id.slice(0, 6).toUpperCase()}`}</div>
          </div>

          <div style={{ display: "flex", marginTop: 56, fontSize: 30, color: C.muted, lineHeight: 1.35 }}>
            {`Zadeva: ${topic}`}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontFamily: "Plex Serif",
              fontWeight: 500,
              fontSize: 70,
              lineHeight: 1.12,
              letterSpacing: -1,
            }}
          >
            {verdict.title}
          </div>

          <div style={{ display: "flex", marginTop: 64, gap: 48 }}>
            {parties.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  alignItems: i === 0 ? "flex-start" : "flex-end",
                }}
              >
                <div style={{ display: "flex", fontSize: 36, fontWeight: 600, color: C.ink }}>{p.name}</div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 168,
                    fontWeight: 600,
                    lineHeight: 1,
                    marginTop: 10,
                    letterSpacing: -6,
                    color: p.color,
                  }}
                >
                  {`${p.blame} %`}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 28, height: 20, width: "100%", background: C.line }}>
            <div style={{ display: "flex", width: `${verdict.blameA}%`, background: parties[0].color }} />
            <div style={{ display: "flex", width: 6, background: C.bg }} />
            <div style={{ display: "flex", flex: 1, background: parties[1].color }} />
          </div>
          <div style={{ display: "flex", marginTop: 12, fontFamily: "Plex Mono", fontSize: 22, color: C.muted }}>
            DELEŽ KRIVDE
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 56, flex: 1 }}>
            <div style={{ display: "flex", fontFamily: "Plex Mono", fontSize: 24, letterSpacing: 3, color: C.accent }}>
              KAZEN
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 36, lineHeight: 1.35 }}>{verdict.punishment}</div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: `2px solid ${C.line}`,
              paddingTop: 22,
              fontFamily: "Plex Mono",
              fontSize: 22,
              color: C.muted,
            }}
          >
            <div style={{ display: "flex" }}>Samo za zabavo. Ni pravni nasvet.</div>
            <div style={{ display: "flex" }}>Razsodba je pravnomočna.</div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1350,
        fonts,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
