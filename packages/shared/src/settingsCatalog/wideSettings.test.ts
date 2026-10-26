import { describe, expect, it } from "vitest";
import fr from "../i18n/locales/fr/settingsWeb";
import { SETTINGS_SECTIONS } from "./settingsSections";
import { SETTINGS_CONTROLS, SETTINGS_PANE_SCOPES } from "./settingsControls";
import type { SettingsControlId, SettingsI18nRef, SettingsPaneId } from "./settingsCatalogTypes";
import { WIDE_SETTINGS_BY_ID, WIDE_SETTINGS_SECTIONS } from "./wideSettingsSections";
import {
  WIDE_LEGACY_PATHS, firstWideSection, normalizeSettingsQuery, searchWideSettings, visibleWideGroups, visibleWideSections,
  wideSettingPath,
} from "./wideSettingsRules";
import { WIDE_EQUIVALENTS } from "./wideSettingsEquivalents";
import type { WideSettingId, WideSettingsContext } from "./wideSettingsTypes";

const ALL = WIDE_SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries));

/** Tout permis : le bureau macOS d'un administrateur en session personnelle, Octave et la Famille compris. */
const everything: WideSettingsContext = {
  platform: "web",
  capabilities: new Set(["playback.stillWatching", "trailers.preview", "reco.trending"]),
  offline: false,
  isAdmin: true,
  offlineVisible: false,
  canGoOffline: false,
  family: true,
  familyEntry: true,
  canSwitchProfile: true,
  launchAsked: true,
  liquidGlass: false,
  advancedEngine: false,
  engineOptions: false,
  abilities: new Set(["tickets", "manageAccount", "pairDevices", "push", "invites"]),
  bootIntro: false,
  liveTransfers: false,
  profileSession: false,
  desktopApp: true,
  glassToggle: true,
  octave: true,
  downloads: true,
  hardwareDecoding: true,
  hdrAuto: true,
  linuxSession: true,
  vigieReco: true,
};

/** Un navigateur, sans rien de propre au bureau, sans Octave ni Famille. */
const browser: WideSettingsContext = {
  ...everything, desktopApp: false, glassToggle: false, octave: false, downloads: false, hardwareDecoding: false,
  hdrAuto: false, linuxSession: false, family: false,
};

const valueAt = (ref: SettingsI18nRef): string =>
  ref.key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], fr) as string;
const ids = (list: readonly { entry: { id: WideSettingId } }[]) => list.map((hit) => hit.entry.id);

/**
 * L'INVENTAIRE d'avant la refonte (relu dans les pages du 2026-10-26) : chaque
 * réglage de l'écran large, à son ancienne place, et la ligne qui le porte
 * désormais. Aucun ne se perd.
 */
const BEFORE: Readonly<Record<string, WideSettingId>> = {
  "Apparence › Thème": "theme",
  "Apparence › Effets › Liquid Glass": "liquidGlass",
  "Apparence › Octave (thème, verre)": "octaveAppearance",
  "Apparence › Bandes-annonces › Aperçus au survol": "trailerPreviews",
  "Apparence › Bandes-annonces › Délai": "trailerPreviewDelay",
  "Personnalisation › Octave › Au démarrage, ouvrir": "octaveStartup",
  "Personnalisation › Bandeau principal": "heroSource",
  "Personnalisation › Taille des cartes": "cardDensity",
  "Personnalisation › Rangées de l'accueil": "homeRows",
  "Personnalisation › Tendances actuelles": "trendingNow",
  "Personnalisation › Recommandations personnalisées": "recoPersonalized",
  "Personnalisation › Hors bibliothèque (Vigie)": "recoVigie",
  "Personnalisation › Communautaires": "recoCommunity",
  "Personnalisation › Mon historique alimente…": "recoShareHistory",
  "Personnalisation › Équilibre des suggestions": "recoBalance",
  "Personnalisation › Réinitialiser mon profil de goût": "recoReset",
  "Personnalisation › Comptes liés (TMDB, synchronisation)": "linkedAccounts",
  "Famille › La famille (membres, invités, invitations reçues)": "familyProfiles",
  "Famille › Mon code PIN (et la carte « Action recommandée »)": "familyPin",
  "Famille › Qui regarde ? à l'ouverture": "askAtLaunch",
  "Famille › Dissoudre / Quitter": "familyLeave",
  "Sécurité › Mot de passe": "password",
  "Sécurité › Appareils jumelés": "pairedDevices",
  "Sécurité › Changer de serveur": "changeServer",
  "Lecture › Langue de l'interface": "interfaceLanguage",
  "Lecture › Langues de chaque bibliothèque": "libraryTracks",
  "Lecture › Sauts et enchaînement (mode)": "playbackMode",
  "Lecture › Réglage fin › Passages": "skipPassages",
  "Lecture › Réglage fin › Épisode suivant": "upNext",
  "Lecture › Vous regardez encore ?": "stillWatching",
  "Lecture › Décodage matériel": "hardwareDecoding",
  "Lecture › HDR automatique (Windows)": "hdrAuto",
  "Lecture › Session graphique (Linux)": "linuxSession",
  "Téléchargements › Emplacement": "downloadsLocation",
  "Téléchargements › Espace disque": "downloadsSpace",
  "Données › Économie de données": "dataSaver",
};

describe("catalogue des réglages du web large", () => {
  it("chaque réglage d'avant la refonte a sa ligne (aucun réglage perdu)", () => {
    for (const [before, id] of Object.entries(BEFORE)) expect(WIDE_SETTINGS_BY_ID[id], before).toBeDefined();
  });

  it("chaque réglage n'apparaît qu'une fois, et deux niveaux seulement (rubrique › groupe › ligne)", () => {
    expect(new Set(ALL.map((e) => e.id)).size).toBe(ALL.length);
    expect(Object.keys(WIDE_SETTINGS_BY_ID)).toHaveLength(ALL.length);
    for (const section of WIDE_SETTINGS_SECTIONS) {
      expect(new Set(section.groups.map((g) => g.id)).size).toBe(section.groups.length);
      for (const group of section.groups) expect(group.entries.length).toBeGreaterThan(0);
    }
  });

  it("chaque réglage dit ce qu'il fait, en une phrase", () => {
    for (const entry of ALL) {
      const text = valueAt(entry.description);
      expect(text.length, entry.id).toBeGreaterThan(20);
      expect(text.length, entry.id).toBeLessThan(170);
      expect(text, entry.id).toMatch(/[.!?»]$/);
    }
  });

  it("chaque réglage a sa portée ; seuls l'information et les gestes ponctuels n'en ont pas", () => {
    const withoutScope = ALL.filter((e) => e.scope === null).map((e) => e.id).sort();
    expect(withoutScope).toEqual(["downloadsSpace", "familyLeave", "recoReset"]);
  });

  it("le même réglage a la même portée que dans le catalogue du mobile (une structure, deux rendus)", () => {
    const narrow = SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries))
      .filter((e) => !e.platforms || e.platforms.includes("web"));
    for (const entry of narrow) {
      const key = `${entry.kind}:${entry.id}`;
      const equivalent = WIDE_EQUIVALENTS[key];
      expect(equivalent, `${key} : aucun pendant dans le web large`).toBeDefined();
      if (!equivalent || !("wide" in equivalent)) continue;
      const wide = WIDE_SETTINGS_BY_ID[equivalent.wide];
      expect(wide, key).toBeDefined();
      const narrowScope = entry.kind === "control" ? SETTINGS_CONTROLS[entry.id as SettingsControlId].scope
        : entry.kind === "pane" ? SETTINGS_PANE_SCOPES[entry.id as SettingsPaneId] : null;
      if (narrowScope) expect(wide.scope, key).toBe(narrowScope);
    }
  });

  it("dans un navigateur : ni téléchargements, ni vidéo de l'ordinateur, ni serveur, ni Octave", () => {
    const sections = visibleWideSections(browser).map((s) => s.id);
    expect(sections).not.toContain("downloads");
    expect(sections).not.toContain("family");
    const playback = WIDE_SETTINGS_SECTIONS.find((s) => s.id === "playback")!;
    expect(visibleWideGroups(playback, browser).map((g) => g.id)).not.toContain("video");
    const visible = visibleWideSections(browser).flatMap((s) => visibleWideGroups(s, browser).flatMap((g) => g.entries.map((e) => e.id)));
    for (const id of ["changeServer", "octaveAppearance", "octaveStartup", "liquidGlass"] as const) expect(visible).not.toContain(id);
    expect(visible).toContain("clearCache");
  });

  it("hors ligne, il ne reste que ce qui vit sur l'appareil", () => {
    const offline = { ...everything, offline: true };
    const visible = visibleWideSections(offline).flatMap((s) => visibleWideGroups(s, offline).flatMap((g) => g.entries.map((e) => e.id)));
    for (const id of ["password", "heroSource", "linkedAccounts", "familyProfiles", "clearCache"] as const) expect(visible).not.toContain(id);
    for (const id of ["theme", "dataSaver", "libraryTracks", "octaveStartup"] as const) expect(visible).toContain(id);
  });

  it("session d'un profil : ni mot de passe, ni appareils, ni suppression du compte", () => {
    const profile = { ...everything, profileSession: true };
    const visible = visibleWideSections(profile).flatMap((s) => visibleWideGroups(s, profile).flatMap((g) => g.entries.map((e) => e.id)));
    for (const id of ["password", "pairedDevices", "deleteAccount", "changeServer", "familyPin"] as const) expect(visible).not.toContain(id);
    expect(visible).toContain("linkedAccounts");
  });

  it("face à un serveur qui ne déclare rien, les fonctions nouvelles n'existent pas", () => {
    const old = { ...everything, capabilities: new Set<never>() };
    const visible = visibleWideSections(old).flatMap((s) => visibleWideGroups(s, old).flatMap((g) => g.entries.map((e) => e.id)));
    for (const id of ["stillWatching", "trailerPreviews", "trendingNow"] as const) expect(visible).not.toContain(id);
  });

  it("l'atterrissage est la première rubrique visible", () => {
    expect(firstWideSection(everything)).toBe("playback");
  });

  it("les anciennes adresses mènent au réglage qui les a recueillies", () => {
    expect(WIDE_LEGACY_PATHS.data).toBe("/settings/playback#dataSaver");
    expect(WIDE_LEGACY_PATHS["media-languages"]).toBe("/settings/languages#libraryTracks");
    expect(wideSettingPath("password")).toBe("/settings/security#password");
  });
});

describe("recherche dans les réglages", () => {
  const t = (ref: SettingsI18nRef) => valueAt(ref);

  it("normalise accents, casse et tirets", () => {
    expect(normalizeSettingsQuery("Sous-Titrés  ÉTÉ")).toBe("sous titres ete");
  });

  it("la langue des sous-titres d'une bibliothèque se trouve par les mots de tous les jours", () => {
    expect(ids(searchWideSettings("sous titres", everything, t))[0]).toBe("libraryTracks");
    expect(ids(searchWideSettings("VOSTFR", everything, t))).toContain("libraryTracks");
    expect(ids(searchWideSettings("VF", everything, t))).toContain("libraryTracks");
  });

  it("trouve les passages par « intro » et « générique »", () => {
    expect(ids(searchWideSettings("intro", everything, t))).toContain("skipPassages");
    expect(ids(searchWideSettings("generique", everything, t))).toContain("skipPassages");
    expect(ids(searchWideSettings("mot de passe", everything, t))[0]).toBe("password");
  });

  it("tous les mots doivent se trouver ; rien pour un mot inconnu ni pour une ligne absente", () => {
    expect(searchWideSettings("zzzz", everything, t)).toEqual([]);
    expect(searchWideSettings("   ", everything, t)).toEqual([]);
    expect(ids(searchWideSettings("HDR", browser, t))).not.toContain("hdrAuto");
    expect(ids(searchWideSettings("theme sombre", everything, t))[0]).toBe("theme");
  });
});
