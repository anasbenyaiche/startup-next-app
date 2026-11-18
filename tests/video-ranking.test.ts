import { describe, expect, it } from "vitest";
import { normalizeVideoText, rankVideos, scoreVideo } from "@/lib/news/video-ranking";

const now = Date.parse("2026-11-18T12:00:00Z");
const video = (id: string, title: string, publishedAt = "2026-11-18T10:00:00Z") => ({
  id, title, author: null, publishedAt, live: false, source: "youtube" as const,
});

describe("automatic video relevance", () => {
  it("matches accents and whole city names", () => {
    expect(normalizeVideoText("Grève à Besançon")).toBe("greve a besancon");
    expect(scoreVideo(video("1", "Grève à Besançon"), "Besançon, France", now))
      .toMatchObject({ matchedLocation: true, matchedTopic: true });
    expect(scoreVideo(video("2", "Parisien"), "Paris, France", now).matchedLocation).toBe(false);
  });

  it("ranks locally relevant coverage above unrelated recent clips", () => {
    const results = rankVideos([
      video("unrelated", "Funny animals"),
      video("local", "Manifestation à Lyon"),
      video("old", "Manifestation à Lyon", "2026-11-01T10:00:00Z"),
    ], "Lyon, France", now);
    expect(results.map((v) => v.id)).toEqual(["local", "old", "unrelated"]);
  });

  it("does not mutate input order", () => {
    const items = [video("a", "Cats"), video("b", "Protest in Berlin")];
    rankVideos(items, "Berlin, Germany", now);
    expect(items.map((v) => v.id)).toEqual(["a", "b"]);
  });
});
