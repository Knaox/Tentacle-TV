import { capacitesTeleviseur, type CapacitesTeleviseur } from "../amorce/webosGlobals";
import { capacitesDe, type CapacitesTv, type MaterielTv } from "./capacitesWebos";
import { lirePlateforme, type PlateformeTv } from "./generationWebos";

/**
 * Ce que le téléviseur sait décoder — et d'où on le tient.
 *
 * Ce module a changé de doctrine, et c'est le cœur du chantier.
 *
 * **Avant**, tout venait de `canPlayType`. C'était le défaut de fond : sur
 * webOS, le moteur Chromium décrit ce que Chromium sait faire, pas ce que la
 * puce de la dalle sait faire. Il répond `""` pour le HEVC, l'AC3, le DTS et le
 * MKV que le téléviseur ouvre sans difficulté. Moonfin l'écrit en tête de son
 * fichier — « canPlayType() is unreliable » — et `jellyfin-web` court-circuite
 * carrément le test par `if (browser.web0s) return true`. Chez nous, une sonde
 * muette vidait le profil de ses `DirectPlayProfiles` : tout partait en
 * transcodage.
 *
 * **Maintenant**, la table documentée par LG fait autorité (`capacitesWebos.ts`),
 * et trois signaux la RESTREIGNENT — jamais ne l'élargissent :
 *
 *   1. la génération webOS, pour le logiciel (`generationWebos.ts`) ;
 *   2. l'année du modèle, pour le matériel — DTS, AV1 ;
 *   3. `deviceInfo`, pour la dalle — 4K, HDR, Dolby Vision.
 *
 * `canPlayType` reste appelé, mais pour le seul journal de diagnostic : c'est
 * une mesure, plus une décision. Le quatrième signal de restriction, le seul
 * qui soit définitif, est un échec de lecture observé — il vit dans
 * `repliLecture.ts`.
 */

export interface DalleTv {
  uhd: boolean;
  uhd8K: boolean;
  hdr10: boolean;
  dolbyVision: boolean;
  dolbyAtmos: boolean;
  oled: boolean;
}

export interface ProfilResolu {
  plateforme: PlateformeTv;
  capacites: CapacitesTv;
  dalle: DalleTv;
}

/**
 * Normalise ce que `deviceInfo` a bien voulu rendre.
 *
 * Aucun champ n'est supposé présent : le forum développeur de LG documente des
 * téléviseurs de 2019 et de 2022 qui ne renvoient que `modelName`,
 * `screenWidth` et `screenHeight` — signalé, non reproduit par LG, jamais
 * corrigé. Toute lecture doit donc survivre à l'absence.
 *
 * `uhd` se déduit de la définition de l'écran quand le champ manque, parce que
 * c'est cette valeur-là qui gouverne le plafond de débit : la laisser à faux
 * ferait recompresser un fichier 4K sur une dalle 4K.
 */
export function lireDalle(brut: CapacitesTeleviseur): DalleTv {
  const largeur = brut.screenWidth ?? 0;
  const uhd = brut.uhd ?? largeur >= 3840;
  return {
    uhd,
    uhd8K: brut.uhd8K ?? largeur >= 7680,
    // Le HDR10 se déduit de la définition faute de mieux, et c'est un choix
    // mesuré. LG n'a plus vendu de dalle 4K sans HDR10 depuis 2016 ; refuser le
    // HDR par précaution ferait convertir la plage dynamique côté serveur, donc
    // RECOMPRESSER toute l'image — exactement ce que ce chantier supprime. Une
    // dalle FHD, elle, n'a jamais de HDR : la déduction ne va que dans un sens.
    hdr10: brut.hdr10 ?? uhd,
    // Le Dolby Vision, lui, reste strictement déclaré. Il dépend du modèle et
    // non de la définition, et aucune corrélation ne le remplace.
    dolbyVision: brut.dolbyVision === true,
    dolbyAtmos: brut.dolbyAtmos === true,
    oled: brut.oled === true,
  };
}

/** Le tableau complet des capacités, tel qu'il servira à bâtir le profil. */
export function resoudreProfil(agent: string = navigator.userAgent): ProfilResolu {
  const brut = capacitesTeleviseur();
  const plateforme = lirePlateforme(brut, agent);
  const dalle = lireDalle(brut);
  const materiel: MaterielTv = {
    annee: plateforme.annee,
    oled: dalle.oled,
    uhd8K: dalle.uhd8K,
  };
  return { plateforme, capacites: capacitesDe(plateforme.generation, materiel), dalle };
}

/**
 * Plages dynamiques déclarées à Jellyfin.
 *
 * C'est la condition décisive du profil : c'est elle, et non les
 * `TranscodeReasons`, qui évite au serveur de convertir le HDR en SDR — une
 * conversion qui recompresse l'image entière.
 *
 * `HDR10Plus` est déclaré avec le HDR10 bien que LG ne l'ait jamais supporté,
 * y compris sur les gammes 2025. Ce n'est pas une erreur : un flux HDR10+ porte
 * une couche de base HDR10 que le téléviseur lit correctement. Le déclarer, c'est
 * obtenir la lecture directe et une image HDR10 juste ; le taire, c'est
 * déclencher un ré-encodage 4K pour un résultat visuellement identique.
 *
 * `DOVIWithEL` et `DOVIWithELHDR10Plus` — le Dolby Vision profil 7, à deux
 * couches — ne sont JAMAIS déclarés : aucun téléviseur LG ne les lit, et
 * Jellyfin retombe alors sur la couche de base HDR10.
 */
export function plagesDynamiquesTv(dalle: DalleTv): string[] {
  // `Unknown` et `SDR` sont ce que Jellyfin attribue aux fichiers dont il ne
  // sait rien : les taire ferait transcoder la moitié d'une médiathèque.
  const plages = ["Unknown", "SDR"];
  if (dalle.hdr10) plages.push("HDR10", "HDR10Plus", "HLG");
  if (dalle.dolbyVision) {
    plages.push("DOVI", "DOVIWithHDR10", "DOVIWithHLG", "DOVIWithSDR");
    if (dalle.hdr10) plages.push("DOVIWithHDR10Plus");
  }
  return plages;
}

/**
 * Ce que `canPlayType` répond — pour le journal, et pour lui seul.
 *
 * Conservé parce que l'écart entre cette réponse et la table est justement la
 * mesure qu'on veut sous les yeux le jour où une dalle se comporte mal : un
 * moteur qui déclare le HEVC alors que la table le refuse, ou l'inverse, est
 * une information. Aucune décision n'en dépend.
 */
export function diagnosticCodecs(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const sonde = document.createElement("video");
  const types: Record<string, string> = {
    h264: 'video/mp4; codecs="avc1.640029"',
    hevc: 'video/mp4; codecs="hvc1.1.6.L120.B0"',
    hevc10: 'video/mp4; codecs="hvc1.2.4.L120.B0"',
    vp9: 'video/webm; codecs="vp9"',
    av1: 'video/mp4; codecs="av01.0.15M.10"',
    ac3: 'audio/mp4; codecs="ac-3"',
    eac3: 'audio/mp4; codecs="ec-3"',
    dts: 'audio/mp4; codecs="dtsc"',
  };
  const releve: Record<string, string> = {};
  for (const nom of Object.keys(types)) {
    // `canPlayType` rend "", "maybe" ou "probably". La chaîne nue est plus
    // parlante qu'un booléen : « maybe » est la réponse habituelle d'un
    // décodeur matériel qui ne peut garantir un profil précis.
    releve[nom] = sonde.canPlayType(types[nom]) || "non";
  }
  return releve;
}
