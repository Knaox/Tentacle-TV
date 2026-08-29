import type { CapabilitiesTv } from "../bootstrap/webosGlobals";
import type { ConfigsTv } from "./configsTv";

/**
 * Ce que la dalle sait AFFICHER — par opposition à ce que la puce sait décoder,
 * qui est l'affaire de `capabilitiesWebos.ts`.
 *
 * Ce module existe parce que `deviceInfo` ment par omission. Sur un OLED C3 de
 * 2023, LG ne rend que huit champs :
 *
 *     modelName, panelType, platformVersion{,Major,Minor,Dot},
 *     screenWidth, screenHeight
 *
 * Aucun de `uhd`, `hdr10`, `dolbyVision`, `dolbyAtmos`, `oled` n'est là — ceux-là
 * mêmes que la documentation de LG décrit. Le forum développeur en rapporte
 * autant sur des téléviseurs de 2019 et de 2022, signalé et jamais corrigé.
 *
 * **Un champ absent n'est donc pas une réponse négative, c'est une absence de
 * réponse.** Le traiter comme un refus est ce qui coûtait le plus cher : un
 * `dolbyVision` manquant faisait convertir la plage dynamique côté serveur,
 * c'est-à-dire RECOMPRESSER une image 4K entière, sur une dalle qui lit le
 * Dolby Vision nativement depuis dix ans.
 *
 * D'où la doctrine de ce fichier : **on déduit du modèle ce que LG ne déclare
 * pas, et on ne déduit que ce dont la gamme répond**. Un champ explicite garde
 * toujours le dernier mot — la déduction ne sert qu'à combler un trou, jamais à
 * contredire.
 *
 * La déduction ne va que dans un sens, et c'est ce qui la rend sûre : elle
 * ACCORDE ce que toute la gamme possède, elle ne retire rien. Une gamme qu'on
 * ne sait pas lire retombe sur l'ancien comportement, prudent.
 */

export interface PanelTv {
  uhd: boolean;
  uhd8K: boolean;
  hdr10: boolean;
  dolbyVision: boolean;
  dolbyAtmos: boolean;
  oled: boolean;
}

/**
 * Gamme commerciale, seule maille à laquelle LG documente ses dalles.
 *
 * `null` n'est pas une gamme mais un aveu : un modèle qu'on ne sait pas classer
 * ne reçoit aucune déduction. Les Super UHD de 2018 (`65SK8000`, qui ont
 * pourtant le Dolby Vision) tombent ici, et c'est assumé — les reconnaître
 * demanderait une table de préfixes que LG ne publie pas.
 */
export type RangeTv = "oled" | "qned" | "nano" | "uhd" | null;

/**
 * La gamme, lue dans `panelType` d'abord et dans `modelName` ensuite.
 *
 * `panelType` est le seul des champs « capacité » que LG renseigne réellement,
 * et il vaut exactement `"OLED"` sur une dalle OLED. Il était jusqu'ici ignoré
 * par le client, qui interrogeait un `oled` booléen absent — d'où un DTS refusé
 * sur des téléviseurs qui le décodent.
 */
export function rangeFromModel(raw: CapabilitiesTv): RangeTv {
  if (typeof raw.panelType === "string" && raw.panelType.toUpperCase() === "OLED") {
    return "oled";
  }
  const nom = (raw.modelName ?? "").toUpperCase();
  if (nom.startsWith("OLED")) return "oled";
  if (nom.includes("QNED")) return "qned";
  if (nom.includes("NANO")) return "nano";
  // La gamme UHD d'entrée : `50UR78006LK`, `43UQ75006LF` — deux chiffres de
  // diagonale, `U`, la lettre de millésime, puis la série.
  if (/\d{2}U[A-Z]\d/.test(nom)) return "uhd";
  return null;
}

/**
 * Le Dolby Vision, déduit de la gamme.
 *
 * **Toutes les dalles OLED de LG le portent, sans exception, depuis la
 * génération 2016** — c'est un argument de vente de la gamme, pas une option de
 * modèle. Les QNED en héritent à leur naissance en 2021. Les NanoCell et la
 * gamme UHD l'ont reçu en 2019, quand LG l'a généralisé ; les UK de 2018 ne
 * l'ont pas.
 *
 * Le risque d'une déduction fausse est le seul qui vaille d'être pesé : un flux
 * Dolby Vision envoyé en lecture directe à une dalle qui l'ignore donne une
 * image délavée, et non un échec franc. C'est pourquoi on ne l'accorde qu'aux
 * gammes dont la TOTALITÉ des modèles le porte, et jamais sur une année
 * inconnue.
 */
export function dolbyVisionForRange(range: RangeTv, year: number | null): boolean {
  if (range === "oled") return true;
  if (range === "qned") return true;
  if (range === "nano" || range === "uhd") return year !== null && year >= 2019;
  return false;
}

/**
 * Le Dolby Atmos, déduit de la gamme.
 *
 * Il ne décide ici que d'une chose : le nombre de canaux qu'un remux a le droit
 * de porter (`profilWebos.ts → maxChannels`). Se tromper coûte donc un mixage
 * descendant en trop ou en moins, jamais un écran noir — la prudence peut être
 * moindre que pour le Dolby Vision, elle n'a pas à être nulle.
 *
 * Le décodeur Atmos arrive sur les OLED en 2017 : les B6, C6 et E6 de 2016 ne
 * l'ont pas. Les NanoCell l'obtiennent en 2020. **La gamme UHD d'entrée n'en a
 * jamais eu** — elle reçoit du Dolby Digital Plus sans la sous-couche objet, ce
 * qui est précisément ce qu'un profil ne doit pas confondre.
 */
export function dolbyAtmosForRange(range: RangeTv, year: number | null): boolean {
  // La gamme QNED naît en 2021, cinq ans après le décodeur : son seul nom
  // suffit, et une année illisible ne lui retire rien.
  if (range === "qned") return true;
  if (year === null) return false;
  if (range === "oled") return year >= 2017;
  if (range === "nano") return year >= 2020;
  return false;
}

/**
 * Normalise ce que `deviceInfo` a bien voulu rendre, complété par ce que le
 * téléviseur déclare de lui-même, complété par la gamme.
 *
 * L'ordre de résolution est le même pour les six champs, et c'est ce qui rend
 * la fonction relisible : **le champ de `deviceInfo`, sinon le relevé du
 * matériel, sinon la déduction, sinon faux**. Les trois sources vont du plus
 * spécifique au plus général, et chacune ne sert que là où la précédente s'est
 * tue — un `??` et non un `||`, pour qu'un `false` déclaré reste un refus.
 *
 * Le relevé (`configsTv.ts`) est la meilleure des trois quand il répond : il est
 * DÉCLARATIF, lu sur les commutateurs de la carte mère. Il arrive en second
 * plutôt qu'en premier parce qu'un champ explicitement rendu par `deviceInfo`
 * décrit la même chose de plus près, et parce qu'inverser les deux rendrait le
 * comportement dépendant de l'instant où la réponse asynchrone arrive.
 *
 * `uhd` se déduit de la définition de l'écran, parce que c'est cette valeur-là
 * qui gouverne le plafond de débit : la laisser à faux ferait recompresser un
 * fichier 4K sur une dalle 4K.
 *
 * `hdr10` se déduit de `uhd` faute de mieux — LG n'a plus vendu de dalle 4K sans
 * HDR10 depuis 2016, et une dalle FHD n'en a jamais eu. La déduction ne va que
 * dans un sens.
 */
export function inferPanel(
  raw: CapabilitiesTv,
  year: number | null,
  configs: ConfigsTv = {},
): PanelTv {
  const width = raw.screenWidth ?? 0;
  const range = rangeFromModel(raw);
  const uhd = raw.uhd ?? configs.uhd ?? width >= 3840;
  return {
    uhd,
    uhd8K: raw.uhd8K ?? configs.uhd8K ?? width >= 7680,
    hdr10: raw.hdr10 ?? configs.hdr ?? uhd,
    dolbyVision: raw.dolbyVision ?? configs.dolbyVision ?? dolbyVisionForRange(range, year),
    dolbyAtmos: raw.dolbyAtmos ?? configs.dolbyAtmos ?? dolbyAtmosForRange(range, year),
    oled: raw.oled ?? configs.oled ?? range === "oled",
  };
}
