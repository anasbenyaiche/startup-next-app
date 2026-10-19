import { FIPS_TO_ISO } from "./countries";
import { PERIODS, parsePlaceKey } from "./api-params";
import { storeDelete, storeGet, storeSet } from "./store";

// Profil privé d'un utilisateur connecté : ce qu'il suit et comment il aime
// ouvrir la carte. Ces choix peuvent révéler des opinions politiques (données
// sensibles au sens du RGPD) : ils ne sont ni publiés, ni utilisés pour la publicité.

export type FollowedPlace = { key: string; label: string; country: string };

export type Profile = {
  followedCountries: string[];
  followedPlaces: FollowedPlace[];
  defaultHours: number;
  defaultCountry: string | null;
  cityOnly: boolean;
  multiSource: boolean;
  // Date du consentement explicite à l'enregistrement des suivis (article 9 du RGPD),
  // demandé au premier suivi ; null tant qu'il n'a pas été donné.
  followsConsentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const MAX_FOLLOWED = 30;

const keyOf = (userId: string) => `user:${userId}:profile`;

export function emptyProfile(): Profile {
  const now = new Date().toISOString();
  return {
    followedCountries: [],
    followedPlaces: [],
    defaultHours: 24,
    defaultCountry: null,
    cityOnly: false,
    multiSource: false,
    followsConsentAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function isCountryCode(code: unknown): code is string {
  return typeof code === "string" && code in FIPS_TO_ISO;
}

export async function getProfile(userId: string): Promise<Profile> {
  return { ...emptyProfile(), ...((await storeGet<Profile>(keyOf(userId))) ?? {}) };
}

export async function saveProfile(userId: string, profile: Profile): Promise<Profile> {
  // Tout ce qui est enregistré est revalidé : les valeurs viennent du navigateur.
  const clean: Profile = {
    followedCountries: [...new Set(profile.followedCountries.filter(isCountryCode))].slice(0, MAX_FOLLOWED),
    followedPlaces: profile.followedPlaces
      .filter((p) => parsePlaceKey(p.key) && isCountryCode(p.country))
      .map((p) => ({ key: p.key, country: p.country, label: String(p.label).slice(0, 120) }))
      .filter((p, i, all) => all.findIndex((q) => q.key === p.key) === i)
      .slice(0, MAX_FOLLOWED),
    defaultHours: (PERIODS as readonly number[]).includes(profile.defaultHours) ? profile.defaultHours : 24,
    defaultCountry: isCountryCode(profile.defaultCountry) ? profile.defaultCountry : null,
    cityOnly: Boolean(profile.cityOnly),
    multiSource: Boolean(profile.multiSource),
    followsConsentAt: typeof profile.followsConsentAt === "string" ? profile.followsConsentAt : null,
    createdAt: profile.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await storeSet(keyOf(userId), clean);
  return clean;
}

export async function deleteProfile(userId: string): Promise<void> {
  await storeDelete(keyOf(userId));
}
