import { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PRESET_LABEL_KEYS, type PlaybackPreset } from "@tentacle-tv/shared";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../color/artworkPalette";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { useLiquidGlassEnabled } from "../../glass/liquidGlassMode";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { text } from "../../theme/tokens";
import { AboutPanel } from "./AboutPanel";
import { AccountPanel } from "./AccountPanel";
import { AppearancePanel } from "./AppearancePanel";
import { ChoiceSheet } from "./ChoiceSheet";
import { PlaybackPanel } from "./PlaybackPanel";
import { SettingsTabs, TAB_WIDTH, type SettingsTabItem } from "./SettingsTabs";
import type {
  AccountAction,
  ChoiceListModel,
  InterfaceLanguage,
  LibrarySettingKey,
  SettingsAbout,
  SettingsAccount,
  SettingsPlayback,
  SettingsTab,
} from "./settingsTypes";

/**
 * Les réglages : la navigation (Réglages actif), le titre, les onglets en
 * colonne — Compte · Lecture · Apparence · À propos — et à droite un grand
 * panneau de verre. La liste de choix d'un réglage s'ouvre par-dessus tout.
 *
 * Contrat (tout arrive résolu ; les libellés fixes sont traduits ici) :
 * - `tab` / `onSelectTab` : l'onglet est un état de l'ÉCRAN (Retour quitte
 *   les réglages d'un appui, il ne remonte pas les onglets) ;
 * - `account` : `tentacle_user` (nom), portrait Jellyfin
 *   (`/Users/{id}/Images/Primary`), `tentacle_server_url`, `TV_PLATFORM_LABEL` ;
 *   `onChangeServer` → `useAuth().changeServer` puis `PairCode` ;
 *   `onLogout` → `doLogout` (verrou « lecture en cours ») ;
 * - `playback` : `useOwnPlaybackSettings` + `detectPreset` (`onSelectPreset` →
 *   `setPlaybackSettings(presetSettings(p))`), `i18n.language`
 *   (`onSelectLanguage` → `changeLanguage`, `tentacle_language`,
 *   `useSetInterfaceLanguage`), `useLibraries` + `useLibraryPreferences`
 *   (valeurs résolues par `LANGUAGE_KEYS` / `SUBTITLE_MODES`),
 *   `onResetLibrary` → `useDeleteLibraryPreference` ; Android :
 *   `useExoTunneling` / `useExoMatchFrameRate` et leurs magasins ;
 * - `choiceList` : le réglage ouvert (`onOpenLibrarySetting`), `onChoose` →
 *   `useSetLibraryPreference` (trio complet) ; Retour la remet à `null` ;
 * - Liquid Glass : lu sur `LiquidGlassProvider` (clé `tentacle_liquid_glass`),
 *   `onToggleLiquidGlass` écrit la clé ;
 * - `about` : `versions.json` (`tv`), serveur, compte, appareil, année.
 *
 * Clés de focus : `settings:tab:<onglet>`, `settings:changeServer`,
 * `settings:logout`, `settings:preset:<mode>`, `settings:lang:<fr|en>`,
 * `settings:lib:<i>:<réglage|reset>`, `settings:tunneling`,
 * `settings:matchFrameRate`, `settings:liquidGlass`,
 * `settings:choice:<i>` (liste de choix). Groupes : `settings:tabs` (la
 * colonne des onglets) et `settings:panel` (le panneau) — GAUCHE depuis le
 * panneau revient à l'onglet affiché, DROITE depuis un onglet entre dans le
 * panneau là où on l'avait laissé.
 */

export interface SettingsViewProps {
  nav: NavRailProps;
  tab: SettingsTab;
  account: SettingsAccount;
  playback: SettingsPlayback;
  about: SettingsAbout;
  choiceList?: ChoiceListModel | null;
  /** Un fond d'œuvre pour l'aperçu du verre ; absent → un dégradé. */
  glassPreviewUri?: string;
  /** La lumière du fond (neutre et chaude par défaut). */
  palette?: ArtworkPalette;
  /** Une action du compte déjà armée à l'ouverture (reprise, banc). */
  armedAction?: AccountAction | null;
  /** Le défilement du panneau à l'ouverture (retour sur l'onglet, banc). */
  panelScrollY?: number;
  onSelectTab?: (tab: SettingsTab) => void;
  onChangeServer?: () => void;
  onLogout?: () => void;
  onSelectPreset?: (preset: Exclude<PlaybackPreset, "custom">) => void;
  onSelectLanguage?: (language: InterfaceLanguage) => void;
  onOpenLibrarySetting?: (libraryId: string, key: LibrarySettingKey) => void;
  onResetLibrary?: (libraryId: string) => void;
  onToggleTunneling?: (next: boolean) => void;
  onToggleMatchFrameRate?: (next: boolean) => void;
  onToggleLiquidGlass?: (next: boolean) => void;
  onChoose?: (value: string) => void;
}

const LEFT = TV_STAGE.contentLeft;
const TITLE_TOP = TV_STAGE.safe.y + 14;
const PANEL_TOP = 164;
const PANEL_LEFT = LEFT + TAB_WIDTH + 44;
const PANEL_WIDTH = 1920 - PANEL_LEFT - TV_STAGE.safe.x;
const PANEL_PAD_X = 52;
const PANEL_RADIUS = TV_STAGE.hero.radius;
/** La largeur utile du panneau, pour ce qui s'y partage (aperçu du verre). */
const PANEL_INNER = PANEL_WIDTH - PANEL_PAD_X * 2;

export const SettingsView = memo(function SettingsView(props: SettingsViewProps) {
  const { nav, tab, account, playback, about, choiceList, palette = NEUTRAL_PALETTE } = props;
  const { t } = useTranslation(["preferences", "nav", "about"]);
  const liquid = useLiquidGlassEnabled();

  const tabs = useMemo<SettingsTabItem[]>(() => [
    { key: "account", label: t("preferences:sectionAccount"), caption: account.name, icon: "user" },
    { key: "playback", label: t("preferences:sectionPlayback"), caption: t(`preferences:${PRESET_LABEL_KEYS[playback.preset]}`), icon: "playCircle" },
    {
      key: "appearance",
      label: t("preferences:sectionAppearance"),
      // Le verre en cours, nommé : « Liquid Glass » ou « Verre classique ».
      caption: t(liquid ? "preferences:liquidGlassTitle" : "preferences:glassClassic"),
      icon: "sparkles",
    },
    { key: "about", label: t("nav:about"), caption: t("about:version", { version: about.version }), icon: "info" },
  ], [t, account.name, playback.preset, liquid, about.version]);

  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      <Text style={[text.title, styles.title]}>{t("preferences:settingsTitle")}</Text>
      <FocusGroup focusKey="settings:tabs" style={styles.tabs}>
        <SettingsTabs items={tabs} active={tab} onSelect={props.onSelectTab} />
      </FocusGroup>
      <GlassSurface radius={PANEL_RADIUS} style={styles.panel} elevated>
        <FocusGroup focusKey="settings:panel" style={styles.clip}>
          <ScrollView
            key={tab}
            contentOffset={{ x: 0, y: props.panelScrollY ?? 0 }}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {tab === "account" ? (
              <AccountPanel
                account={account}
                initialArmed={props.armedAction}
                onChangeServer={props.onChangeServer}
                onLogout={props.onLogout}
              />
            ) : null}
            {tab === "playback" ? (
              <PlaybackPanel
                playback={playback}
                onSelectPreset={props.onSelectPreset}
                onSelectLanguage={props.onSelectLanguage}
                onOpenLibrarySetting={props.onOpenLibrarySetting}
                onResetLibrary={props.onResetLibrary}
                onToggleTunneling={props.onToggleTunneling}
                onToggleMatchFrameRate={props.onToggleMatchFrameRate}
              />
            ) : null}
            {tab === "appearance" ? (
              <AppearancePanel width={PANEL_INNER} previewImageUri={props.glassPreviewUri} onToggleLiquidGlass={props.onToggleLiquidGlass} />
            ) : null}
            {tab === "about" ? <AboutPanel about={about} /> : null}
          </ScrollView>
        </FocusGroup>
      </GlassSurface>
      <View style={styles.brand} pointerEvents="none">
        <BrandMark size={52} />
      </View>
      <NavRail {...nav} />
      {choiceList ? <ChoiceSheet list={choiceList} onChoose={props.onChoose} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  title: { position: "absolute", left: LEFT, top: TITLE_TOP },
  tabs: { position: "absolute", left: LEFT, top: PANEL_TOP },
  panel: {
    position: "absolute",
    left: PANEL_LEFT,
    top: PANEL_TOP,
    width: PANEL_WIDTH,
    bottom: TV_STAGE.safe.y,
  },
  clip: { flex: 1, borderRadius: PANEL_RADIUS, overflow: "hidden" },
  scroll: { paddingHorizontal: PANEL_PAD_X, paddingTop: 48, paddingBottom: 56 },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
