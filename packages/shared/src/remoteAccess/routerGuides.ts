/**
 * Les guides des box, pour la redirection de ports — DONNÉES seulement, toutes
 * relevées sur les pages officielles des opérateurs le 2026-10-06. Rien n'est
 * écrit de mémoire : ce qui n'a pas pu être confirmé vaut `null`.
 *
 * - `guide` : la page officielle par langue. `stepByStep` faux : l'opérateur
 *   ne publie pas de pas-à-pas, c'est la meilleure page officielle approchante.
 * - `menuPaths` : le chemin des menus TEL QUE la page l'écrit, dans sa langue
 *   (ce sont les mots de la box, pas ceux de Tentacle).
 * - `sharedIpv4` : l'opérateur partage l'IPv4 (CGNAT, DS-Lite) sur certaines
 *   offres — aucune redirection n'y fera rien sans le remède.
 *
 * Les phrases d'accompagnement vivent dans l'espace i18n `remoteAccess`
 * (`router_<id>_note`). Revérifier les liens à chaque mise à jour de ce fichier.
 */

export type RouterId = "swisscom" | "sunrise" | "salt" | "free" | "orange" | "sfr" | "bouygues";

export interface RouterMenuPath {
  /** Le modèle concerné, quand l'opérateur en a plusieurs. */
  box: string | null;
  text: string;
  lang: "fr" | "en" | "de";
}

export interface RouterGuide {
  id: RouterId;
  name: string;
  country: "CH" | "FR";
  box: string;
  /** Les adresses de l'interface de la box, telles que l'opérateur les donne. */
  adminUrls: readonly string[];
  guide: { fr: string | null; en: string | null; de: string | null };
  stepByStep: boolean;
  menuPaths: readonly RouterMenuPath[];
  ipv6: { byDefault: boolean | null; inboundBlocked: boolean | null; source: string | null };
  sharedIpv4: { possible: boolean | null; remedy: "ask_ipv4" | "paid_option" | "full_stack" | null; source: string | null };
  /** Faux : rien n'a pu être vérifié (le site de l'opérateur refuse nos outils) — à vérifier à la main. */
  verified: boolean;
}

export const ROUTER_GUIDES_VERIFIED_ON = "2026-10-06";

export const ROUTER_GUIDES: readonly RouterGuide[] = [
  {
    id: "swisscom",
    name: "Swisscom",
    country: "CH",
    box: "Internet-Box",
    adminUrls: ["http://internetbox.swisscom.ch", "http://192.168.1.1"],
    guide: {
      fr: "https://www.swisscom.ch/fr/clients-prives/aide/internet/internetbox-home.html",
      en: "https://www.swisscom.ch/en/residential/help/internet/internetbox-home.html",
      de: "https://community.swisscom.ch/d/522510-verbindung-an-ein-gerat-weiterleiten-dank-dmz-funktion",
    },
    stepByStep: false,
    menuPaths: [],
    ipv6: { byDefault: true, inboundBlocked: null, source: "https://community.swisscom.ch/d/738671-migration-zu-native-ipv6-dualstack-abgeschlossen" },
    sharedIpv4: { possible: null, remedy: null, source: null },
    verified: true,
  },
  {
    id: "sunrise",
    name: "Sunrise",
    country: "CH",
    box: "Connect Box / Sunrise Internet Box",
    adminUrls: ["http://192.168.1.1", "http://sunrise.box"],
    guide: {
      fr: "https://community.sunrise.ch/d/7845-connect-box-port-forwarding-port",
      en: "https://community.sunrise.ch/d/7846-connect-box-port-forwarding-port-redirection",
      de: "https://community.sunrise.ch/d/29779-connect-box-1-3-port-forwarding-port-weiterleitung",
    },
    stepByStep: true,
    menuPaths: [
      { box: "Sunrise Internet Box", text: "Access Control > Port Forwarding > Add Rule", lang: "en" },
      { box: "Connect Box", text: "Erweiterte Einstellungen > Sicherheit > Portweiterleitung > Eine neue Regel erstellen", lang: "de" },
    ],
    ipv6: {
      byDefault: null,
      inboundBlocked: true,
      source: "https://www.sunrise.ch/content/dam/sunrise/residential/hilfe/internet/Sunrise_Home_User_Manual_Sunrise_Internet_Box_new_firmware_e.pdf",
    },
    sharedIpv4: { possible: true, remedy: "ask_ipv4", source: "https://community.sunrise.ch/d/15488-modem-von-ipv6-ds-lite-auf-ipv4-umstellen" },
    verified: true,
  },
  {
    id: "salt",
    name: "Salt",
    country: "CH",
    box: "Salt Fiber Box (X6)",
    adminUrls: ["http://salt.box", "http://192.168.1.1"],
    guide: {
      fr: "https://www.salt.ch/fr/help/home/internet",
      en: "https://www.salt.ch/en/help/home/internet",
      de: "https://www.salt.ch/de/help/home/internet",
    },
    stepByStep: false,
    menuPaths: [],
    ipv6: { byDefault: true, inboundBlocked: null, source: "https://www.salt.ch/fr/help/home/internet" },
    sharedIpv4: { possible: true, remedy: "paid_option", source: "https://www.salt.ch/fr/internet-tv/static-ip-addresses" },
    verified: true,
  },
  {
    id: "free",
    name: "Free",
    country: "FR",
    box: "Freebox",
    adminUrls: ["http://mafreebox.freebox.fr"],
    guide: { fr: "https://assistance.free.fr/articles/1395", en: null, de: null },
    stepByStep: true,
    menuPaths: [{ box: "Freebox Connect", text: "Réseau > … > Paramètres réseau avancés > Redirection de port", lang: "fr" }],
    ipv6: { byDefault: true, inboundBlocked: null, source: "https://assistance.free.fr/articles/356" },
    sharedIpv4: { possible: true, remedy: "full_stack", source: "https://assistance.free.fr/articles/1758" },
    verified: true,
  },
  {
    id: "orange",
    name: "Orange",
    country: "FR",
    box: "Livebox (4, 5, 6, 7)",
    adminUrls: ["http://livebox", "http://192.168.1.1"],
    guide: {
      fr: "https://assistance.orange.fr/livebox-modem/toutes-les-livebox-et-modems/installer-et-utiliser/piloter-et-parametrer-votre-materiel/le-parametrage-avance-reseau-nat-pat-ip/configurer-des-regles-nat-pat/livebox-6-et-7-configurer-les-regles-nat-pour-pouvoir-utiliser-certains-jeux-ou-applications-serveur_362613-896058",
      en: null,
      de: null,
    },
    stepByStep: true,
    menuPaths: [{ box: null, text: "Paramètres avancés > Réseau > NAT/PAT", lang: "fr" }],
    ipv6: {
      byDefault: true,
      inboundBlocked: true,
      source: "https://assistance.orange.fr/livebox-modem/toutes-les-livebox-et-modems/installer-et-utiliser/piloter-et-parametrer-votre-materiel/le-parametrage-du-firewall-de-votre-livebox/comment-parametrer-le-pare-feu-depuis-l-interface-de-ma-livebox_472766-1001767",
    },
    sharedIpv4: { possible: null, remedy: null, source: null },
    verified: true,
  },
  {
    id: "sfr",
    name: "SFR",
    country: "FR",
    box: "SFR Box",
    adminUrls: [],
    guide: { fr: null, en: null, de: null },
    stepByStep: false,
    menuPaths: [],
    ipv6: { byDefault: null, inboundBlocked: null, source: null },
    sharedIpv4: { possible: null, remedy: null, source: null },
    verified: false,
  },
  {
    id: "bouygues",
    name: "Bouygues Telecom",
    country: "FR",
    box: "Bbox",
    adminUrls: ["https://mabbox.bytel.fr"],
    guide: { fr: "https://www.bouyguestelecom.fr/guide-pratique/internet/double-nat-impact-usages", en: null, de: null },
    stepByStep: false,
    menuPaths: [],
    ipv6: { byDefault: null, inboundBlocked: null, source: "https://www.bouyguestelecom.fr/guide-pratique/internet/ipv4-ou-ipv6" },
    sharedIpv4: { possible: null, remedy: null, source: null },
    verified: true,
  },
];

export function routerGuide(id: string | null | undefined): RouterGuide | null {
  return ROUTER_GUIDES.find((guide) => guide.id === id) ?? null;
}

/** La page du guide dans la langue de l'interface, sinon la première qui existe. */
export function routerGuideUrl(guide: RouterGuide, lang: string): string | null {
  const preferred = lang.startsWith("fr") ? "fr" : lang.startsWith("de") ? "de" : "en";
  return guide.guide[preferred] ?? guide.guide.fr ?? guide.guide.en ?? guide.guide.de;
}
