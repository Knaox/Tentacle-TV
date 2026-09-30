import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { uiLanguage } from "@tentacle-tv/shared";
import { LiquidGlassProvider } from "../../../src/redesign/glass/liquidGlassMode";
import { SettingsView, type SettingsViewProps } from "../../../src/redesign/screens/settings/SettingsView";
import type { BenchData } from "../data/benchData";
import { choiceListOf, playbackOf, settingsImages, settingsPropsOf } from "../data/settingsModels";
import type { BenchScene } from "./types";

/**
 * Les réglages, sur le vrai compte Knaoxtest : chaque onglet, la liste de
 * choix ouverte, la déconnexion armée, le Liquid Glass coupé, la variante
 * Android TV. La scène s'abonne à la langue (`useTranslation`) : `lang en`
 * retraduit aussi les valeurs résolues côté banc.
 */

type Variant =
  | "account"
  | "armed"
  | "playback"
  | "custom"
  | "libraries"
  | "choices"
  | "android"
  | "appearance"
  | "glassOff"
  | "about";

/** Le défilement qui amène les préférences de bibliothèque à l'écran. */
const LIBRARIES_SCROLL = 560;

function propsFor(data: BenchData, variant: Variant, language: string): SettingsViewProps {
  const base = settingsPropsOf(data);
  const playback = (extra: Parameters<typeof playbackOf>[1] = {}) =>
    playbackOf(data, { interfaceLanguage: uiLanguage(language), ...extra });
  switch (variant) {
    case "armed":
      return { ...base, armedAction: "logout" };
    case "playback":
      return { ...base, tab: "playback", playback: playback() };
    case "custom":
      return { ...base, tab: "playback", playback: playback({ preset: "custom" }) };
    case "libraries":
      return { ...base, tab: "playback", playback: playback(), panelScrollY: LIBRARIES_SCROLL };
    case "choices":
      return { ...base, tab: "playback", playback: playback(), panelScrollY: LIBRARIES_SCROLL, choiceList: choiceListOf(data, 0, "audio") };
    case "android":
      return { ...base, tab: "playback", panelScrollY: 372, playback: playback({ device: { tunneling: true, matchFrameRate: false } }) };
    case "appearance":
    case "glassOff":
      return { ...base, tab: "appearance" };
    case "about":
      return { ...base, tab: "about" };
    default:
      return base;
  }
}

function SettingsScene({ data, variant }: { data: BenchData; variant: Variant }) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const props = useMemo(() => propsFor(data, variant, language), [data, variant, language]);
  const view = <SettingsView {...props} />;
  // Le verre coupé : la scène force le fournisseur, comme l'app le fera
  // depuis la clé `tentacle_liquid_glass`.
  return variant === "glassOff" ? <LiquidGlassProvider enabled={false}>{view}</LiquidGlassProvider> : view;
}

const scene = (id: string, label: string, variant: Variant, focusKeys: string[], settleMs = 1100): BenchScene => ({
  id: `reglages/${id}`,
  group: "Réglages",
  label,
  focusKeys,
  settleMs,
  images: settingsImages,
  render: (data) => <SettingsScene data={data} variant={variant} />,
});

export const SETTINGS_SCENES: BenchScene[] = [
  scene("compte", "Compte", "account", ["settings:tab:account", "settings:changeServer", "settings:logout"]),
  scene("deconnexion-armee", "Déconnexion armée", "armed", ["settings:logout"]),
  scene("lecture", "Lecture", "playback", ["settings:tab:playback", "settings:preset:default", "settings:preset:automatic", "settings:lang:en"]),
  scene("lecture-personnalise", "Lecture — mode personnalisé", "custom", ["settings:preset:custom", "settings:preset:manual"]),
  scene("lecture-bibliotheques", "Lecture — bibliothèques", "libraries", ["settings:lib:0:audio", "settings:lib:0:reset", "settings:lib:1:subtitles"]),
  scene("liste-de-choix", "Liste de choix ouverte", "choices", ["settings:choice:6", "settings:choice:0"], 1300),
  scene("lecture-android", "Lecture — Android TV", "android", ["settings:tunneling", "settings:matchFrameRate"]),
  scene("apparence", "Apparence — Liquid Glass", "appearance", ["settings:tab:appearance", "settings:liquidGlass"]),
  scene("apparence-verre-coupe", "Apparence — Liquid Glass coupé", "glassOff", ["settings:liquidGlass", "settings:tab:appearance"]),
  scene("a-propos", "À propos", "about", ["settings:tab:about"]),
];
