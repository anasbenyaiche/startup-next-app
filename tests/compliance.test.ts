import { describe, expect, it } from "vitest";
import { checkAnnouncement, type AnnouncementInput } from "@/lib/community/compliance";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const valid: AnnouncementInput = {
  title: "Marche pour le climat",
  description: "Rassemblement pacifique, départ à 14 h.",
  city: "Paris",
  meetingPoint: "Place de la République",
  organizer: null,
  sourceUrl: null,
  country: "FR",
  lat: 48.867,
  lng: 2.363,
  startsAt: "2026-10-25T14:00:00Z",
  endsAt: "2026-10-25T18:00:00Z",
  declared: true,
};
const codes = (a: Partial<AnnouncementInput>) => checkAnnouncement({ ...valid, ...a }, { now: NOW }).issues.map((i) => i.code);

describe("checkAnnouncement", () => {
  it("accepte une annonce correcte", () => {
    expect(checkAnnouncement(valid, { now: NOW }).status).not.toBe("blocked");
  });

  it("bloque les champs obligatoires manquants", () => {
    const report = checkAnnouncement({ ...valid, city: " ", meetingPoint: "" }, { now: NOW });
    expect(report.status).toBe("blocked");
    expect(report.issues).toContainEqual({ code: "required", level: "block", field: "city" });
  });

  it("refuse une position hors du globe", () => {
    expect(codes({ lat: 120 })).toContain("invalidPosition");
  });

  it("refuse une date passée et une fin avant le début", () => {
    expect(codes({ startsAt: "2026-10-01T10:00:00Z", endsAt: null })).toContain("pastDate");
    expect(codes({ endsAt: "2026-10-25T10:00:00Z" })).toContain("endBeforeStart");
  });

  it("signale les données personnelles", () => {
    expect(codes({ description: "Contact : jean.dupont@example.com" })).toContain("personalData");
  });

  it("refuse un texte trop long", () => {
    expect(codes({ title: "a".repeat(200) })).toContain("tooLong");
  });
});
