"use server";

import { auth } from "@/auth";
import { createReport, ReportError, voteReport, type PublicReport, type Vote } from "@/lib/reports";

// Publier ou voter demande d'être connecté (contre le spam), mais le compte n'est
// jamais publié avec le signalement. Les erreurs attendues sont renvoyées comme
// des codes, pour que le navigateur affiche un message traduit.

export type ReportResult<T> = { ok: true; value: T } | { ok: false; error: ReportError["code"] | "signIn" | "consent" };

async function userId(): Promise<string | null> {
  return (await auth())?.user?.id ?? null;
}

async function run<T>(fn: (id: string) => Promise<T>): Promise<ReportResult<T>> {
  const id = await userId();
  if (!id) return { ok: false, error: "signIn" };
  try {
    return { ok: true, value: await fn(id) };
  } catch (err) {
    if (err instanceof ReportError) return { ok: false, error: err.code };
    throw err;
  }
}

export async function publishReport(
  input: {
    kind: string;
    lat: number;
    lng: number;
    crowd: string | null;
    videoUrl: string | null;
  },
  consent: boolean,
): Promise<ReportResult<PublicReport>> {
  // Être présent à une manifestation peut révéler une opinion politique :
  // la publication demande un accord explicite à chaque fois.
  if (consent !== true) return { ok: false, error: "consent" };
  return run((id) => createReport(id, input));
}

export async function voteOnReport(reportId: string, vote: Vote): Promise<ReportResult<PublicReport | null>> {
  if (typeof reportId !== "string" || !/^[0-9a-f-]{36}$/.test(reportId)) return { ok: false, error: "invalid" };
  return run((id) => voteReport(id, reportId, vote));
}
