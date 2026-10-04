import crypto from "crypto";
import { jellyfinAdminFetch, type JellyfinResult } from "../jellyfinAdminFetch";
import { invalidateJellyfinUsers } from "../watchTogether/usersCache";
import { guestAccountName } from "../../family/familyRules";
import { FamilyFailure } from "./familyErrors";

/**
 * Le compte Jellyfin d'un invité (docs/FAMILLE.md, SEC-F-29/31), par la clé
 * d'administration du serveur :
 *
 * - un mot de passe FORT et aléatoire, posé à la création puis oublié — jamais
 *   gardé, jamais montré : personne n'y entre par nom et mot de passe ;
 * - caché de l'écran de connexion, jamais administrateur, sans droit de
 *   gestion, de suppression ni de téléchargement ;
 * - les MÊMES bibliothèques et restrictions que le propriétaire (contrôle
 *   parental, tags, horaires), recopiées de sa politique — jamais son
 *   fournisseur d'authentification ;
 * - un nom ASCII reconnaissable par un administrateur (« Lea - invite de
 *   Damien »), départagé au besoin.
 *
 * `POST /Users/{id}/Policy` REMPLACE toute la politique : on part de celle
 * que Jellyfin vient de donner à l'invité, on n'y change que nos champs.
 */

/** Ce que l'invité reçoit du propriétaire : l'accès aux bibliothèques et les restrictions. */
const COPIED_FROM_OWNER = [
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

/** Ce qu'un invité n'a JAMAIS, quoi qu'ait le propriétaire. */
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
export function guestPolicy(current: Policy, owner: Policy): Policy {
  const policy: Policy = { ...current };
  for (const field of COPIED_FROM_OWNER) if (field in owner) policy[field] = owner[field];
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

export async function deleteGuestAccount(userId: string): Promise<void> {
  const result = await jellyfinAdminFetch(`/Users/${encodeURIComponent(userId)}`, { method: "DELETE", expectEmpty: true });
  invalidateJellyfinUsers();
  if (result.ok || (!result.ok && result.status === 404)) return;
  throw unavailable("suppression de l'invité", result);
}

/**
 * Crée le compte d'un invité. Tout échec APRÈS la création supprime le
 * compte : jamais un invité à moitié fait (sans mot de passe, ou visible).
 */
export async function createGuestAccount(input: {
  guestName: string;
  owner: { userId: string; name: string };
  lang: "fr" | "en";
}): Promise<{ userId: string; jellyfinName: string }> {
  const ownerPolicy = (await fetchUser(input.owner.userId)).Policy ?? {};
  let created: UserDto | null = null;
  let jellyfinName = "";
  for (let attempt = 1; attempt <= 5 && !created; attempt++) {
    jellyfinName = guestAccountName(input.guestName, input.owner.name, input.lang, attempt);
    const password = crypto.randomBytes(48).toString("base64url");
    const result = await jellyfinAdminFetch<UserDto>("/Users/New", { method: "POST", body: { Name: jellyfinName, Password: password } });
    if (result.ok && result.data?.Id) created = result.data;
    // 400 : le nom existe déjà — le rang suivant le départage. Tout autre refus arrête.
    else if (result.ok || result.status !== 400) throw unavailable("création de l'invité", result);
  }
  if (!created?.Id) throw new FamilyFailure("family.jellyfin_refused", "Aucun nom de compte libre pour l'invité");
  const userId = created.Id;
  try {
    await scramblePassword(userId);
    await writePolicy(userId, guestPolicy(created.Policy ?? (await fetchUser(userId)).Policy ?? {}, ownerPolicy));
    const check = (await fetchUser(userId)).Policy ?? {};
    if (check.IsAdministrator !== false || check.IsHidden !== true || check.EnableContentDownloading !== false) {
      throw new FamilyFailure("family.jellyfin_refused", "Politique de l'invité non retenue par Jellyfin");
    }
  } catch (error) {
    await deleteGuestAccount(userId).catch(() => undefined);
    throw error;
  }
  invalidateJellyfinUsers();
  return { userId, jellyfinName };
}

/** Recopie au besoin les bibliothèques et restrictions du propriétaire (à
 *  l'ouverture d'une session d'invité). Silencieux : la session reste sûre,
 *  les interdits de l'invité ne dépendent pas de cette recopie. */
export async function syncGuestPolicy(guestUserId: string, ownerUserId: string): Promise<void> {
  try {
    const [guest, owner] = await Promise.all([fetchUser(guestUserId), fetchUser(ownerUserId)]);
    const current = guest.Policy ?? {};
    const wanted = guestPolicy(current, owner.Policy ?? {});
    const changed = Object.keys(wanted).some((key) => JSON.stringify(wanted[key]) !== JSON.stringify(current[key]));
    if (changed) await writePolicy(guestUserId, wanted);
  } catch {
    console.log("[family] politique d'un invité non resynchronisée (Jellyfin muet)");
  }
}
