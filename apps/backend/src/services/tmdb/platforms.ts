/**
 * Les familles de plateformes de streaming — la source UNIQUE des filtres
 * « selon vos abonnements » (page Recommandations, filtres de bibliothèque
 * web/mobile/TV) et du filtre strict du serveur.
 *
 * Une plateforme n'est pas un id TMDB : Crunchyroll vit sous 283 ET sous
 * 1968 (« Crunchyroll Amazon Channel »), Apple TV+ a été renommé « Apple TV »,
 * « Max » est redevenu « HBO Max », OCS n'existe plus qu'en canal Amazon
 * (685) et l'id historique d'Arte (236) est mort — le vrai est 234. D'où des
 * FAMILLES : des ids frères, et des motifs de nom pour rattraper un canal
 * régional inconnu de la constante ou un renommage TMDB.
 *
 * `ids[0]` est l'id PRINCIPAL : c'est lui que les clients envoient et que le
 * serveur canonise avant d'élargir à la famille. Une famille ne s'affiche que
 * si au moins un de ses ids existe dans la région du serveur (en Suisse, TMDB
 * ne connaît ni ADN ni OCS : elles y sont masquées, c'est la vérité TMDB).
 *
 * MIROIR : ce fichier est reflété OCTET POUR OCTET dans
 * `apps/backend/src/services/tmdb/platforms.ts` — le backend ne dépend pas de
 * `@tentacle-tv/shared` (tsc CommonJS, image Docker sans packages/ ; précédent
 * `playback/segmentTypes.ts`). Toute modification se fait ICI puis se recopie
 * là-bas (`cp packages/shared/src/platforms.ts apps/backend/src/services/tmdb/`) ;
 * `apps/backend/src/playback/sharedMirror.test.ts` échoue au moindre octet
 * d'écart. Le fichier est AUTONOME (aucun import) pour que la copie reste
 * possible.
 */

export interface PlatformFamily {
  /** Clé stable, jamais affichée (« crunchyroll »). */
  key: string;
  /** Nom de marque affiché — pas de traduction, c'est un nom propre. */
  label: string;
  /** Ids TMDB watch-provider de la famille ; `ids[0]` est l'id principal. */
  ids: readonly number[];
  /** Motifs de nom (mots entiers, minuscules) — rattrapage d'un canal ou d'un
   *  renommage TMDB. Comparés sur le nom normalisé (`normalizePlatformName`). */
  namePatterns: readonly string[];
  /** Studios Jellyfin associés — filtre de bibliothèque sans clé TMDB. */
  studioNames: readonly string[];
}

/** Un nom qui porte l'un de ces mots est une boutique (location/achat), jamais
 *  un abonnement : « Apple TV Store » (2), « ARTE Boutique » (2671), « Canal
 *  VOD » (58). Exclu quel que soit le motif. */
export const PLATFORM_NAME_EXCLUDES: readonly string[] = ["store", "boutique", "vod"];

export const PLATFORM_FAMILIES: readonly PlatformFamily[] = [
  {
    key: "netflix",
    label: "Netflix",
    ids: [8, 1796],
    namePatterns: ["netflix"],
    studioNames: ["Netflix"],
  },
  {
    key: "disney",
    label: "Disney+",
    ids: [337],
    namePatterns: ["disney plus"],
    studioNames: ["Disney+", "Disney Plus", "Disney Television Studios"],
  },
  {
    key: "prime",
    label: "Amazon Prime Video",
    ids: [119, 9, 2100],
    namePatterns: ["prime video"],
    studioNames: ["Amazon Studios", "Amazon Prime Video"],
  },
  {
    key: "crunchyroll",
    label: "Crunchyroll",
    ids: [283, 1968],
    namePatterns: ["crunchyroll"],
    studioNames: ["Crunchyroll"],
  },
  {
    key: "appletv",
    label: "Apple TV",
    ids: [350, 2243],
    namePatterns: ["apple tv"],
    studioNames: ["Apple TV+", "Apple Studios", "Apple"],
  },
  {
    key: "paramount",
    label: "Paramount+",
    ids: [531, 582, 1853, 2303],
    namePatterns: ["paramount plus"],
    studioNames: ["Paramount+", "Paramount Plus"],
  },
  {
    key: "max",
    label: "HBO Max",
    ids: [1899, 1825],
    namePatterns: ["hbo max", "max"],
    studioNames: ["Max", "HBO Max", "HBO"],
  },
  {
    key: "adn",
    label: "ADN",
    ids: [415],
    namePatterns: ["animation digital network", "adn"],
    studioNames: ["ADN"],
  },
  {
    key: "ocs",
    label: "OCS",
    ids: [685, 56],
    namePatterns: ["ocs"],
    studioNames: ["OCS"],
  },
  {
    key: "canal",
    label: "Canal+",
    ids: [381, 345],
    namePatterns: ["canal plus"],
    studioNames: ["Canal+", "Canal Plus"],
  },
  {
    key: "arte",
    label: "Arte",
    ids: [234, 236],
    namePatterns: ["arte"],
    studioNames: ["Arte", "ARTE"],
  },
];

/**
 * Le nom TMDB ramené à des mots comparables : sans accents ni casse, `+` lu
 * « plus » (« Canal+ Séries » → « canal plus series »), tout séparateur ramené
 * à une espace.
 */
export function normalizePlatformName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokensOf(name: string): string[] {
  return normalizePlatformName(name).split(" ").filter(Boolean);
}

interface NameMatch {
  /** Index du premier mot du motif dans le nom — la marque précède son canal
   *  (« Paramount Plus Apple TV channel » est du Paramount+, pas de l'Apple TV). */
  at: number;
  /** Longueur du motif en mots — à position égale, le plus précis gagne. */
  len: number;
}

/** La meilleure occurrence d'un motif de la famille dans les mots du nom, ou
 *  null. Un motif doit apparaître en mots ENTIERS et CONTIGUS : « max » ne
 *  reconnaît pas « Cinemax », « ocs » ne reconnaît pas « DOCSVILLE ». */
function matchPosition(family: PlatformFamily, tokens: readonly string[]): NameMatch | null {
  let best: NameMatch | null = null;
  for (const pattern of family.namePatterns) {
    const words = tokensOf(pattern);
    if (words.length === 0) continue;
    for (let at = 0; at + words.length <= tokens.length; at++) {
      let same = true;
      for (let j = 0; j < words.length; j++) {
        if (tokens[at + j] !== words[j]) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      if (!best || at < best.at || (at === best.at && words.length > best.len)) {
        best = { at, len: words.length };
      }
      break;
    }
  }
  return best;
}

function isExcludedName(tokens: readonly string[]): boolean {
  return tokens.some((t) => PLATFORM_NAME_EXCLUDES.includes(t));
}

/** Le nom d'un provider TMDB désigne-t-il cette famille ? */
export function matchesPlatformName(family: PlatformFamily, providerName: string): boolean {
  const tokens = tokensOf(providerName);
  if (isExcludedName(tokens)) return false;
  return matchPosition(family, tokens) !== null;
}

export function familyOfProviderId(id: number): PlatformFamily | undefined {
  return PLATFORM_FAMILIES.find((f) => f.ids.includes(id));
}

/** La famille désignée par un nom de provider : marque la plus tôt dans le
 *  nom, puis motif le plus long, puis ordre de la constante. */
export function familyOfProviderName(providerName: string): PlatformFamily | undefined {
  const tokens = tokensOf(providerName);
  if (isExcludedName(tokens)) return undefined;
  let bestFamily: PlatformFamily | undefined;
  let best: NameMatch | null = null;
  for (const family of PLATFORM_FAMILIES) {
    const match = matchPosition(family, tokens);
    if (!match) continue;
    if (!best || match.at < best.at || (match.at === best.at && match.len > best.len)) {
      best = match;
      bestFamily = family;
    }
  }
  return bestFamily;
}

/** L'id d'abord (vérité de la constante), le nom en repli (canal inconnu). */
export function familyOfProvider(provider: { id: number; name: string }): PlatformFamily | undefined {
  return familyOfProviderId(provider.id) ?? familyOfProviderName(provider.name);
}

function uniqueSorted(ids: Iterable<number>): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

/** Les ids demandés PLUS leurs frères de famille (283 → 283, 1968). */
export function expandFamilyIds(ids: readonly number[]): number[] {
  const out: number[] = [];
  for (const id of ids) {
    const family = familyOfProviderId(id);
    if (family) out.push(...family.ids);
    else out.push(id);
  }
  return uniqueSorted(out);
}

/** Chaque id ramené à l'id PRINCIPAL de sa famille (1968 → 283) ; un id hors
 *  famille reste lui-même. Deux sélections équivalentes donnent la même clé. */
export function canonicalFamilyIds(ids: readonly number[]): number[] {
  return uniqueSorted(ids.map((id) => familyOfProviderId(id)?.ids[0] ?? id));
}

export interface PlatformFamilyPresence {
  family: PlatformFamily;
  /** Les ids de la famille présents dans la région, ids de la constante
   *  d'abord (dans son ordre), puis ceux rattrapés par le nom. */
  regionalIds: number[];
  logoPath: string | null;
}

/**
 * Les familles PRÉSENTES dans une région, avec leur logo. Chaque provider
 * régional est rattaché à UNE famille au plus (id d'abord, nom sinon) : le
 * canal « Paramount Plus Apple TV channel » compte pour Paramount+, jamais
 * pour Apple TV. Logo : celui de l'id principal (la carte `logos` le garde
 * même hors région), sinon celui d'un id régional, sinon celui que le
 * provider régional porte lui-même.
 */
export function resolvePlatformFamilies(
  regional: ReadonlyArray<{ id: number; name: string; logoPath: string | null }>,
  logos: Readonly<Record<number, string>>
): PlatformFamilyPresence[] {
  const idsByFamily = new Map<string, number[]>();
  const regionalById = new Map<number, { id: number; name: string; logoPath: string | null }>();
  for (const provider of regional) {
    regionalById.set(provider.id, provider);
    const family = familyOfProvider(provider);
    if (!family) continue;
    const bucket = idsByFamily.get(family.key);
    if (bucket) bucket.push(provider.id);
    else idsByFamily.set(family.key, [provider.id]);
  }
  const out: PlatformFamilyPresence[] = [];
  for (const family of PLATFORM_FAMILIES) {
    const found = idsByFamily.get(family.key);
    if (!found || found.length === 0) continue;
    const regionalIds = [
      ...family.ids.filter((id) => found.includes(id)),
      ...found.filter((id) => !family.ids.includes(id)),
    ];
    let logoPath: string | null = logos[family.ids[0]] ?? null;
    for (const id of regionalIds) {
      if (logoPath) break;
      logoPath = logos[id] ?? regionalById.get(id)?.logoPath ?? null;
    }
    out.push({ family, regionalIds, logoPath });
  }
  return out;
}

/** Forme historique `{ id, name, studioNames }` des filtres de bibliothèque
 *  (web, mobile, TV) : l'id est l'id PRINCIPAL de la famille. */
export const PLATFORMS: ReadonlyArray<{
  id: number;
  name: string;
  studioNames: readonly string[];
}> = PLATFORM_FAMILIES.map((f) => ({ id: f.ids[0], name: f.label, studioNames: f.studioNames }));
