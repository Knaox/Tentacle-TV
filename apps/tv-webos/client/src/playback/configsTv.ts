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
const KEYS = {
  dolbyVision: "tv.model.supportDolbyVisionHDR",
  dolbyAtmos: "tv.config.supportDolbyTVATMOS",
  hdr: "tv.model.supportHDR",
  panel: "tv.hw.displayType",
  eightK: "tv.hw.bSupport_8K_resolution",
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

let sample: ConfigsTv = {};
let started = false;

/** Le relevé, tel qu'il est à cet instant. Vide tant que la réponse n'est pas là. */
export function configsTv(): ConfigsTv {
  return sample;
}

/** Remet le module à zéro. Réservé aux tests. */
export function resetTvConfigs(): void {
  sample = {};
  started = false;
}

/**
 * Traduit la réponse du service.
 *
 * Exporté pour être testé sans téléviseur : c'est ici que vit le piège du
 * `displayType`, et une table de correspondance qui se vérifie mieux sur des
 * valeurs relevées que sur une dalle.
 */
export function readConfigs(configs: Record<string, unknown>): ConfigsTv {
  const result: ConfigsTv = {};

  const boolean = (key: string): boolean | undefined =>
    typeof configs[key] === "boolean" ? (configs[key] as boolean) : undefined;

  const dolbyVision = boolean(KEYS.dolbyVision);
  if (dolbyVision !== undefined) result.dolbyVision = dolbyVision;

  const atmos = boolean(KEYS.dolbyAtmos);
  if (atmos !== undefined) result.dolbyAtmos = atmos;

  const hdr = boolean(KEYS.hdr);
  if (hdr !== undefined) result.hdr = hdr;

  const panel = configs[KEYS.panel];
  if (typeof panel === "string") result.oled = panel.toUpperCase().indexOf("OLED") !== -1;

  const eightK = boolean(KEYS.eightK);
  if (eightK !== undefined) result.uhd8K = eightK;

  // `UD` est le nom que LG donne à l'ultra-définition dans ses configurations —
  // pas `UHD`, ni `4K`. `FHD` et `HD` désignent les dalles qui n'y arrivent pas.
  const definition = configs[KEYS.definition];
  if (typeof definition === "string") {
    const value = definition.toUpperCase();
    if (value === "UD" || value === "UHD" || value === "8K") result.uhd = true;
    else if (value === "FHD" || value === "HD") result.uhd = false;
  }
  // Une dalle 8K est 4K par construction ; la déclarer évite de dépendre de
  // l'ordre dans lequel les deux clés sont renseignées.
  if (result.uhd8K) result.uhd = true;

  return result;
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
export function startConfigCapture(): void {
  if (started) return;
  started = true;

  // `typeof` et non un accès direct : hors navigateur — un test, un rendu
  // serveur — `window` n'est pas une variable indéfinie mais une référence
  // inexistante, et l'atteindre lève avant d'entrer dans le `try`.
  if (typeof window === "undefined") return;

  const bridge = window.PalmServiceBridge;
  if (typeof bridge !== "function") return;

  try {
    const service = new bridge();
    service.onservicecallback = (response: string) => {
      try {
        const loaded = JSON.parse(response) as { configs?: Record<string, unknown> };
        if (loaded && loaded.configs) sample = readConfigs(loaded.configs);
      } catch {
        // Une réponse illisible laisse le relevé vide, donc la déduction en place.
      }
    };
    service.call(
      "luna://com.webos.service.config/getConfigs",
      JSON.stringify({ configNames: Object.values(KEYS) }),
    );
  } catch {
    // Le pont existe mais refuse l'appel : rien à faire, la déduction suffit.
  }
}
