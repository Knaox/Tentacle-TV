import { getPrisma } from "./db";

// La langue d'un texte POUSSÉ. Un push s'affiche tel quel sur le téléphone et
// le serveur n'a pas la locale de l'appareil : on compose dans la langue
// d'interface que l'utilisateur a choisie côté serveur (`server_config` →
// `user_lang_<id>`, cf. routes/preferences.ts), français par défaut.

export type PushLang = "fr" | "en";

export function normalizePushLang(raw: string | null | undefined): PushLang {
  return raw?.trim().toLowerCase().startsWith("en") ? "en" : "fr";
}

/** La langue de chaque utilisateur du lot ; absent de la table = français. */
export async function loadPushLangs(userIds: string[]): Promise<Map<string, PushLang>> {
  if (userIds.length === 0) return new Map();
  const prefix = "user_lang_";
  const rows = await getPrisma().serverConfig.findMany({
    where: { key: { in: userIds.map((id) => `${prefix}${id}`) } },
  });
  return new Map(rows.map((r) => [r.key.slice(prefix.length), normalizePushLang(r.value)]));
}
