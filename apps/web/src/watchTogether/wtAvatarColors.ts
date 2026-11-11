/**
 * Les fonds de l'avatar d'un membre SANS photo (`WtAvatar`) : son initiale s'y écrit en blanc,
 * en petit (13 px dans le fil du chat, 11 px sur la vidéo) — chaque fond tient donc 4,5:1 face
 * au blanc. Les teintes d'avant (violet, rose, indigo en 400-500) n'y arrivaient pas : 2,65 à
 * 4,47:1, mesuré au banc de contraste sur le chat (lot « rf2 »). Mêmes familles, un cran plus
 * profond ; l'ordre est gardé — un membre garde sa teinte.
 *
 * En dur, et non des jetons : l'avatar vit aussi sur la vidéo (chat du lecteur, présence), où
 * le thème clair ne doit rien éclaircir.
 */
export const WT_AVATAR_COLORS = ["#7c3aed", "#db2777", "#4f46e5", "#9333ea", "#be185d", "#6d28d9"] as const;

/** La teinte d'un membre : stable pour un nom donné. */
export function wtAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return WT_AVATAR_COLORS[Math.abs(hash) % WT_AVATAR_COLORS.length];
}
