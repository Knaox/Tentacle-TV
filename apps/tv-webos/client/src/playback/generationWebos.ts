import type { CapacitesTeleviseur } from "../bootstrap/webosGlobals";

/**
 * Quelle génération de téléviseur avons-nous sous les pieds ?
 *
 * Deux chiffres, et il faut les deux — c'est le point que rate tout client qui
 * n'en lit qu'un.
 *
 * La **génération webOS** décrit le logiciel : moteur web, conteneurs acceptés,
 * Opus dans un MKV, Dolby Vision dans un MKV. Elle se lit dans le moteur, donc
 * dans l'agent utilisateur, qui ne peut pas mentir sur lui-même.
 *
 * L'**année du modèle** décrit le matériel : le décodeur AV1 et la licence DTS
 * sont dans la puce, pas dans le firmware. Elle se lit dans `modelName`.
 *
 * Ces deux chiffres ont longtemps été redondants, et ils ont cessé de l'être :
 * le programme « Re:New » de LG pousse webOS 25 sur des téléviseurs de 2022. Un
 * C2 annonce alors Chromium 120 tout en gardant la puce de son année — il gagne
 * le Dolby Vision en MKV et ne gagne ni AV1 ni DTS. Déduire le matériel de la
 * version logicielle, c'est promettre à cette dalle un décodeur qu'elle n'a pas.
 *
 * Le module ne touche à rien : il reçoit `deviceInfo` et l'agent utilisateur, et
 * rend deux nombres. C'est ce qui le rend vérifiable sans téléviseur.
 */

/** Version marketing de webOS TV — celle qui figure dans la documentation LG. */
export type GenerationWebos = 3 | 4 | 5 | 6 | 22 | 23 | 24 | 25 | 26;

export interface PlateformeTv {
  generation: GenerationWebos;
  /** Année du modèle, si `modelName` a pu être décodé. */
  annee: number | null;
  /** D'où vient la génération. Journalisé : un `repli` explique tout le reste. */
  source: "ua" | "sdk" | "repli";
}

/**
 * Génération de repli.
 *
 * webOS 4, et non la plus récente : ce qu'on ne sait pas, on ne le suppose pas
 * acquis. C'est aussi la plus ancienne génération que le client vise (Chromium
 * 53), donc celle dont les capacités sont un sous-ensemble de toutes les autres.
 */
const GENERATION_REPLI: GenerationWebos = 4;

/**
 * Moteur Chromium → version de webOS.
 *
 * LG ne met jamais à jour Chromium au sein d'une version majeure de webOS : le
 * numéro de moteur identifie donc la génération sans ambiguïté. Table publiée
 * par LG (« Web API and Web Engine »), et corroborée par la table équivalente de
 * Moonfin.
 */
const CHROME_VERS_GENERATION: ReadonlyArray<readonly [number, GenerationWebos]> = [
  [132, 26],
  [120, 25],
  [108, 24],
  [94, 23],
  [87, 22],
  [79, 6],
  [68, 5],
  [53, 4],
  [38, 3],
];

/**
 * Année d'une dalle OLED, par le caractère qui suit la lettre de gamme :
 * `OLED55C3PUA` → `3` → 2023.
 *
 * `X` pour 2020 est une irrégularité de LG, qui a sauté le `0` — un `CX` ne
 * s'ordonne pas entre `C9` et `C1`, il faut la table.
 */
const ANNEE_OLED: Readonly<Record<string, number>> = {
  "6": 2016,
  "7": 2017,
  "8": 2018,
  "9": 2019,
  X: 2020,
  "1": 2021,
  "2": 2022,
  "3": 2023,
  "4": 2024,
  "5": 2025,
};

/**
 * Année d'une dalle LCD, par la lettre de millésime : `65UM7400` → `M` → 2019,
 * `65QNED85TA` → `T` → 2024.
 */
const ANNEE_LCD: Readonly<Record<string, number>> = {
  J: 2017,
  K: 2018,
  M: 2019,
  N: 2020,
  P: 2021,
  Q: 2022,
  R: 2023,
  T: 2024,
  A: 2025,
  B: 2026,
};

/**
 * Version de Chromium annoncée par l'agent utilisateur.
 *
 * Deux pièges, tous deux relevés sur des chaînes réelles.
 *
 * `Chr0me` avec un zéro : certains firmwares LG l'écrivent ainsi, et un motif
 * qui n'accepte que `Chrome` renvoie alors le repli sur une dalle parfaitement
 * identifiable. Le `0` est donc admis à la place du `o`.
 *
 * `NetCast` : c'est le navigateur intégré du téléviseur, dont le numéro de
 * Chromium ne décrit PAS le moteur qui exécute l'application. On rend `null`
 * plutôt qu'un chiffre faux — `jellyfin-web` fait le même choix.
 */
export function versionChromium(agent: string): number | null {
  if (/netcast/i.test(agent)) return null;
  const trouve = /chr[o0]me\/(\d+)/i.exec(agent);
  if (!trouve) return null;
  const version = parseInt(trouve[1], 10);
  return Number.isFinite(version) ? version : null;
}

/** Génération correspondant à un numéro de moteur Chromium. */
export function generationDepuisChromium(chromium: number): GenerationWebos | null {
  for (const [seuil, generation] of CHROME_VERS_GENERATION) {
    if (chromium >= seuil) return generation;
  }
  return null;
}

/**
 * Génération lue dans `sdkVersion`, en second recours seulement.
 *
 * Le champ est fiable tant que LG a numéroté ses SDK comme ses versions — de 1 à
 * 6. À partir de webOS 22, la numérotation marketing s'est détachée de la
 * numérotation interne (un téléviseur de 2022 rend `7.x`), et lire `7` y
 * donnerait une génération qui n'existe pas. Au-delà de 6, on préfère donc ne
 * rien conclure et laisser l'agent utilisateur trancher.
 */
export function generationDepuisSdk(sdkVersion: string | undefined): GenerationWebos | null {
  if (!sdkVersion) return null;
  const trouve = /^0*(\d+)\./.exec(sdkVersion.trim());
  if (!trouve) return null;
  const majeure = parseInt(trouve[1], 10);
  if (majeure >= 3 && majeure <= 6) return majeure as GenerationWebos;
  return null;
}

/**
 * Année du modèle, décodée de `modelName`.
 *
 * `null` quand le nom ne se laisse pas lire — un modèle exotique, ou un
 * `deviceInfo` qui n'a rendu que des champs vides. Les capacités matérielles
 * retombent alors sur leur valeur prudente, ce qui coûte au pire un transcodage
 * audio et jamais une image recompressée.
 */
export function anneeDepuisModele(
  modelName: string | undefined,
  generation: GenerationWebos,
): number | null {
  if (!modelName) return null;
  const nom = modelName.toUpperCase();

  const oled = /OLED\d{2}[A-Z]([0-9X])/.exec(nom);
  if (oled) {
    const annee = ANNEE_OLED[oled[1]];
    // `C6` désigne 2016 et redésignera 2026 : la lettre de gamme a fait le tour.
    // La génération départage, elle ne recule jamais — un téléviseur de 2016 ne
    // porte pas webOS 22.
    if (annee === 2016 && generation >= 22) return 2026;
    return annee ?? null;
  }

  // Trois écritures pour la même lettre de millésime, et il faut les trois.
  // `65UM7400` la place avant la série ; `65NANO86TNA` après, sur deux chiffres
  // de série (Amérique) ; `65NANO866NA` après, sur trois (Europe) — d'où la
  // plage `{2,3}`, gourmande, qui s'arrête d'elle-même sur la lettre.
  const lcd = /(?:NANO|QNED)(\d{2,3})([A-Z])|\d{2}U([A-Z])\d/.exec(nom);
  if (lcd) {
    const lettre = lcd[2] ?? lcd[3];
    // Une lettre hors table n'est pas un millésime — `65NANO85UNA` porte un `U`
    // de gamme là où d'autres portent l'année. On ne devine pas.
    return ANNEE_LCD[lettre] ?? null;
  }

  return null;
}

/**
 * Ce que la plateforme dit d'elle-même.
 *
 * L'agent utilisateur d'abord : c'est le moteur qui parle du moteur. `deviceInfo`
 * ensuite, parce que LG le rend incomplet sur des appareils réels — le forum
 * développeur documente des téléviseurs de 2019 et 2022 qui ne rendent que
 * `modelName`, `screenWidth` et `screenHeight`, sans que LG ait reproduit le
 * défaut. Aucune lecture ne doit donc supposer qu'un champ est là.
 */
export function lirePlateforme(dalle: CapacitesTeleviseur, agent: string): PlateformeTv {
  const chromium = versionChromium(agent);
  const parUa = chromium === null ? null : generationDepuisChromium(chromium);
  if (parUa !== null) {
    return { generation: parUa, annee: anneeDepuisModele(dalle.modelName, parUa), source: "ua" };
  }

  const parSdk = generationDepuisSdk(dalle.sdkVersion);
  if (parSdk !== null) {
    return { generation: parSdk, annee: anneeDepuisModele(dalle.modelName, parSdk), source: "sdk" };
  }

  return {
    generation: GENERATION_REPLI,
    annee: anneeDepuisModele(dalle.modelName, GENERATION_REPLI),
    source: "repli",
  };
}
