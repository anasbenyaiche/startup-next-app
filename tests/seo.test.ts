import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: () => undefined }));

const { countryStats, indexableCountries } = await import("@/lib/news/seo");
const { INDEX_MIN_INCIDENTS } = await import("@/lib/content/pages");
import type { ManifestationPlace, ManifestationsResult } from "@/lib/news/manifestations";

const place = (country: string, incidents: number): ManifestationPlace => ({
  key: `${country}:${incidents}`,
  location: country,
  country,
  countryName: country,
  lat: 0,
  lng: 0,
  precision: "city",
  byType: { "141": { reports: incidents, incidents, mentions: incidents } },
  domains: 1,
  reliability: 50,
  latestAt: "2026-11-18T00:00:00Z",
});
const data = { places: [place("FR", 3), place("FR", 4), place("GM", 2), place("PO", 1)] } as ManifestationsResult;

describe("indexableCountries", () => {
  it("ne garde que les pays avec assez de manifestations", () => {
    expect(INDEX_MIN_INCIDENTS).toBe(5);
    expect(countryStats(data).map((c) => c.fips)).toEqual(["FR", "GM", "PO"]);
    expect(indexableCountries(data).map((c) => c.fips)).toEqual(["FR"]);
    expect(indexableCountries(null)).toEqual([]);
  });
});
