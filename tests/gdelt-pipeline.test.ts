import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cache: new Map<string, unknown>(),
  downloadSlot: vi.fn(),
  latestSlot: vi.fn(),
}));

vi.mock("@/lib/core/cache", () => ({
  cacheGet: vi.fn(async (key: string) => mocks.cache.get(key) ?? null),
  cacheSet: vi.fn(async (key: string, value: unknown) => { mocks.cache.set(key, value); }),
  cacheHashSet: vi.fn(async () => undefined),
  cacheHashGet: vi.fn(async () => null),
}));

vi.mock("@/lib/news/gdelt", () => ({
  downloadSlot: mocks.downloadSlot,
  latestSlot: mocks.latestSlot,
  slotStamp: (date: Date) => date.toISOString().replace(/\D/g, "").slice(0, 12) + "00",
}));

const { getManifestations } = await import("@/lib/news/manifestations");

describe("GDELT — état des créneaux", () => {
  beforeEach(() => {
    mocks.cache.clear();
    mocks.downloadSlot.mockReset();
    mocks.latestSlot.mockReset();
    mocks.latestSlot.mockResolvedValue(new Date());
  });

  it("un créneau non publié (404) ne constitue pas un agrégat complet", async () => {
    mocks.downloadSlot.mockResolvedValue({ events: [], complete: false });
    const result = await getManifestations(6, 40_000);
    expect(result.partial).toBe(true);
    expect(result.filesFailed).toBe(24);
    expect([...mocks.cache.keys()].some((key) => key.includes(":agg:"))).toBe(false);
  });

  it("un agrégat complet n'est enregistré que si tous les créneaux existent", async () => {
    mocks.downloadSlot.mockResolvedValue({ events: [], complete: true });
    const result = await getManifestations(6, 40_000);
    expect(result.partial).toBe(false);
    expect(result.filesFailed).toBe(0);
    expect([...mocks.cache.keys()].some((key) => key.includes(":agg:6:last"))).toBe(true);
  });

  it("réutilise un agrégat récent lorsque la source tombe", async () => {
    const updatedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    mocks.cache.set("gdelt:v3:agg:6:last", {
      updatedAt, hours: 6, places: [], filesFetched: 24, filesFailed: 0,
      totalReports: 0, slotsLoaded: 24, slotsTotal: 24, partial: false,
    });
    mocks.latestSlot.mockRejectedValue(new Error("HTTP 503"));
    const result = await getManifestations(6);
    expect(result.stale).toBe(true);
    expect(result.updatedAt).toBe(updatedAt);
  });

  it("ne montre pas comme actuelles des données vieilles de plus de six heures", async () => {
    mocks.cache.set("gdelt:v3:agg:6:last", {
      updatedAt: new Date(Date.now() - 7 * 3600_000).toISOString(), hours: 6, places: [], partial: false,
    });
    mocks.latestSlot.mockRejectedValue(new Error("HTTP 503"));
    await expect(getManifestations(6)).rejects.toThrow("HTTP 503");
  });
});
