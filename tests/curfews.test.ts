import { describe, expect, it } from "vitest";
import { CurfewError, curfewStatus, parseCurfew, type Curfew } from "@/lib/community/curfews";

const base: Curfew = {
  id: "c1",
  country: "FR",
  region: "Île-de-France",
  area: null,
  dailyStart: "21:00",
  dailyEnd: "06:00",
  startsOn: "2026-10-20",
  endsOn: "2026-10-22",
  timezone: "Europe/Paris",
  authority: "Préfecture",
  sourceUrl: "https://example.gouv.fr/arrete",
  notes: null,
  createdAt: "2026-10-19T00:00:00Z",
};
// Paris est en UTC+2 en octobre 2026.
const at = (iso: string) => new Date(iso);

describe("curfewStatus", () => {
  it("annonce le premier soir avant qu'il commence", () => {
    expect(curfewStatus(base, at("2026-10-19T12:00:00Z"))).toEqual({ kind: "upcoming", from: "21:00", on: "2026-10-20" });
  });
  it("est « ce soir » dans la journée", () => {
    expect(curfewStatus(base, at("2026-10-20T10:00:00Z"))).toEqual({ kind: "tonight", from: "21:00" });
  });
  it("est actif le soir et passe minuit", () => {
    expect(curfewStatus(base, at("2026-10-20T20:00:00Z")).kind).toBe("active");
    expect(curfewStatus(base, at("2026-10-21T02:00:00Z")).kind).toBe("active");
  });
  it("couvre le matin qui suit le dernier soir, puis se termine", () => {
    expect(curfewStatus(base, at("2026-10-23T02:00:00Z")).kind).toBe("active");
    expect(curfewStatus(base, at("2026-10-23T10:00:00Z")).kind).toBe("ended");
  });
});

describe("parseCurfew", () => {
  const raw = { ...base } as Record<string, unknown>;
  it("accepte une saisie valide", () => {
    expect(parseCurfew(raw).region).toBe("Île-de-France");
  });
  it("exige une source officielle en https", () => {
    expect(() => parseCurfew({ ...raw, sourceUrl: "http://example.org" })).toThrow(CurfewError);
  });
  it("refuse un fuseau inconnu et une fin avant le début", () => {
    expect(() => parseCurfew({ ...raw, timezone: "Mars/Olympus" })).toThrow(CurfewError);
    expect(() => parseCurfew({ ...raw, endsOn: "2026-10-01" })).toThrow(CurfewError);
  });
});
