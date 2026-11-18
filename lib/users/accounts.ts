import "server-only";
import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readyRedis } from "@/lib/core/cache";
import { storeDelete, storeGet, storeScan, storeSet } from "@/lib/core/store";

// Comptes des utilisateurs, rattachés à leur adresse e-mail : la connexion par
// mot de passe et la connexion Google d'une même adresse mènent au même compte,
// donc au même profil. Seuls l'e-mail, l'empreinte du mot de passe et les dates
// sont gardés ; le mot de passe lui-même n'est jamais enregistré.

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export type Account = {
  id: string;
  email: string;
  // Absent pour un compte créé par Google, tant qu'aucun mot de passe n'est défini.
  passwordHash: string | null;
  verifiedAt: string | null;
  providers: ("password" | "google")[];
  createdAt: string;
  // Rôle donné par un administrateur (les adresses de ADMIN_EMAILS sont admin d'office).
  role?: "admin" | "moderator" | null;
  // Compte banni : plus de connexion ni d'action, la session en cours est coupée.
  bannedAt?: string | null;
  banReason?: string | null;
};

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

const accountKey = (email: string) => `account:email:${email}`;
const idKey = (id: string) => `account:id:${id}`;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function validPassword(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length >= PASSWORD_MIN && raw.length <= PASSWORD_MAX;
}

// --- Mots de passe (scrypt, sel aléatoire, comparaison à temps constant) ------

const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Empreinte calculée une fois, pour qu'un e-mail inconnu prenne autant de temps
// qu'un mauvais mot de passe : la durée ne révèle pas quels comptes existent.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}

// --- Comptes ------------------------------------------------------------------

export async function getAccountByEmail(email: string): Promise<Account | null> {
  return storeGet<Account>(accountKey(email));
}

export async function getAccountById(id: string): Promise<Account | null> {
  const email = await storeGet<string>(idKey(id));
  return email ? getAccountByEmail(email) : null;
}

async function saveAccount(account: Account): Promise<Account> {
  await storeSet(accountKey(account.email), account);
  await storeSet(idKey(account.id), account.email);
  return account;
}

export async function createPasswordAccount(email: string, password: string): Promise<Account> {
  return saveAccount({
    id: randomUUID(),
    email,
    passwordHash: await hashPassword(password),
    verifiedAt: null,
    providers: ["password"],
    createdAt: new Date().toISOString(),
  });
}

// Google garantit l'adresse : le compte est vérifié d'office. Une adresse déjà
// inscrite par mot de passe est rattachée au même compte.
export async function findOrCreateGoogleAccount(email: string): Promise<Account> {
  const existing = await getAccountByEmail(email);
  if (existing?.verifiedAt) {
    const providers = existing.providers.includes("google") ? existing.providers : [...existing.providers, "google" as const];
    return saveAccount({ ...existing, providers });
  }
  if (existing) {
    // Compte par mot de passe jamais vérifié : n'importe qui a pu le créer avec
    // cette adresse. Son mot de passe est effacé, sinon son auteur garderait
    // l'accès au compte que la vraie propriétaire de l'adresse vient d'ouvrir.
    return saveAccount({ ...existing, passwordHash: null, providers: ["google"], verifiedAt: new Date().toISOString() });
  }
  return saveAccount({
    id: randomUUID(),
    email,
    passwordHash: null,
    verifiedAt: new Date().toISOString(),
    providers: ["google"],
    createdAt: new Date().toISOString(),
  });
}

// Nouvelle inscription sur une adresse jamais vérifiée : le dernier mot de passe
// choisi l'emporte, la vérification de l'e-mail tranchera.
export async function replaceUnverifiedPassword(account: Account, password: string): Promise<Account> {
  return saveAccount({ ...account, passwordHash: await hashPassword(password) });
}

export async function markVerified(account: Account): Promise<Account> {
  return account.verifiedAt ? account : saveAccount({ ...account, verifiedAt: new Date().toISOString() });
}

// Nouveau mot de passe après un lien de réinitialisation : avoir reçu le lien
// prouve aussi la possession de l'adresse.
export async function setPassword(account: Account, password: string): Promise<Account> {
  const providers = account.providers.includes("password") ? account.providers : [...account.providers, "password" as const];
  return saveAccount({
    ...account,
    passwordHash: await hashPassword(password),
    providers,
    verifiedAt: account.verifiedAt ?? new Date().toISOString(),
  });
}

// Changements faits par un administrateur (rôle, bannissement, vérification manuelle).
export async function updateAccount(account: Account, patch: Partial<Pick<Account, "role" | "bannedAt" | "banReason" | "verifiedAt">>): Promise<Account> {
  return saveAccount({ ...account, ...patch });
}

// Tous les comptes, les plus récents d'abord (administration).
export async function listAccounts(): Promise<Account[]> {
  const keys = await storeScan("account:email:");
  const accounts = await Promise.all(keys.map((k) => storeGet<Account>(k)));
  return accounts.filter((a): a is Account => !!a).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteAccount(account: Account): Promise<void> {
  await storeDelete(accountKey(account.email));
  await storeDelete(idKey(account.id));
}

// --- Jetons à usage unique (vérification d'e-mail, réinitialisation) ----------

export type TokenKind = "verify" | "reset";
const TOKEN_TTL: Record<TokenKind, number> = { verify: 24 * 3600, reset: 3600 };

// Seule l'empreinte du jeton est gardée : une fuite de la base ne donne aucun lien valable.
const tokenKey = (kind: TokenKind, token: string) =>
  `auth:${kind}:${createHash("sha256").update(token).digest("hex")}`;

const memoryTokens = new Map<string, { email: string; expiresAt: number }>();

export async function createToken(kind: TokenKind, email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const key = tokenKey(kind, token);
  const redis = await readyRedis();
  if (redis) await redis.set(key, email, "EX", TOKEN_TTL[kind]);
  else memoryTokens.set(key, { email, expiresAt: Date.now() + TOKEN_TTL[kind] * 1000 });
  return token;
}

// Lit et supprime le jeton : un lien ne sert qu'une fois.
export async function consumeToken(kind: TokenKind, token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const key = tokenKey(kind, token);
  const redis = await readyRedis();
  if (redis) return (await redis.getdel(key)) ?? null;
  const entry = memoryTokens.get(key);
  memoryTokens.delete(key);
  return entry && entry.expiresAt > Date.now() ? entry.email : null;
}
