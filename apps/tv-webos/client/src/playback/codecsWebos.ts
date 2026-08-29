import { readTvCaps } from "../bootstrap/webosGlobals";
import { capabilitiesOf, type CapabilityFlagsTv, type HardwareTv } from "./capabilitiesWebos";
import { configsTv } from "./configsTv";
import { inferPanel, type PanelTv } from "./panelWebos";
import { readPlatform, type PlatformTv } from "./generationWebos";

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
 * **Maintenant**, la table documentée par LG fait autorité (`capabilitiesWebos.ts`),
 * et trois signaux la RESTREIGNENT — jamais ne l'élargissent :
 *
 *   1. la génération webOS, pour le logiciel (`generationWebos.ts`) ;
 *   2. l'année du modèle, pour le matériel — DTS, AV1 ;
 *   3. `deviceInfo`, pour la dalle — 4K, HDR, Dolby Vision.
 *
 * `canPlayType` reste appelé, mais pour le seul journal de diagnostic : c'est
 * une mesure, plus une décision. Le quatrième signal de restriction, le seul
 * qui soit définitif, est un échec de lecture observé — il vit dans
 * `playbackFallback.ts`.
 */

export type { PanelTv } from "./panelWebos";

export interface ResolvedProfile {
  platform: PlatformTv;
  capabilities: CapabilityFlagsTv;
  panel: PanelTv;
}

/**
 * Le tableau complet des capacités, tel qu'il servira à bâtir le profil.
 *
 * L'ordre des deux premières lignes est une dépendance, pas une convenance :
 * la dalle se déduit de la GAMME et de l'ANNÉE quand `deviceInfo` se tait, et
 * l'année ne se connaît qu'une fois la plateforme lue.
 */
export function resolveProfile(agent: string = navigator.userAgent): ResolvedProfile {
  const raw = readTvCaps();
  const platform = readPlatform(raw, agent);
  const panel = inferPanel(raw, platform.year, configsTv());
  const materiel: HardwareTv = {
    year: platform.year,
    oled: panel.oled,
    uhd8K: panel.uhd8K,
  };
  return { platform, capabilities: capabilitiesOf(platform.generation, materiel), panel };
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
 * `containerWithoutRpu` sert les conteneurs où webOS ne démultiplexe PAS le RPU
 * (cf. `constraints()`). Il ne retire que **`DOVI` nu**, et c'est un arbitrage
 * qui a changé.
 *
 * Il retirait autrefois TOUTES les plages Dolby Vision, ce qui privait Jellyfin
 * de lecture directe et le forçait à remuxer chaque MKV pour faire passer le
 * RPU. On y gagnait le Dolby Vision, on y perdait beaucoup : une session ffmpeg
 * par lecture, une playlist de 1,7 Mo, et le défaut de segmentation du serveur —
 * qui annonce des frontières que ffmpeg n'honore pas — bloquant le téléviseur
 * jusqu'à ne plus repartir du tout.
 *
 * Le remux est donc réservé à ce qui l'exige VRAIMENT. Les profils 8.x portent
 * une couche de base HDR10, HLG ou SDR qu'un décodeur ignorant le RPU affiche
 * juste et complète : ils repartent en lecture directe, sans serveur, avec une
 * image HDR10 au lieu du Dolby Vision. Le profil 5, lui, n'a pas ce filet — sa
 * couche de base est en IPT-PQ-C2, verdâtre sans décodage Dolby Vision — donc
 * `DOVI` nu reste tu, et lui seul continue d'être remuxé.
 *
 * Sur webOS 25, la question ne se pose plus : `doviEnMkv` devient vrai, le
 * profil restrictif disparaît, et le Dolby Vision revient en lecture directe.
 *
 * Sur une dalle **sans** Dolby Vision, les `DOVIWith…` restent déclarés pour la
 * même raison : les taire ferait tone-mapper une image 4K pour rien.
 */
export function tvDynamicRanges(panel: PanelTv, containerWithoutRpu = false): string[] {
  // `Unknown` et `SDR` sont ce que Jellyfin attribue aux fichiers dont il ne
  // sait rien : les taire ferait transcoder la moitié d'une médiathèque.
  const ranges = ["Unknown", "SDR"];
  if (panel.hdr10) ranges.push("HDR10", "HDR10Plus", "HLG");

  // `DOVI` nu commande le marquage `dvh1` côté serveur — cf. plus haut. Le
  // déclarer sur un conteneur qui ne transporte pas le RPU donnerait une lecture
  // directe du profil 5 sans ses métadonnées : une image verdâtre.
  if (panel.dolbyVision && !containerWithoutRpu) ranges.push("DOVI");
  ranges.push("DOVIWithSDR", "DOVIWithHLG");
  if (panel.hdr10) ranges.push("DOVIWithHDR10", "DOVIWithHDR10Plus");
  return ranges;
}

/**
 * Ce que `canPlayType` répond — pour le journal, et pour lui seul.
 *
 * Conservé parce que l'écart entre cette réponse et la table est justement la
 * mesure qu'on veut sous les yeux le jour où une dalle se comporte mal : un
 * moteur qui déclare le HEVC alors que la table le refuse, ou l'inverse, est
 * une information. Aucune décision n'en dépend.
 */
export function codecDiagnostics(): Record<string, string> {
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
  const sample: Record<string, string> = {};
  for (const nom of Object.keys(types)) {
    // `canPlayType` rend "", "maybe" ou "probably". La chaîne nue est plus
    // parlante qu'un booléen : « maybe » est la réponse habituelle d'un
    // décodeur matériel qui ne peut garantir un profil précis.
    sample[nom] = sonde.canPlayType(types[nom]) || "non";
  }
  return sample;
}
