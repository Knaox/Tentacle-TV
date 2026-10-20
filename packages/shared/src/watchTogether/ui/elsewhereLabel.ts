import type { WtElsewhereDto } from "../../types/watchTogetherDevices";

/**
 * Watch Together — ce que dit l'avis « groupe sur un autre appareil », partout
 * pareil (mobile, web, web étroit) : SON propre groupe (l'hôte est le compte de
 * cet appareil) → « Votre groupe est en cours sur un autre appareil » ; celui
 * d'un autre → « Groupe de X… » ; nom inconnu → la phrase neutre. Clés de
 * l'espace i18n `watchTogether`.
 */
export type WtElsewhereLabel =
  | { key: "elsewhereActiveOwn" }
  | { key: "elsewhereActiveWithHost"; params: { name: string } }
  | { key: "elsewhereActive" };

export function elsewhereLabel(
  elsewhere: Pick<WtElsewhereDto, "hostUsername" | "hostUserId">,
  selfId: string | null,
): WtElsewhereLabel {
  if (selfId && elsewhere.hostUserId === selfId) return { key: "elsewhereActiveOwn" };
  if (elsewhere.hostUsername) return { key: "elsewhereActiveWithHost", params: { name: elsewhere.hostUsername } };
  return { key: "elsewhereActive" };
}
