"use server";

import { revalidatePath } from "next/cache";
import { isModerator } from "@/lib/admin";
import { addCurfew, CurfewError, deleteCurfew } from "@/lib/curfews";

// Saisie des couvre-feux : réservée aux modérateurs et administrateurs (lib/admin.ts).
export type CurfewResult = { ok: true } | { ok: false; error: "forbidden" | "invalid"; field?: string };

export async function createCurfew(input: Record<string, unknown>): Promise<CurfewResult> {
  if (!(await isModerator())) return { ok: false, error: "forbidden" };
  try {
    await addCurfew(input);
  } catch (err) {
    if (err instanceof CurfewError) return { ok: false, error: "invalid", field: err.field };
    throw err;
  }
  revalidatePath("/couvre-feu");
  return { ok: true };
}

export async function removeCurfew(id: string): Promise<CurfewResult> {
  if (!(await isModerator())) return { ok: false, error: "forbidden" };
  await deleteCurfew(String(id));
  revalidatePath("/couvre-feu");
  return { ok: true };
}
