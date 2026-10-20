import { getPrisma } from "../db";
import {
  FAMILY_PICKER_PREFERENCE_PLATFORMS as FAMILY_PICKER_PLATFORMS,
  type FamilyPickerPreferencePlatform as FamilyPickerPlatform,
  type PickerPreferenceDto,
} from "../../family/familyPickerContract";

// Le bureau seul (1.31.1) : le mobile n'a jamais eu cette préférence.
function isPickerPlatform(value: unknown): value is FamilyPickerPlatform {
  return typeof value === "string" && (FAMILY_PICKER_PLATFORMS as readonly string[]).includes(value);
}

/**
 * « Qui regarde ? » au lancement — l'ANCIENNE préférence du COMPTE, par
 * PLATEFORME, gardée pour les bureaux d'avant (routes `pickerPreference`,
 * `setPickerPreference`). Depuis la 1.30.0, plus rien ne décide d'après elle :
 * le bureau décide par APPAREIL, dans le cadre réglé par l'administration
 * (`familyLaunchPolicy.ts`, docs/FAMILLE.md, « À l'ouverture »).
 *
 * Rangée dans `server_config` sous `user_profile_picker_<compte>` — la liste
 * JSON des plateformes où elle est active —, comme les rappels masqués
 * (`preferences.hints.ts`) : aucune table, aucun schéma. Rien d'actif = aucune
 * ligne. Une ligne illisible vaut « rien d'actif » : au pire « Qui regarde ? »
 * ne paraît pas, jamais d'erreur ; une plateforme inconnue (retirée de la liste
 * fermée) est ignorée.
 */

export function pickerPreferenceKey(userId: string): string {
  return `user_profile_picker_${userId.replace(/-/g, "").toLowerCase()}`;
}

function preferenceOf(active: readonly FamilyPickerPlatform[]): PickerPreferenceDto {
  const atLaunch = Object.fromEntries(FAMILY_PICKER_PLATFORMS.map((platform) => [platform, active.includes(platform)]));
  return { atLaunch: atLaunch as Record<FamilyPickerPlatform, boolean> };
}

async function readActive(userId: string): Promise<FamilyPickerPlatform[]> {
  const row = await getPrisma().serverConfig.findUnique({ where: { key: pickerPreferenceKey(userId) } });
  if (!row) return [];
  try {
    const raw: unknown = JSON.parse(row.value);
    return Array.isArray(raw) ? FAMILY_PICKER_PLATFORMS.filter((platform) => raw.some((entry) => isPickerPlatform(entry) && entry === platform)) : [];
  } catch {
    return [];
  }
}

export async function readPickerPreference(userId: string): Promise<PickerPreferenceDto> {
  return preferenceOf(await readActive(userId));
}

/** Active ou coupe « Qui regarde ? » au lancement pour une plateforme du compte. */
export async function writePickerPreference(userId: string, platform: FamilyPickerPlatform, atLaunch: boolean): Promise<PickerPreferenceDto> {
  const current = await readActive(userId);
  const next = FAMILY_PICKER_PLATFORMS.filter((entry) => (entry === platform ? atLaunch : current.includes(entry)));
  const prisma = getPrisma();
  const key = pickerPreferenceKey(userId);
  if (next.length === 0) {
    await prisma.serverConfig.deleteMany({ where: { key } });
  } else {
    const value = JSON.stringify(next);
    await prisma.serverConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  return preferenceOf(next);
}
