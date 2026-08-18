/**
 * Ce que le téléviseur dit de LUI-MÊME, interrogé au service de configuration.
 *
 * `deviceInfo` ment par omission — c'est tout le propos de `panelWebos.ts`, qui
 * comble ses trous en déduisant de la gamme. Cette source-ci est meilleure :
 * elle est **déclarative**. Le service `com.webos.service.config` expose les
 * commutateurs de la carte mère, et il répond à une application ordinaire, sans
 * permission déclarée dans `appinfo.json` — contrairement à
 * `com.webos.settingsservice`, qui rend « Access denied ».
 *
 * Relevé sur un OLED C3 de 2023, alors que `deviceInfo` ne rendait aucun de ces
 * booléens :
 *
 *     tv.model.supportDolbyVisionHDR  true
 *     tv.config.supportDolbyTVATMOS   true
 *     tv.model.supportHDR             true
 *     tv.hw.displayType               "OLED"
 *     tv.hw.panelResolution           "UD"
 *     tv.hw.bSupport_8K_resolution    false
 *
 * **Ne jamais lire `tv.model.displayType`** : il vaut `"LCD DISPLAY"` sur cette
 * dalle OLED. Seul `tv.hw.displayType` dit vrai. Les deux existent, l'un est un
 * champ de nomenclature laissé à sa valeur par défaut, l'autre décrit le
 * matériel — et rien dans leur nom ne le signale.
 *
 * Le pont est `PalmServiceBridge`, injecté par le gestionnaire d'applications et
 * disponible y compris après la navigation vers le serveur — ce qui n'allait pas
 * de soi, la page étant alors servie en HTTP depuis une autre origine que la
 * coquille. `webOSTV.js` ferait le même travail, mais la politique de sécurité
 * de la variante interdit de le charger.
 *
 * Le relevé est **asynchrone et facultatif**. Rien ne l'attend : il remplit un
 * cache, et `panelWebos.ts` s'en sert s'il est là. Un téléviseur qui ne connaît
 * aucune de ces clés — une génération ancienne, un modèle exotique — retombe sur
 * la déduction par gamme, qui est le comportement d'avant.
 */

/** Les seules clés qu'on lise, et ce qu'elles gouvernent. */
const CLES = {
  dolbyVision: "tv.model.supportDolbyVisionHDR",
  dolbyAtmos: "tv.config.supportDolbyTVATMOS",
  hdr: "tv.model.supportHDR",
  dalle: "tv.hw.displayType",
  huitK: "tv.hw.bSupport_8K_resolution",
  definition: "tv.hw.panelResolution",
} as const;

/**
 * Ce que le relevé a pu établir. **Une propriété absente n'est pas `false`** :
 * c'est une clé que ce téléviseur ne connaît pas, et la distinction est toute
 * la valeur de ce module — elle laisse la déduction reprendre la main.
 */
export interface ConfigsTv {
  dolbyVision?: boolean;
  dolbyAtmos?: boolean;
  hdr?: boolean;
  oled?: boolean;
  uhd?: boolean;
  uhd8K?: boolean;
}

let releve: ConfigsTv = {};
let demarre = false;

/** Le relevé, tel qu'il est à cet instant. Vide tant que la réponse n'est pas là. */
export function configsTv(): ConfigsTv {
  return releve;
}

/** Remet le module à zéro. Réservé aux tests. */
export function reinitialiserConfigsTv(): void {
  releve = {};
  demarre = false;
}

/**
 * Traduit la réponse du service.
 *
 * Exporté pour être testé sans téléviseur : c'est ici que vit le piège du
 * `displayType`, et une table de correspondance qui se vérifie mieux sur des
 * valeurs relevées que sur une dalle.
 */
export function lireConfigs(configs: Record<string, unknown>): ConfigsTv {
  const lu: ConfigsTv = {};

  const booleen = (cle: string): boolean | undefined =>
    typeof configs[cle] === "boolean" ? (configs[cle] as boolean) : undefined;

  const dolbyVision = booleen(CLES.dolbyVision);
  if (dolbyVision !== undefined) lu.dolbyVision = dolbyVision;

  const atmos = booleen(CLES.dolbyAtmos);
  if (atmos !== undefined) lu.dolbyAtmos = atmos;

  const hdr = booleen(CLES.hdr);
  if (hdr !== undefined) lu.hdr = hdr;

  const dalle = configs[CLES.dalle];
  if (typeof dalle === "string") lu.oled = dalle.toUpperCase().indexOf("OLED") !== -1;

  const huitK = booleen(CLES.huitK);
  if (huitK !== undefined) lu.uhd8K = huitK;

  // `UD` est le nom que LG donne à l'ultra-définition dans ses configurations —
  // pas `UHD`, ni `4K`. `FHD` et `HD` désignent les dalles qui n'y arrivent pas.
  const definition = configs[CLES.definition];
  if (typeof definition === "string") {
    const valeur = definition.toUpperCase();
    if (valeur === "UD" || valeur === "UHD" || valeur === "8K") lu.uhd = true;
    else if (valeur === "FHD" || valeur === "HD") lu.uhd = false;
  }
  // Une dalle 8K est 4K par construction ; la déclarer évite de dépendre de
  // l'ordre dans lequel les deux clés sont renseignées.
  if (lu.uhd8K) lu.uhd = true;

  return lu;
}

/**
 * Lance le relevé. Sans effet hors d'un téléviseur, et sans effet deux fois.
 *
 * À appeler au démarrage : le profil d'appareil n'est construit qu'à la
 * première négociation de lecture, donc bien après — l'utilisateur a un écran
 * à parcourir et un média à choisir. Si la course se perdait malgré tout, la
 * déduction par gamme rendrait la même réponse sur les modèles qu'elle sait
 * lire ; c'est un repli, pas un échec.
 */
export function demarrerReleveConfigs(): void {
  if (demarre) return;
  demarre = true;

  // `typeof` et non un accès direct : hors navigateur — un test, un rendu
  // serveur — `window` n'est pas une variable indéfinie mais une référence
  // inexistante, et l'atteindre lève avant d'entrer dans le `try`.
  if (typeof window === "undefined") return;

  const pont = window.PalmServiceBridge;
  if (typeof pont !== "function") return;

  try {
    const appel = new pont();
    appel.onservicecallback = (reponse: string) => {
      try {
        const charge = JSON.parse(reponse) as { configs?: Record<string, unknown> };
        if (charge && charge.configs) releve = lireConfigs(charge.configs);
      } catch {
        // Une réponse illisible laisse le relevé vide, donc la déduction en place.
      }
    };
    appel.call(
      "luna://com.webos.service.config/getConfigs",
      JSON.stringify({ configNames: Object.values(CLES) }),
    );
  } catch {
    // Le pont existe mais refuse l'appel : rien à faire, la déduction suffit.
  }
}
