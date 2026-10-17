"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn } from "@/auth";
import { deleteProfile, getProfile, isCountryCode, saveProfile, type Profile } from "@/lib/profile";

// Actions serveur du profil. L'utilisateur est toujours relu depuis la session :
// le navigateur ne peut agir que sur son propre profil.

async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Connexion requise");
  return id;
}

export async function signInToFollow(redirectTo: string) {
  // N'accepte qu'un chemin local, pour ne pas servir de redirection ouverte.
  await signIn("github", { redirectTo: redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/" });
}

export async function toggleFollowCountry(country: string): Promise<Profile> {
  const userId = await requireUserId();
  if (!isCountryCode(country)) throw new Error("Pays inconnu");
  const profile = await getProfile(userId);
  const followed = profile.followedCountries.includes(country)
    ? profile.followedCountries.filter((c) => c !== country)
    : [...profile.followedCountries, country];
  const saved = await saveProfile(userId, { ...profile, followedCountries: followed });
  revalidatePath("/profil");
  return saved;
}

export async function toggleFollowPlace(place: { key: string; label: string; country: string }): Promise<Profile> {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  const followed = profile.followedPlaces.some((p) => p.key === place.key)
    ? profile.followedPlaces.filter((p) => p.key !== place.key)
    : [...profile.followedPlaces, place];
  const saved = await saveProfile(userId, { ...profile, followedPlaces: followed });
  revalidatePath("/profil");
  return saved;
}

export async function savePreferences(prefs: Pick<Profile, "defaultHours" | "defaultCountry" | "cityOnly" | "multiSource">) {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  const saved = await saveProfile(userId, { ...profile, ...prefs });
  revalidatePath("/profil");
  revalidatePath("/manifestations");
  return saved;
}

export async function deleteMyData() {
  const userId = await requireUserId();
  await deleteProfile(userId);
  revalidatePath("/profil");
}
