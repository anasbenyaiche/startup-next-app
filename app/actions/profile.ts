"use server";

import { revalidatePath } from "next/cache";
import { auth, currentAccount, signOut } from "@/auth";
import { goToSignIn } from "@/app/actions/account";
import { deleteAccount } from "@/lib/users/accounts";
import { ALERT_THRESHOLDS, deleteProfile, getProfile, isCountryCode, saveProfile, type Profile } from "@/lib/users/profile";

// Actions serveur du profil. L'utilisateur est toujours relu depuis la session :
// le navigateur ne peut agir que sur son propre profil.

async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Connexion requise");
  return id;
}

// Envoie vers la page de connexion, qui ramène ensuite à la même vue.
export async function signInToFollow(redirectTo: string) {
  await goToSignIn(redirectTo);
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

// Préférences de seuil : aucune notification n'est envoyée par cette action.
// L'activation nécessite un consentement distinct du simple suivi de lieux.
export async function saveActivityAlertPreferences(input: {
  enabled: boolean;
  minIncidents6h: number;
  consent: boolean;
}): Promise<Profile> {
  const userId = await requireUserId();
  if (!ALERT_THRESHOLDS.includes(input.minIncidents6h as (typeof ALERT_THRESHOLDS)[number])) {
    throw new Error("Seuil d'alerte invalide");
  }
  const profile = await getProfile(userId);
  if (input.enabled && !input.consent && !profile.activityAlerts.consentAt) {
    throw new Error("Consentement explicite requis pour les alertes");
  }
  const consentAt = input.enabled
    ? (profile.activityAlerts.consentAt ?? new Date().toISOString())
    : null;
  const saved = await saveProfile(userId, {
    ...profile,
    activityAlerts: { enabled: Boolean(input.enabled), minIncidents6h: input.minIncidents6h, consentAt },
  });
  revalidatePath("/profil");
  return saved;
}

// Supprime le profil et le compte (adresse e-mail, empreinte du mot de passe),
// puis ferme la session.
export async function deleteMyData() {
  const userId = await requireUserId();
  await deleteProfile(userId);
  const account = await currentAccount();
  if (account) await deleteAccount(account);
  await signOut({ redirect: false });
  revalidatePath("/profil");
}
