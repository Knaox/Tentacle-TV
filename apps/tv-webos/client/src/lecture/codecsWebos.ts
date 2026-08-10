import { capacitesTeleviseur } from "../amorce/webosGlobals";
import { capacitesDe, type CapacitesTv, type MaterielTv } from "./capacitesWebos";
import { configsTv } from "./configsTv";
import { deduireDalle, type DalleTv } from "./dalleWebos";
import { lirePlateforme, type PlateformeTv } from "./generationWebos";

/**
 * Ce que le téléviseur sait décoder — et d'où on le tient.
 *
 * Ce module a changé de doctrine, et c'est le cœur du chantier.
 *
 * **Avant**, tout venait de `canPlayType`. C'était le défaut de fond : la sonde
 * ne dit ni oui ni non, elle dit les deux à contretemps. Relevée sur une C3
 * (webOS 23, Chromium 94), elle répond `probably` au HEVC, à l'AC3, au DTS —
 * mais aussi au **profil Dolby Vision 7**, que ce téléviseur ne lit pas — et
 * `""` au MKV qu'il ouvre sans difficulté. Une réponse muette suffisait à vider
 * le profil de ses `DirectPlayProfiles` : tout partait en transcodage. Moonfin
 * l'écrit en tête de son fichier — « canPlayType() is unreliable » — et
 * `jellyfin-web` court-circuite carrément le test par
 * `if (browser.web0s) return true`.
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

export type { DalleTv } from "./dalleWebos";

export interface ProfilResolu {
  plateforme: PlateformeTv;
  capacites: CapacitesTv;
  dalle: DalleTv;
}

/**
 * Le tableau complet des capacités, tel qu'il servira à bâtir le profil.
 *
 * L'ordre des deux premières lignes est une dépendance, pas une convenance :
 * la dalle se déduit de la GAMME et de l'ANNÉE quand `deviceInfo` se tait, et
 * l'année ne se connaît qu'une fois la plateforme lue.
 */
export function resoudreProfil(agent: string = navigator.userAgent): ProfilResolu {
  const brut = capacitesTeleviseur();
  const plateforme = lirePlateforme(brut, agent);
  const dalle = deduireDalle(brut, plateforme.annee, configsTv());
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
 *
 * **`DOVI` nu commande le Dolby Vision côté serveur**, et c'est le fait le moins
 * devinable de ce fichier. Jellyfin ne marque un flux `-tag:v dvh1 -strict -2`
 * — donc n'écrit la boîte `dvcC` sans laquelle aucune dalle ne décode le Dolby
 * Vision — que si ce jeton précis figure dans la condition. Mesuré sur une C3,
 * même fichier, même remux fMP4 :
 *
 *     avec `DOVI` déclaré      videoInfo.hdrType « DolbyVision »
 *     sans (mais DOVIWith…)    videoInfo.hdrType « none »
 *
 * Le manifeste, lui, annonce `SUPPLEMENTAL-CODECS` dans les DEUX cas : il est
 * produit indépendamment du flux, et s'y fier seul induit en erreur. Seul
 * `videooutput/getStatus` départage.
 *
 * `sansDolbyVision` sert les conteneurs où webOS ne démultiplexe PAS le RPU
 * (cf. `contraintes()`). Il retire TOUTES les plages Dolby Vision et non le seul
 * `DOVI` : y laisser les profils 8.x donnait une lecture directe, donc la couche
 * de base HDR10 et rien de plus.
 *
 * Sur une dalle **sans** Dolby Vision, les `DOVIWith…` restent déclarés — ce
 * sont les profils 8.x, dont la couche de base est du HDR10, du HLG ou du SDR
 * ordinaire, qu'un décodeur ignorant le RPU affiche juste et complète. Les
 * taire ferait tone-mapper une image 4K pour rien. `DOVI` nu, lui, n'y est
 * jamais : la couche de base du profil 5 est en IPT-PQ-C2, verdâtre sans
 * décodage Dolby Vision.
 */
export function plagesDynamiquesTv(dalle: DalleTv, sansDolbyVision = false): string[] {
  // `Unknown` et `SDR` sont ce que Jellyfin attribue aux fichiers dont il ne
  // sait rien : les taire ferait transcoder la moitié d'une médiathèque.
  const plages = ["Unknown", "SDR"];
  if (dalle.hdr10) plages.push("HDR10", "HDR10Plus", "HLG");
  if (sansDolbyVision) return plages;

  if (dalle.dolbyVision) plages.push("DOVI");
  plages.push("DOVIWithSDR", "DOVIWithHLG");
  if (dalle.hdr10) plages.push("DOVIWithHDR10", "DOVIWithHDR10Plus");
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
