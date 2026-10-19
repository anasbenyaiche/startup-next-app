import { describe, expect, it } from "vitest";
import { resetLimit, underLimit } from "@/lib/core/rate-limit";
import { safeReturnPath } from "@/lib/core/return-path";
import { distanceKm } from "@/lib/geo/distance";
import { countryPath, localePath, plural } from "@/lib/i18n";

describe("underLimit (mémoire)", () => {
  it("bloque au-delà du maximum, puis repart après reset", async () => {
    const key = `test:${Math.random()}`;
    expect(await underLimit(key, 2, 60)).toBe(true);
    expect(await underLimit(key, 2, 60)).toBe(true);
    expect(await underLimit(key, 2, 60)).toBe(false);
    await resetLimit(key);
    expect(await underLimit(key, 2, 60)).toBe(true);
  });
});

describe("safeReturnPath", () => {
  it("garde un chemin local et refuse un autre domaine", () => {
    expect(safeReturnPath("/fr/manifestations", "fr")).toBe("/fr/manifestations");
    expect(safeReturnPath("//evil.example", "fr")).toBe("/fr/profil");
    expect(safeReturnPath("https://evil.example", "en")).toBe("/en/profil");
  });
});

describe("distanceKm", () => {
  it("Paris–Lyon ≈ 392 km", () => {
    expect(distanceKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 })).toBeCloseTo(392, -1);
  });
});

describe("i18n", () => {
  it("construit les chemins localisés", () => {
    expect(localePath("fr", "/")).toBe("/fr");
    expect(countryPath("fr", "FR")).toBe("/fr/pays/france");
  });
  it("accorde le pluriel", () => {
    expect(plural("fr", 1, { one: "# lieu", other: "# lieux" })).toContain("lieu");
  });
});
