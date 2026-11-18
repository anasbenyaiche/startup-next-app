import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core/cache", () => ({ readyRedis: vi.fn(async () => null) }));
import { storeGet, storeSet } from "@/lib/core/store";

afterEach(() => vi.unstubAllEnvs());

describe("stockage des comptes", () => {
  it("autorise un mode mémoire pendant les tests", async () => {
    vi.stubEnv("NODE_ENV", "test");
    await storeSet("test:storage:development", { ok: true });
    expect(await storeGet("test:storage:development")).toEqual({ ok: true });
  });

  it("refuse une fausse écriture durable sans Redis en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(storeSet("test:storage:production", { ok: true })).rejects.toThrow("Stockage durable indisponible");
    await expect(storeGet("test:storage:production")).rejects.toThrow("Stockage durable indisponible");
  });
});
