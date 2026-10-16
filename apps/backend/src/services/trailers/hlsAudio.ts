/* ------------------------------------------------------------------ */
/*  L'audio d'un maître relayé : UNE langue, jamais un doublage par IA */
/*                                                                     */
/*  YouTube met toutes ses pistes dans le maître, chacune              */
/*  `AUTOSELECT=YES` : chaque lecteur choisirait celle de la langue de */
/*  l'appareil. Le relais tranche à sa place (`audioTracks.ts`) : il ne*/
/*  garde, groupe par groupe, que la piste choisie — un doublage humain */
/*  dans la langue du serveur, sinon l'originale — marquée par défaut. */
/*  Les doublages automatiques et l'audiodescription disparaissent,    */
/*  même quand rien d'autre n'est marqué. Une variante muxée (clients  */
/*  web, formats 91 à 96) suit la même règle par sa propre piste.      */
/*  Module pur.                                                        */
/* ------------------------------------------------------------------ */

import {
  chooseAudio, inventoryTags, isUnplayableAudio, withInventory,
  type AudioChoice, type AudioInventory, type AudioTag,
} from "./audioTracks";

/** Ce dont la sélection a besoin : la langue du serveur, et l'inventaire de l'extraction (pistes marquées par langue seule). */
export interface MasterAudioContext {
  serverLang?: string | null;
  inventory?: AudioInventory;
}

interface Rendition { group: string; line: string; tag: AudioTag }
interface Variant { audioGroup?: string; audioTag?: AudioTag }

const matches = (tag: AudioTag | undefined, choice: AudioChoice) => tag?.content === choice.content && tag.lang === choice.lang;

/** La ligne `#EXT-X-MEDIA` marquée comme LA piste du groupe. */
function asDefault(line: string): string {
  const withDefault = /,DEFAULT=(YES|NO)/.test(line) ? line.replace(/,DEFAULT=(YES|NO)/, ",DEFAULT=YES") : `${line},DEFAULT=YES`;
  return /,AUTOSELECT=(YES|NO)/.test(withDefault) ? withDefault.replace(/,AUTOSELECT=(YES|NO)/, ",AUTOSELECT=YES") : `${withDefault},AUTOSELECT=YES`;
}

/**
 * Ne garde que l'audio à jouer. Rendu : les pistes gardées (une par groupe
 * quand un choix existe, marquée par défaut), les variantes dont l'audio
 * existe encore, et le choix. Aucune variante gardée : la vidéo n'a rien de
 * jouable sans doublage automatique.
 */
export function selectMasterAudio<R extends Rendition, V extends Variant>(
  renditions: readonly R[], variants: readonly V[], context: MasterAudioContext = {},
): { audio: R[]; variants: V[]; choice: AudioChoice | null } {
  const tagged = renditions.map((r) => ({ r, tag: withInventory(r.tag, context.inventory) }));
  const variantTag = (v: V) => (v.audioTag ? withInventory(v.audioTag, context.inventory) : undefined);
  const choice = chooseAudio([
    ...tagged.map((t) => t.tag),
    ...variants.map(variantTag).filter((t): t is AudioTag => !!t),
    ...inventoryTags(context.inventory),
  ], context.serverLang);

  const audio: R[] = [];
  for (const group of new Set(renditions.map((r) => r.group))) {
    const inGroup = tagged.filter((t) => t.r.group === group && !isUnplayableAudio(t.tag));
    const chosen = choice ? inGroup.filter((t) => matches(t.tag, choice)) : [];
    if (chosen.length) audio.push(...chosen.slice(0, 1).map((t) => ({ ...t.r, line: asDefault(t.r.line) })));
    else audio.push(...inGroup.map((t) => t.r));
  }
  const groupsWithAudio = new Set(audio.map((a) => a.group));
  const groupsDeclared = new Set(renditions.map((r) => r.group));

  const kept = variants.filter((v) => {
    const tag = variantTag(v);
    if (tag && isUnplayableAudio(tag)) return false;
    if (tag && choice && tag.content !== "unknown" && !matches(tag, choice)) return false;
    if (tag && choice && tag.content === "unknown" && tag.lang && tag.lang !== choice.lang) return false;
    // Une variante dont le groupe audio n'a plus de piste jouable ne se lit plus.
    return !v.audioGroup || !groupsDeclared.has(v.audioGroup) || groupsWithAudio.has(v.audioGroup);
  });
  return { audio, variants: kept, choice };
}
