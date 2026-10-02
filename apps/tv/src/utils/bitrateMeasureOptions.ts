import type { BitrateMeasureOptions } from "@tentacle-tv/api-client";

/**
 * La mesure de débit de la TV, un seul réglage pour tous ses appels : la voie
 * du média (directe dès qu'elle est ouverte), et le `fetch` de React Native,
 * qui ne rend la réponse qu'avec le corps entier (`bufferedFetch`, api-client)
 * — chronométrée comme dans un navigateur, la mesure ne voyait que la
 * conversion du corps, pas le réseau.
 */
export const TV_BITRATE_MEASURE: BitrateMeasureOptions = { preferDirect: true, bufferedFetch: true };
