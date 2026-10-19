"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { ANNOUNCEMENTS_ENABLED } from "@/lib/features";
import {
  AnnouncementError,
  deleteAnnouncement,
  flagAnnouncement,
  moderateAnnouncement,
  publishAnnouncement,
  type Announcement,
} from "@/lib/announcements";
import type { ComplianceReport } from "@/lib/compliance";

// Les erreurs attendues reviennent comme des codes, traduits par le navigateur.
export type AnnouncementResult<T> = { ok: true; value: T } | { ok: false; error: AnnouncementError["code"] | "signIn" | "consent" };

async function run<T>(fn: (userId: string) => Promise<T>): Promise<AnnouncementResult<T>> {
  const id = (await auth())?.user?.id;
  if (!id) return { ok: false, error: "signIn" };
  try {
    return { ok: true, value: await fn(id) };
  } catch (err) {
    if (err instanceof AnnouncementError) return { ok: false, error: err.code };
    throw err;
  }
}

export async function publish(
  input: Record<string, unknown>,
  consent: boolean,
): Promise<AnnouncementResult<{ announcement: Announcement | null; report: ComplianceReport }>> {
  // L'annonce est publique (sans le compte de l'auteur) : accord explicite à chaque fois.
  if (!ANNOUNCEMENTS_ENABLED) return { ok: false, error: "forbidden" };
  if (consent !== true) return { ok: false, error: "consent" };
  const result = await run((id) => publishAnnouncement(id, input));
  if (result.ok && result.value.announcement) revalidatePath("/startup/create");
  return result;
}

export async function removeMine(announcementId: string): Promise<AnnouncementResult<null>> {
  const result = await run((id) => deleteAnnouncement(id, String(announcementId)).then(() => null));
  revalidatePath("/startup/create");
  return result;
}

export async function flag(announcementId: string): Promise<AnnouncementResult<Announcement>> {
  return run((id) => flagAnnouncement(id, String(announcementId)));
}

export async function moderate(announcementId: string, decision: "approve" | "reject"): Promise<AnnouncementResult<null>> {
  if (!(await isAdmin())) return { ok: false, error: "forbidden" };
  if (decision !== "approve" && decision !== "reject") return { ok: false, error: "invalid" };
  const result = await run(() => moderateAnnouncement(String(announcementId), decision).then(() => null));
  revalidatePath("/startup/moderation");
  return result;
}
