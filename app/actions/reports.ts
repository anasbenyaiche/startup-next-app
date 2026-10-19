"use server";

import { auth } from "@/auth";
import { createReport, voteReport, type PublicReport, type ReportError, type Vote } from "@/lib/community/reports";
import { runForUser, type ActionResult } from "@/lib/core/action";

// Publier ou voter demande d'être connecté (contre le spam), mais le compte n'est
// jamais publié avec le signalement. Les erreurs attendues sont renvoyées comme
// des codes, pour que le navigateur affiche un message traduit.

export type ReportResult<T> = ActionResult<T, ReportError["code"] | "signIn" | "consent">;

const run = async <T>(fn: (id: string) => Promise<T>): Promise<ReportResult<T>> =>
  runForUser<T, ReportError["code"]>((await auth())?.user?.id, fn);

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
