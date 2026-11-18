import { describe, expect, it } from "vitest";
import { activityForTargets, countReports } from "@/lib/news/watch-activity";
import type { ManifestationPlace } from "@/lib/news/manifestations";

const place = (key: string, country: string, incidents: number): ManifestationPlace => ({
  key, country, location: key, countryName: country, lat: 0, lng: 0,
  precision: "city", domains: 1, reliability: 50, latestAt: "2026-11-18T00:00:00.000Z",
  byType: { protest: { incidents, reports: incidents * 2, mentions: incidents * 3 } },
});

describe("followed activity", () => {
  it("counts incidents, not article reports", () => {
    expect(countReports(place("a", "FR", 3))).toBe(3);
  });

  it("aggregates countries and specific places independently", () => {
    const targets = [
      { id: "country:FR", country: "FR", label: "France" },
      { id: "place:paris", country: "FR", placeKey: "paris", label: "Paris" },
      { id: "country:DE", country: "DE", label: "Germany" },
    ];
    const six = { places: [place("paris", "FR", 2), place("lyon", "FR", 3), place("berlin", "DE", 1)] };
    const day = { places: [place("paris", "FR", 7), place("lyon", "FR", 4), place("berlin", "DE", 8)] };
    const rows = activityForTargets(targets, six, day);
    expect(rows.find((r) => r.id === "country:FR")).toMatchObject({ sixHours: 5, twentyFourHours: 11 });
    expect(rows.find((r) => r.id === "place:paris")).toMatchObject({ sixHours: 2, twentyFourHours: 7 });
    expect(rows.find((r) => r.id === "country:DE")).toMatchObject({ sixHours: 1, twentyFourHours: 8 });
  });

  it("returns zero for a followed place with no reported activity", () => {
    const rows = activityForTargets(
      [{ id: "place:none", country: "FR", placeKey: "none", label: "No reports" }],
      { places: [place("paris", "FR", 2)] },
      { places: [] },
    );
    expect(rows[0]).toMatchObject({ sixHours: 0, twentyFourHours: 0 });
  });
});
