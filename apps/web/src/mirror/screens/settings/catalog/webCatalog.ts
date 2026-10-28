import type {
  SettingsActionId, SettingsBlockId, SettingsControlId, SettingsCatalogEntry, SettingsI18nRef, SettingsPaneId,
  SettingsScreenId, SettingsSectionId,
} from "@tentacle-tv/shared";

/**
 * Le web étroit (téléphone, tablette, fenêtre de bureau rétrécie) rend le
 * CATALOGUE PARTAGÉ des réglages (`@tentacle-tv/shared` › `settingsCatalog`),
 * le même que le mobile. Ici, ce que le web y ajoute : SES routes, et la
 * RAISON de chaque entrée qu'il ne rend pas. Module pur — le test de
 * couverture (`webCoverage.test.ts`) vérifie que chaque entrée du catalogue
 * est rendue par le web OU listée ici, et que cette liste dit la même chose
 * que le champ `platforms` du catalogue.
 */

/** La clé d'une entrée du catalogue : « genre:identifiant ». */
export type CatalogEntryKey = `${SettingsCatalogEntry["kind"]}:${string}`;
export const entryKey = (entry: Pick<SettingsCatalogEntry, "kind" | "id">): CatalogEntryKey => `${entry.kind}:${entry.id}`;

/** Les entrées réservées au mobile, et pourquoi le web ne les a pas. */
export const WEB_UNRENDERED: Readonly<Record<string, string>> = {
  "control:liquidGlass": "Liquid Glass est un rendu d'iOS 26 : un navigateur ne l'a pas.",
  "control:subtitleSize": "Réglage du lecteur avancé natif (mpv) du mobile ; le lecteur du navigateur n'en a pas.",
  "control:subtitlePosition": "Réglage du lecteur avancé natif (mpv) du mobile ; le lecteur du navigateur n'en a pas.",
  "control:engine": "Choix du moteur vidéo natif (système / avancé) : le navigateur n'a qu'un lecteur.",
  "control:engineOptions": "Options du lecteur natif (Atmos d'iOS, sous-titres stylés et fréquence d'Android).",
  "screen:offlineTitles": "Garder des titres hors ligne : le navigateur ne le sait pas (seules les apps).",
  "action:goOffline": "Passer hors ligne : le navigateur n'a pas de mode hors ligne.",
  "block:offlineSpace": "Espace occupé par les titres gardés sur l'appareil : sans objet dans un navigateur.",
  "control:wifiOnly": "Transferts sur données cellulaires : le navigateur ne garde pas de titres.",
  "control:backgroundTransfers": "Transferts en arrière-plan : propres aux apps qui gardent des titres.",
  "control:notifyReady": "Notification « prêt hors ligne » : notification LOCALE des apps.",
  "control:liveTransfers": "Activité en direct des transferts (île dynamique, notification Android) : natif.",
  "control:bootIntro": "Ouverture animée du logo au démarrage : propre aux apps natives.",
  "control:bootSound": "Son de l'ouverture au démarrage : propre aux apps natives.",
  "action:removeAllOffline": "Tout retirer de l'appareil : le navigateur ne garde pas de titres.",
  "pane:notifications": "Catégories des notifications PUSH : un navigateur n'en reçoit pas (la cloche reste).",
  "action:changeServer": "Dans un navigateur, le serveur EST l'adresse ; le web étroit ne se monte jamais dans l'app de bureau.",
};

/** Les réglages sur place que le web rend (le registre des composants les couvre tous : le type le tient). */
export type WebControlId = Exclude<
  SettingsControlId,
  "liquidGlass" | "subtitleSize" | "subtitlePosition" | "engine" | "engineOptions" | "wifiOnly" | "backgroundTransfers" | "notifyReady" | "liveTransfers"
  | "bootIntro" | "bootSound"
>;
export type WebPaneId = Exclude<SettingsPaneId, "notifications">;
export type WebScreenId = Exclude<SettingsScreenId, "offlineTitles">;
export type WebActionId = Exclude<SettingsActionId, "goOffline" | "changeServer" | "removeAllOffline">;
export type WebBlockId = Exclude<SettingsBlockId, "offlineSpace">;

/**
 * Ce que le web rend, en DONNÉES (le test de couverture les lit sans monter
 * un composant). Le `satisfies` force chaque identifiant non réservé au
 * mobile ; les registres de composants (`webControlRegistry.tsx`,
 * `paneRegistry.tsx`) ont le même type : l'un ne peut pas manquer à l'autre.
 */
const CONTROLS_RENDERED = {
  photo: true, userName: true, switchProfile: true, askAtLaunch: true, intros: true, nextAutoPlay: true, stillWatching: true,
  language: true, trendingNow: true, theme: true, dataSaver: true, advancedOnDesktop: true,
} as const satisfies Record<WebControlId, true>;
const ACTIONS_RENDERED = { clearCache: true, deleteAccount: true, privacyPolicy: true } as const satisfies Record<WebActionId, true>;
const BLOCKS_RENDERED = { scopeIntro: true } as const satisfies Record<WebBlockId, true>;

export const WEB_CONTROL_IDS = Object.keys(CONTROLS_RENDERED) as WebControlId[];
export const WEB_ACTION_IDS = Object.keys(ACTIONS_RENDERED) as WebActionId[];
export const WEB_BLOCK_IDS = Object.keys(BLOCKS_RENDERED) as WebBlockId[];

/** Où mène chaque écran du catalogue, sur le web. */
export const WEB_SCREEN_ROUTES: Readonly<Record<WebScreenId, string>> = {
  family: "/settings/family",
  sessions: "/admin/sessions",
  support: "/support",
  about: "/about",
};

/** Le segment d'URL de chaque volet — celui de l'app mobile (`/settings/media-languages`…). */
export const WEB_PANE_SEGMENTS: Readonly<Record<WebPaneId, string>> = {
  password: "password",
  mediaLanguages: "media-languages",
  personalization: "personalization",
  devices: "devices",
  invites: "invites",
};

export const WEB_PANES = Object.keys(WEB_PANE_SEGMENTS) as WebPaneId[];

export const isWebPane = (id: string): id is WebPaneId => id in WEB_PANE_SEGMENTS;

/** La route plein écran d'un volet (téléphone, liens profonds). */
export const webPaneRoute = (id: WebPaneId): string => `/settings/${WEB_PANE_SEGMENTS[id]}`;

/** La page d'une rubrique ; sur tablette, `pane` pose un volet dans la colonne de détail. */
export function webSectionRoute(section: SettingsSectionId, pane?: WebPaneId): string {
  return pane ? `/profile/${section}?pane=${WEB_PANE_SEGMENTS[pane]}` : `/profile/${section}`;
}

/**
 * Ce que dit un `/settings/<segment>` : un volet, une rubrique (les anciennes
 * pages du web et du mobile fondues dans une rubrique), ou rien (retour au
 * profil). `family` reste un écran à part (la page Famille du bureau).
 */
export type SettingsPathTarget =
  | { kind: "pane"; id: WebPaneId }
  | { kind: "section"; id: SettingsSectionId }
  | { kind: "family" }
  | { kind: "profile" };

const LEGACY_SECTION_SEGMENTS: Readonly<Record<string, SettingsSectionId>> = {
  playback: "playback",
  data: "playback",
  appearance: "playback",
  // Le mobile y met la rubrique Hors ligne ; le web n'en a pas : la rubrique se résout plus loin.
  "on-device": "offline",
  downloads: "offline",
  notifications: "notifications",
};

export function parseSettingsSegment(raw: string | null | undefined): SettingsPathTarget {
  if (!raw) return { kind: "profile" };
  if (raw === "family") return { kind: "family" };
  if (raw === "security") return { kind: "pane", id: "password" };
  // Rubrique du web large (Langues et sous-titres) : son pendant étroit est le volet des langues.
  if (raw === "languages") return { kind: "pane", id: "mediaLanguages" };
  const pane = WEB_PANES.find((id) => WEB_PANE_SEGMENTS[id] === raw || id === raw);
  if (pane) return { kind: "pane", id: pane };
  const section = LEGACY_SECTION_SEGMENTS[raw];
  return section ? { kind: "section", id: section } : { kind: "profile" };
}

/**
 * Les phrases du catalogue écrites pour le téléphone (« ce téléphone les
 * partagent ») ont leur version web. Clé : « espace:clé ».
 */
const WEB_TEXT_OVERRIDES: Readonly<Record<string, SettingsI18nRef>> = {
  "settingsMobile:playback.everywhereCaption": { ns: "settingsMobile", key: "web.everywhereCaption" },
  "settingsMobile:playback.thisDeviceCaption": { ns: "settingsMobile", key: "web.thisDeviceCaption" },
};

export function webText(ref: SettingsI18nRef): SettingsI18nRef {
  return WEB_TEXT_OVERRIDES[`${ref.ns}:${ref.key}`] ?? ref;
}
