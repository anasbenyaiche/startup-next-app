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

// Un nouveau suivi n'est enregistré qu'avec le consentement explicite de la personne
// (les suivis peuvent révéler des opinions politiques). Retirer un suivi n'en demande pas.
function withConsent(profile: Profile, adding: boolean, consent: boolean): Profile {
  if (!adding || profile.followsConsentAt) return profile;
  if (!consent) throw new Error("Consentement requis pour enregistrer un suivi");
  return { ...profile, followsConsentAt: new Date().toISOString() };
}

export async function toggleFollowCountry(country: string, consent = false): Promise<Profile> {
  const userId = await requireUserId();
  if (!isCountryCode(country)) throw new Error("Pays inconnu");
  const profile = await getProfile(userId);
  const adding = !profile.followedCountries.includes(country);
  const followed = adding
    ? [...profile.followedCountries, country]
    : profile.followedCountries.filter((c) => c !== country);
  const saved = await saveProfile(userId, { ...withConsent(profile, adding, consent), followedCountries: followed });
  revalidatePath("/profil");
  return saved;
}

export async function toggleFollowPlace(
  place: { key: string; label: string; country: string },
  consent = false,
): Promise<Profile> {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  const adding = !profile.followedPlaces.some((p) => p.key === place.key);
  const followed = adding ? [...profile.followedPlaces, place] : profile.followedPlaces.filter((p) => p.key !== place.key);
  const saved = await saveProfile(userId, { ...withConsent(profile, adding, consent), followedPlaces: followed });
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
