import { describe, expect, it } from "vitest";
import { braveVideoQueries, videoCity, withinVideoWindow, youtubeVideoQuery } from "@/lib/news/video-discovery";

describe("video discovery", () => {
  it("targets the city rather than the whole GDELT location", () => {
    expect(videoCity("Paris, France")).toBe("Paris");
    expect(youtubeVideoQuery("Paris, France")).toContain('"Paris"');
    expect(youtubeVideoQuery("Paris, France")).not.toContain("France");
  });
  it("creates complementary TikTok searches", () => {
    const queries = braveVideoQueries("Madrid, Spain");
    expect(queries).toHaveLength(2);
    expect(queries.every((q) => q.includes("site:tiktok.com") && q.includes('"Madrid"'))).toBe(true);
  });
  it("rejects stale and future-dated videos", () => {
    const now = Date.parse("2026-11-18T12:00:00Z");
    expect(withinVideoWindow("2026-11-18T10:00:00Z", 6, now)).toBe(true);
    expect(withinVideoWindow("2026-11-16T10:00:00Z", 6, now)).toBe(false);
    expect(withinVideoWindow("2026-11-18T13:00:00Z", 6, now)).toBe(false);
  });
});
