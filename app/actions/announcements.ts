"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isModerator } from "@/lib/users/admin";
import { ANNOUNCEMENTS_ENABLED } from "@/lib/core/features";
import { runForUser, type ActionResult } from "@/lib/core/action";
import {
  type AnnouncementError,
  deleteAnnouncement,
  flagAnnouncement,
  moderateAnnouncement,
  publishAnnouncement,
  type Announcement,
} from "@/lib/community/announcements";
import type { ComplianceReport } from "@/lib/community/compliance";

// Les erreurs attendues reviennent comme des codes, traduits par le navigateur.
export type AnnouncementResult<T> = ActionResult<T, AnnouncementError["code"] | "signIn" | "consent">;

const run = async <T>(fn: (userId: string) => Promise<T>): Promise<AnnouncementResult<T>> =>
  runForUser<T, AnnouncementError["code"]>((await auth())?.user?.id, fn);

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
  if (!(await isModerator())) return { ok: false, error: "forbidden" };
  if (decision !== "approve" && decision !== "reject") return { ok: false, error: "invalid" };
  const result = await run(() => moderateAnnouncement(String(announcementId), decision).then(() => null));
  revalidatePath("/startup/moderate");
  return result;
}
