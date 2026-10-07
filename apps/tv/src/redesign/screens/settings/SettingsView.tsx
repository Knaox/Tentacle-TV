import { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PRESET_LABEL_KEYS, type PlaybackPreset } from "@tentacle-tv/shared";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../color/artworkPalette";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusSection } from "../../focus/FocusSection";
import { GlassSurface } from "../../glass/GlassSurface";
import { useLiquidGlassEnabled } from "../../glass/liquidGlassMode";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { text } from "../../theme/tokens";
import { AboutPanel } from "./AboutPanel";
import { AccountPanel } from "./AccountPanel";
import { AppearancePanel } from "./AppearancePanel";
import { ChoiceSheet } from "./ChoiceSheet";
import { NavigationPanel } from "./NavigationPanel";
import { PlaybackPanel } from "./PlaybackPanel";
import { SettingsTabs, TAB_WIDTH, type SettingsTabItem } from "./SettingsTabs";
import type { OwnPinMode } from "@tentacle-tv/tv-core";
import type {
  AccountAction,
  ChoiceListModel,
  InterfaceLanguage,
  LibrarySettingKey,
  SettingsAbout,
  SettingsAccount,
  SettingsNavigation,
  SettingsPlayback,
  SettingsRenderTier,
  SettingsTab,
} from "./settingsTypes";

/**
 * Les réglages : la navigation (Réglages actif), le titre, les onglets en
 * colonne — Compte · Lecture · Apparence · Navigation · À propos — et à droite
 * un grand panneau de verre. La liste de choix d'un réglage s'ouvre
 * par-dessus tout.
 *
 * Contrat (tout arrive résolu ; les libellés fixes sont traduits ici) :
 * - `tab` / `onSelectTab` : l'onglet est un état de l'ÉCRAN (Retour quitte
 *   les réglages d'un appui, il ne remonte pas les onglets) ;
 * - `account` : `tentacle_user` (nom), portrait Jellyfin
 *   (`/Users/{id}/Images/Primary`), `tentacle_server_url`, `TV_PLATFORM_LABEL` ;
 *   `onChangeServer` et `onLogout` → `useAccountActions` (déjumelage commun,
 *   `unpairDevice`, puis `PairCode`) ;
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
 * - `renderTier` (Android TV) : le mode Lite (`platform/renderTier`),
 *   `onSelectLiteMode` l'écrit et recharge l'interface ; absent, rien ;
 * - `navigation` (Apple TV) : les entrées organisables de la barre de gauche
 *   (`NavigationPanel`) ; absent, l'onglet ne paraît pas ;
 * - `about` : `versions.json` (`tv`), serveur, compte, appareil, année.
 *
 * Clés de focus : `settings:tab:<onglet>`, `settings:changeServer`,
 * `settings:logout`, `settings:switchProfile`, `settings:manageProfiles`, `settings:preset:<mode>`, `settings:lang:<fr|en>`,
 * `settings:lib:<i>:<réglage|reset>`, `settings:tunneling`,
 * `settings:matchFrameRate`, `settings:liquidGlass`, `settings:lite:<auto|on|off>`,
 * `settings:nav:<i>[:visibility]`, `settings:nav:showAll|resetOrder`,
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
  navigation?: SettingsNavigation | null;
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
  /** Famille (Apple TV) : « Changer de profil », « Gérer les profils ». */
  onSwitchProfile?: () => void;
  onManageProfiles?: () => void;
  /** SON code PIN : créer, changer, retirer. */
  onOwnPin?: (mode: OwnPinMode) => void;
  onSelectPreset?: (preset: Exclude<PlaybackPreset, "custom">) => void;
  onSelectLanguage?: (language: InterfaceLanguage) => void;
  onOpenLibrarySetting?: (libraryId: string, key: LibrarySettingKey) => void;
  onResetLibrary?: (libraryId: string) => void;
  onToggleTunneling?: (next: boolean) => void;
  onToggleMatchFrameRate?: (next: boolean) => void;
  onSelectScrubOutcome?: (outcome: "return" | "resume") => void;
  onSelectScrubDelay?: (seconds: number) => void;
  onToggleLiquidGlass?: (next: boolean) => void;
  /** Faux : l'onglet Apparence (le réglage Liquid Glass) n'existe pas sur
   *  cette plateforme (trait `liquidGlass`). Absent : il existe. */
  appearance?: boolean;
  /** Le mode Lite (Android TV) : il fait exister l'onglet Apparence à lui seul. */
  renderTier?: SettingsRenderTier | null;
  onSelectLiteMode?: (mode: SettingsRenderTier["mode"]) => void;
  onMoveNavEntry?: (key: string) => void;
  onToggleNavEntry?: (key: string) => void;
  onShowAllNav?: () => void;
  onResetNavOrder?: () => void;
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
  const { nav, tab, account, playback, about, navigation, choiceList, palette = NEUTRAL_PALETTE, appearance = true, renderTier } = props;
  const { t } = useTranslation(["preferences", "nav", "about"]);
  const liquid = useLiquidGlassEnabled();
  const navTotal = navigation?.entries.length ?? 0;
  const navShown = navigation?.entries.filter((entry) => !entry.hidden).length ?? 0;

  const tabs = useMemo<SettingsTabItem[]>(() => [
    { key: "account", label: t("preferences:sectionAccount"), caption: account.name, icon: "user" },
    { key: "playback", label: t("preferences:sectionPlayback"), caption: t(`preferences:${PRESET_LABEL_KEYS[playback.preset]}`), icon: "playCircle" },
    ...(appearance || renderTier ? [{
      key: "appearance" as const,
      label: t("preferences:sectionAppearance"),
      // Le verre en cours, nommé : « Liquid Glass » ou « Verre classique » ;
      // sans verre réglable (Android TV), le rendu en cours : « Mode Lite » ou « Rendu complet ».
      caption: appearance
        ? t(liquid ? "preferences:liquidGlassTitle" : "preferences:glassClassic")
        : t(renderTier?.tier === "lite" ? "preferences:liteTierLite" : "preferences:liteTierNormal"),
      icon: "sparkles" as const,
    }] : []),
    ...(navigation ? [{
      key: "navigation" as const,
      label: t("preferences:sectionNavigation"),
      // Ce qu'il règle en ce moment : « 24 sur 27 affichées ».
      caption: navShown === navTotal ? t("preferences:navigationAllShown") : t("preferences:navigationCount", { shown: navShown, total: navTotal }),
      icon: "panelLeft" as const,
    }] : []),
    { key: "about", label: t("nav:about"), caption: t("about:version", { version: about.version }), icon: "info" },
  ], [t, account.name, playback.preset, appearance, renderTier, liquid, navigation, navShown, navTotal, about.version]);

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
            {/* Les réglages, une LISTE de lignes : HAUT / BAS à la ligne
                voisine, au plus proche — même un réglage un peu décalé. */}
            <FocusSection focusKey="settings:lines" list>
              {tab === "account" ? (
                <AccountPanel
                  account={account}
                  initialArmed={props.armedAction}
                  onChangeServer={props.onChangeServer}
                  onLogout={props.onLogout}
                  onSwitchProfile={props.onSwitchProfile}
                  onManageProfiles={props.onManageProfiles}
                  onOwnPin={props.onOwnPin}
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
                  onSelectScrubOutcome={props.onSelectScrubOutcome}
                  onSelectScrubDelay={props.onSelectScrubDelay}
                />
              ) : null}
              {tab === "appearance" && (appearance || renderTier) ? (
                <AppearancePanel
                  width={PANEL_INNER}
                  previewImageUri={props.glassPreviewUri}
                  onToggleLiquidGlass={props.onToggleLiquidGlass}
                  liquidGlass={appearance}
                  renderTier={renderTier}
                  onSelectLiteMode={props.onSelectLiteMode}
                />
              ) : null}
              {tab === "navigation" && navigation ? (
                <NavigationPanel
                  navigation={navigation}
                  onMoveEntry={props.onMoveNavEntry}
                  onToggleEntry={props.onToggleNavEntry}
                  onShowAll={props.onShowAllNav}
                  onResetOrder={props.onResetNavOrder}
                />
              ) : null}
              {tab === "about" ? <AboutPanel about={about} /> : null}
            </FocusSection>
          </ScrollView>
        </FocusGroup>
      </GlassSurface>
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
});
