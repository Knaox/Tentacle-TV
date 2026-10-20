/**
 * « Reproposer le code PIN et la photo » (serveur 1.30.0, `family.promptsReset`)
 * — ce qu'un APPAREIL en fait. Le premier passage d'un profil retient « Plus
 * tard » sur l'appareil (TV : `tentacle_tv_pin_setup`, et partout
 * `tentacle_avatar_invite_seen`) ; le serveur garde seulement la date de la
 * dernière demande (`promptsResetAt`, rendue dans les profils).
 *
 * L'appareil retient, par profil, la dernière demande qu'il a HONORÉE
 * (`PROMPTS_RESET_SEEN_KEY`). Une demande plus récente : il oublie ses
 * « Plus tard » pour ce profil, une fois, puis retient la demande — les
 * étapes reviennent, et « Plus tard » vaut de nouveau. On compare deux dates
 * du SERVEUR, jamais l'horloge de l'appareil : aucun décalage ne fausse rien.
 * Qui revient vraiment reste l'affaire de chaque étape (un code ou une photo
 * qui manque toujours, jamais l'étape du code pour un invité ni pour le compte
 * de démonstration).
 *
 * Un serveur d'avant ne rend pas la date : rien ne change, l'appareil garde
 * ses « Plus tard ». Module pur, stockage injecté.
 */

/** `{ [userId]: ISO }` — la dernière demande honorée sur cet appareil. ⚠️ Clé stockée : ne pas renommer. */
export const PROMPTS_RESET_SEEN_KEY = "tentacle_prompts_reset_seen";

/** On ne garde que les profils récents. */
const KEEP = 20;

export interface PromptsResetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function timeOf(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value === "") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/** Une demande du serveur que l'appareil n'a pas encore honorée ? */
export function promptsResetDue(resetAt: string | null | undefined, seenAt: string | null | undefined): boolean {
  const reset = timeOf(resetAt);
  if (reset === null) return false;
  const seen = timeOf(seenAt);
  return seen === null || reset > seen;
}

/** Les demandes honorées ; une valeur absente ou abîmée vaut « aucune ». */
export function parsePromptsResetSeen(raw: string | null | undefined): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const seen: Record<string, string> = {};
    for (const [userId, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (userId && typeof at === "string") seen[userId] = at;
    }
    return seen;
  } catch {
    return {};
  }
}

/** Les demandes honorées après celle-ci : la plus récente en tête, une poignée gardée. */
export function withPromptsResetSeen(seen: Readonly<Record<string, string>>, userId: string, resetAt: string): Record<string, string> {
  const others = Object.entries(seen).filter(([id]) => id !== userId).slice(0, KEEP - 1);
  return Object.fromEntries([[userId, resetAt], ...others]);
}

/**
 * Honore la demande du serveur pour ce profil, s'il y en a une nouvelle :
 * `forget` efface ses « Plus tard » sur cet appareil (chaque client sait
 * lesquels), puis la demande est retenue. Rend vrai si quelque chose a été
 * oublié. Un stockage refusé : rien, sans casse — la demande sera honorée
 * à la prochaine ouverture.
 */
export function honorPromptsReset(
  storage: PromptsResetStorage,
  userId: string | null | undefined,
  resetAt: string | null | undefined,
  forget: (userId: string) => void,
): boolean {
  if (!userId || resetAt == null) return false;
  try {
    const seen = parsePromptsResetSeen(storage.getItem(PROMPTS_RESET_SEEN_KEY));
    if (!promptsResetDue(resetAt, seen[userId])) return false;
    forget(userId);
    storage.setItem(PROMPTS_RESET_SEEN_KEY, JSON.stringify(withPromptsResetSeen(seen, userId, resetAt)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Une demande du serveur attend-elle encore d'être honorée sur cet appareil ?
 * Le premier lancement ne décide rien tant qu'elle attend : décidé dans le même
 * rendu que l'oubli, il se figerait sur les « Plus tard » d'avant, et rien ne
 * serait reproposé avant l'ouverture suivante.
 */
export function promptsResetPending(
  storage: Pick<PromptsResetStorage, "getItem">,
  userId: string | null | undefined,
  resetAt: string | null | undefined,
): boolean {
  if (!userId || resetAt == null) return false;
  try {
    return promptsResetDue(resetAt, parsePromptsResetSeen(storage.getItem(PROMPTS_RESET_SEEN_KEY))[userId]);
  } catch {
    return false;
  }
}
