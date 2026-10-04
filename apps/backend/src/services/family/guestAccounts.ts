import crypto from "crypto";
import { jellyfinAdminFetch, type JellyfinResult } from "../jellyfinAdminFetch";
import { invalidateJellyfinUsers } from "../watchTogether/usersCache";
import { guestAccountName } from "../../family/familyRules";
import { FamilyFailure } from "./familyErrors";
import { abandonGuestAccount, noteGuestAccount } from "./guestAccountCleanup";

/**
 * Le compte Jellyfin d'un invité (docs/FAMILLE.md, SEC-F-29/31), par la clé
 * d'administration du serveur :
 *
 * - un mot de passe FORT et aléatoire, posé à la création puis oublié — jamais
 *   gardé, jamais montré : personne n'y entre par nom et mot de passe ;
 * - caché de l'écran de connexion, jamais administrateur, sans droit de
 *   gestion, de suppression ni de téléchargement ;
 * - les MÊMES bibliothèques et restrictions que son CRÉATEUR (contrôle
 *   parental, tags, horaires), recopiées de sa politique — jamais son
 *   fournisseur d'authentification. Le créateur, c'est le propriétaire, ou
 *   le membre qui l'a créé (v2) : un membre n'ouvre jamais, par un invité,
 *   les bibliothèques du propriétaire ;
 * - un nom ASCII reconnaissable par un administrateur (« Lea - invite de
 *   Damien »), départagé au besoin.
 *
 * `POST /Users/{id}/Policy` REMPLACE toute la politique : on part de celle
 * que Jellyfin vient de donner à l'invité, on n'y change que nos champs.
 *
 * Un compte d'invité ne se supprime QUE par le journal durable
 * (`guestAccountCleanup.ts`) : jamais un « au mieux » qu'un Jellyfin muet
 * laisserait derrière lui.
 */

/** Ce que l'invité reçoit de son créateur : l'accès aux bibliothèques et les restrictions. */
const COPIED_FROM_CREATOR = [
  "EnableAllFolders",
  "EnabledFolders",
  "EnableAllChannels",
  "EnabledChannels",
  "BlockedMediaFolders",
  "BlockedChannels",
  "MaxParentalRating",
  "MaxParentalSubRating",
  "BlockUnratedItems",
  "BlockedTags",
  "AllowedTags",
  "AccessSchedules",
  "EnableLiveTvAccess",
  "EnableRemoteAccess",
  "RemoteClientBitrateLimit",
  "EnableMediaPlayback",
  "EnableAudioPlaybackTranscoding",
  "EnableVideoPlaybackTranscoding",
  "EnablePlaybackRemuxing",
  "ForceRemoteSourceTranscoding",
] as const;

/** Ce qu'un invité n'a JAMAIS, quoi qu'ait son créateur. */
const FORCED: Record<string, unknown> = {
  IsAdministrator: false,
  IsHidden: true,
  IsDisabled: false,
  EnableContentDeletion: false,
  EnableContentDeletionFromFolders: [],
  EnableContentDownloading: false,
  EnableSyncTranscoding: false,
  EnableMediaConversion: false,
  EnableCollectionManagement: false,
  EnableSubtitleManagement: false,
  EnableLyricManagement: false,
  EnableLiveTvManagement: false,
  EnableRemoteControlOfOtherUsers: false,
  EnableSharedDeviceControl: false,
  EnablePublicSharing: false,
  SyncPlayAccess: "None",
};

type Policy = Record<string, unknown>;

interface UserDto {
  Id?: string;
  Name?: string;
  Policy?: Policy;
}

function unavailable(step: string, result: JellyfinResult<unknown>): FamilyFailure {
  if (!result.ok && (result.failure === "unreachable" || result.failure === "not-configured")) {
    return new FamilyFailure("family.jellyfin_unavailable", `Jellyfin injoignable (${step})`);
  }
  return new FamilyFailure("family.jellyfin_refused", `Jellyfin a refusé : ${step}`);
}

/** La politique de l'invité : la sienne, les bibliothèques et restrictions du propriétaire, nos interdits. */
export function guestPolicy(current: Policy, creator: Policy): Policy {
  const policy: Policy = { ...current };
  for (const field of COPIED_FROM_CREATOR) if (field in creator) policy[field] = creator[field];
  return { ...policy, ...FORCED };
}

async function fetchUser(userId: string): Promise<UserDto> {
  const result = await jellyfinAdminFetch<UserDto>(`/Users/${encodeURIComponent(userId)}`);
  if (!result.ok) throw unavailable("lecture du compte", result);
  return result.data;
}

async function writePolicy(userId: string, policy: Policy): Promise<void> {
  const result = await jellyfinAdminFetch(`/Users/${encodeURIComponent(userId)}/Policy`, {
    method: "POST",
    body: policy,
    expectEmpty: true,
  });
  if (!result.ok) throw unavailable("politique de l'invité", result);
}

/** Pose un mot de passe neuf, puis l'oublie. Deux formes de route selon la version de Jellyfin. */
async function scramblePassword(userId: string): Promise<void> {
  const body = { NewPw: crypto.randomBytes(48).toString("base64url"), ResetPassword: false };
  const modern = await jellyfinAdminFetch(`/Users/Password?userId=${encodeURIComponent(userId)}`, { method: "POST", body, expectEmpty: true });
  if (modern.ok) return;
  const legacy = await jellyfinAdminFetch(`/Users/${encodeURIComponent(userId)}/Password`, { method: "POST", body, expectEmpty: true });
  if (!legacy.ok) throw unavailable("mot de passe de l'invité", legacy);
}

/**
 * Crée le compte d'un invité. Dès que Jellyfin l'a créé, le compte entre au
 * journal (`creating`) : un plantage ne laisse pas d'orphelin. Tout échec
 * APRÈS la création supprime le compte, durablement : jamais un invité à
 * moitié fait (sans mot de passe, ou visible). L'appelant solde l'entrée
 * quand la ligne de l'invité existe (`settleCreatedGuest`).
 */
export async function createGuestAccount(input: {
  guestName: string;
  /** Le créateur : la source de la politique, et le nom (« … - invite de Léa »). */
  creator: { userId: string; name: string };
  lang: "fr" | "en";
}): Promise<{ userId: string; jellyfinName: string }> {
  const creatorPolicy = (await fetchUser(input.creator.userId)).Policy ?? {};
  let created: UserDto | null = null;
  let jellyfinName = "";
  for (let attempt = 1; attempt <= 5 && !created; attempt++) {
    jellyfinName = guestAccountName(input.guestName, input.creator.name, input.lang, attempt);
    const password = crypto.randomBytes(48).toString("base64url");
    const result = await jellyfinAdminFetch<UserDto>("/Users/New", { method: "POST", body: { Name: jellyfinName, Password: password } });
    if (result.ok && result.data?.Id) created = result.data;
    // 400 : le nom existe déjà — le rang suivant le départage. Tout autre refus arrête.
    else if (result.ok || result.status !== 400) throw unavailable("création de l'invité", result);
  }
  if (!created?.Id) throw new FamilyFailure("family.jellyfin_refused", "Aucun nom de compte libre pour l'invité");
  const userId = created.Id;
  try {
    await noteGuestAccount(userId, jellyfinName, "creating");
    await scramblePassword(userId);
    await writePolicy(userId, guestPolicy(created.Policy ?? (await fetchUser(userId)).Policy ?? {}, creatorPolicy));
    const check = (await fetchUser(userId)).Policy ?? {};
    if (check.IsAdministrator !== false || check.IsHidden !== true || check.EnableContentDownloading !== false) {
      throw new FamilyFailure("family.jellyfin_refused", "Politique de l'invité non retenue par Jellyfin");
    }
  } catch (error) {
    await abandonGuestAccount(userId, jellyfinName);
    throw error;
  }
  invalidateJellyfinUsers();
  return { userId, jellyfinName };
}

/** Recopie au besoin les bibliothèques et restrictions de son créateur (à
 *  l'ouverture d'une session d'invité). Silencieux : la session reste sûre,
 *  les interdits de l'invité ne dépendent pas de cette recopie. */
export async function syncGuestPolicy(guestUserId: string, creatorUserId: string): Promise<void> {
  try {
    const [guest, creator] = await Promise.all([fetchUser(guestUserId), fetchUser(creatorUserId)]);
    const current = guest.Policy ?? {};
    const wanted = guestPolicy(current, creator.Policy ?? {});
    const changed = Object.keys(wanted).some((key) => JSON.stringify(wanted[key]) !== JSON.stringify(current[key]));
    if (changed) await writePolicy(guestUserId, wanted);
  } catch {
    console.log("[family] politique d'un invité non resynchronisée (Jellyfin muet)");
  }
}
