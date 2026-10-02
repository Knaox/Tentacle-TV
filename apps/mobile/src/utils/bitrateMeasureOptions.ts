import type { BitrateMeasureOptions } from "@tentacle-tv/api-client";

/**
 * La mesure de débit du mobile, un seul réglage pour tous ses appels (comme la
 * TV) : la voie du média — directe dès qu'elle est ouverte, le proxy sinon —
 * et le `fetch` de React Native, qui ne rend la réponse qu'avec le corps entier
 * (`bufferedFetch`, api-client). Chronométrée comme dans un navigateur, la
 * mesure ne voyait que la conversion du corps : 130 Mb/s sur un lien à 50, et
 * rien du tout sous 3 Mb/s (simulateur iOS, relais bridé) — jamais de plafond.
 */
export const MOBILE_BITRATE_MEASURE: BitrateMeasureOptions = { preferDirect: true, bufferedFetch: true };
