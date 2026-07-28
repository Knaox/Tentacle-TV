/**
 * L'état de la couche Metal de mpv, tel que mpv lui-même le rapporte.
 *
 * # Pourquoi cette mémoire existe
 *
 * ⚠️ L'EDR accordé par le compositeur (`macosEdr.ts`) est une valeur INSTANTANÉE
 * qui dépend de l'image affichée : une scène de nuit ne réclame aucune haute
 * lumière et retombe à 1,00, sur une lecture parfaitement HDR. Mesuré sur le
 * même film, à quelques minutes d'intervalle : 1,00 puis 12,82.
 *
 * S'en servir seul fait donc annoncer « signal pq vers un écran SDR » pendant
 * qu'une couche `ITUR_2100_PQ` est active — le diagnostic accuse alors l'écran
 * d'un défaut qui n'existe pas, et l'on cherche pendant des heures ce qui va
 * très bien. C'est exactement le piège que ce projet a déjà payé deux fois :
 * conclure sur une mesure qui ne mesure pas ce qu'on croit.
 *
 * mpv, lui, sait : il trace « Metal layer HDR active » quand sa couche passe en
 * plage étendue, et « inactive » quand elle en sort. C'est le RENDU qui parle,
 * pas un tiers qui devine.
 *
 * ⚠️ Alimenté par les messages de journal de mpv, qui ne sont demandés qu'en
 * développement — d'où `null` pour « on ne sait pas », que l'appelant doit
 * traiter comme tel et surtout pas comme « non ».
 */

/** `null` tant que mpv n'a rien dit de sa couche. */
let enHdr: boolean | null = null;
/** Espace colorimétrique rapporté par mpv, pour l'afficher tel quel. */
let espace: string | null = null;

const ACTIVE = /Metal layer HDR active/i;
const INACTIVE = /Metal layer HDR inactive/i;
const ESPACE = /Metal layer colorspace changed:\s*(\S+)/i;

/** Retient ce qu'un message de journal de mpv dit de la couche Metal. */
export function retenirJournal(texte: string): void {
  if (ACTIVE.test(texte)) enHdr = true;
  else if (INACTIVE.test(texte)) enHdr = false;
  const m = ESPACE.exec(texte);
  if (m?.[1] !== undefined) espace = m[1];
}

/** La couche Metal est-elle en plage étendue ? `null` si mpv n'a rien dit. */
export function coucheEnHdr(): boolean | null {
  return enHdr;
}

/** Espace colorimétrique de la couche, tel que mpv le nomme. */
export function espaceCouche(): string | null {
  return espace;
}

/** Oublie tout — entre deux instances mpv, la couche est recréée. */
export function oublierCouche(): void {
  enHdr = null;
  espace = null;
}
