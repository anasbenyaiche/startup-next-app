import { ImageResponse } from "next/og";

export const runtime = "edge";

// Police de la marque (Bricolage Grotesque, étroite et grasse), limitée aux
// caractères affichés. En cas d'échec, l'image garde la police par défaut.
async function brandFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@96,75,800&text=${encodeURIComponent(text)}`,
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

// Image d'aperçu (réseaux sociaux, messageries) : la banderole rose de l'accueil
// avec le titre de la page. La police par défaut ne couvre que l'alphabet latin :
// pour les autres écritures, l'image ne garde que la marque.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = (params.get("title") ?? "").slice(0, 90);
  const title = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{S}]*$/u.test(raw) && raw ? raw : "Cortège";
  const dots = [
    [24, 118, 13],
    [52, 96, 13],
    [82, 84, 13],
    [110, 62, 13],
    [134, 30, 18],
  ];

  const font = await brandFont(`cortège${title}GDELT, 15 min`);
  const family = font ? "Bricolage" : undefined;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f2f3ee",
        padding: "56px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "0 64px" }}>
        <div style={{ display: "flex", position: "relative", width: 160, height: 140 }}>
          {dots.map(([x, y, r], i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x - r,
                top: y - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                background: i === dots.length - 1 ? "#ff4fa3" : "#1e2140",
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, color: "#1e2140", fontFamily: family }}>cortège</div>
      </div>
      <div
        style={{
          display: "flex",
          margin: "0 -40px",
          padding: "36px 100px",
          background: "#ff4fa3",
          borderTop: "6px solid #1e2140",
          borderBottom: "6px solid #1e2140",
          transform: "rotate(-2deg)",
        }}
      >
        <div
          style={{
            fontSize: title.length > 60 ? 66 : 84,
            fontWeight: 800,
            color: "#1e2140",
            lineHeight: 1.05,
            fontFamily: family,
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ display: "flex", padding: "0 64px", fontSize: 28, color: "#6b6f80" }}>GDELT, 15 min</div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: "Bricolage", data: font, weight: 800, style: "normal" }] : undefined,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
