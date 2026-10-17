import { useCallback, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useJellyfinClient, useResumeItems } from "@tentacle-tv/api-client";
import { SETTINGS_DEFAULT_TAB, settingsEntryKey } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { TabDestinationProvider, useActiveTabDestination, useSettingsGroups } from "../../platform/tvos/screens/settings";
import { SettingsView } from "../../redesign/screens/settings/SettingsView";
import type { SettingsTab } from "../../redesign/screens/settings/settingsTypes";
import { useVerifiedImage } from "../../hooks/useVerifiedImage";
import { PLATFORM_TRAITS } from "../../platform/traits";
import { backdropUriOf, paletteOfItem } from "../cards/cardArtwork";
import { useBackLayer } from "../back/BackScope";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { ChoiceModal } from "./ChoiceModal";
import { LicenseReaderModal } from "./LicenseReaderModal";
import { useHomeSettings } from "./useHomeSettings";
import { useLicensesSettings } from "./useLicensesSettings";
import { useNavigationSettings } from "./useNavigationSettings";
import { useOwnPinReturn } from "./useOwnPinReturn";
import { useRailSetupTargets } from "../railSetup/useRailSetupTargets";
import { useProfileActions } from "./useProfileActions";
import { useRenderTierSetting } from "./useRenderTierSetting";
import { useSettingsModel } from "./useSettingsModel";
import { cardSizeStore } from "../../lib/cardSize";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

/**
 * Les réglages refondus (Apple TV) : `SettingsView` dans le cadre du socle
 * (navigation, Menu, focus d'entrée et de retour), sur la logique partagée
 * avec les réglages d'Android TV (`useSettingsModel`).
 *
 * L'onglet est un état de l'ÉCRAN : l'arrivée focalise l'onglet affiché
 * (`tab` de la route : « Réglages de la navigation », depuis le menu d'une
 * entrée du rail), et Retour ne remonte pas les onglets parcourus — il annule
 * d'abord un déplacement en cours dans l'onglet Navigation. La liste de choix (un réglage de
 * bibliothèque, ou les favoris du bandeau de l'onglet Personnalisation) s'ouvre dans
 * une `Modal` (`ChoiceModal`), pas dans la vue. Le fond et l'aperçu du verre
 * prennent l'œuvre en cours de lecture, quand il y en a une. Le focus est
 * décidé par tv-core (`focus/settingsFocus.ts`, `nav/arrange.ts`) et posé par
 * l'applicateur `platform/tvos/screens/settings.tsx`.
 */
export function SettingsRedesign({ navigation, route }: Props) {
  const model = useSettingsModel();
  // Famille (Apple TV) : le profil ouvert et ses gestes ; nul sur une TV d'avant les profils.
  const profiles = useProfileActions();
  const account = useMemo(() => ({ ...model.account, profile: profiles.profile }), [model.account, profiles.profile]);
  const [tab, setTab] = useState<SettingsTab>(route.params?.tab ?? SETTINGS_DEFAULT_TAB);
  const focus = useFocusStore();
  const nav = useNavigationSettings(focus);
  // Android TV : le mode Lite, seul occupant de l'onglet Apparence ; rien sur l'Apple TV.
  const lite = useRenderTierSetting();
  // L'onglet « Licences » et son lecteur, communs aux deux téléviseurs.
  const legal = useLicensesSettings(model.about.version);
  // « Personnalisation » : le bandeau principal de l'accueil (réglage du compte).
  const home = useHomeSettings(tab === "home");
  // Au retour du pavé de son code PIN, le focus rejoint la section « Code PIN ».
  const onReturn = useOwnPinReturn(profiles.pinOpened);
  const screen = useRedesignScreen({ railKey: "Settings", entryKey: settingsEntryKey(tab), focus, onReturn });
  // Le propriétaire de la famille : sa barre, appliquée à d'autres profils de cette TV (la préconfiguration).
  const railTargets = useRailSetupTargets().targets.length;
  const onApplyNavToProfiles = useMemo(
    () => (railTargets > 0 ? () => navigation.navigate("RailSetup", { origin: "settings" }) : undefined),
    [railTargets, navigation],
  );
  // La galerie des avatars : « Changer la photo », présent seulement face à un serveur qui le permet.
  const onChangePhoto = useCallback(() => navigation.navigate("AvatarGallery"), [navigation]);
  // Retour annule d'abord un déplacement en cours dans l'onglet Navigation.
  useBackLayer("menu", nav.navigation.movingKey !== null, nav.cancelNavMove);
  useSettingsGroups(screen.focus);
  const tabDestination = useActiveTabDestination(screen.focus, tab);

  // L'œuvre de la première reprise : déjà en cache, l'accueil l'a chargée.
  // Son fond est préchargé dès l'ouverture et ne passe à l'aperçu du verre
  // qu'une fois là : une grande image arrivait après l'onglet, sur une case
  // noire (mesuré avec de vraies données) ; le dégradé tient la place.
  const client = useJellyfinClient();
  const { data: resume } = useResumeItems();
  const artwork = resume?.[0];
  const preview = useVerifiedImage(artwork ? backdropUriOf(client, artwork) : null);

  return (
    <RedesignScreen screen={screen}>
      <TabDestinationProvider value={tabDestination}>
        <SettingsView
          nav={screen.nav}
          tab={tab}
          account={account}
          playback={model.playback}
          about={model.about}
          navigation={nav.navigation}
          home={home.home}
          onSelectHeroMode={home.onSelectHeroMode}
          onChangeFixedTitle={home.onChangeFixedTitle}
          onToggleTrendingNow={home.onToggleTrendingNow}
          licenses={legal.licenses}
          onOpenLicense={legal.openLicense}
          choiceList={null}
          glassPreviewUri={preview}
          palette={artwork ? paletteOfItem(artwork) : undefined}
          onSelectTab={setTab}
          onChangeServer={model.onChangeServer}
          onLogout={model.onLogout}
          onSwitchProfile={profiles.onSwitchProfile}
          onManageProfiles={profiles.onManageProfiles}
          onOwnPin={profiles.onOwnPin}
          onChangePhoto={onChangePhoto}
          onSelectPreset={model.onSelectPreset}
          onSelectLanguage={model.onSelectLanguage}
          onOpenLibrarySetting={model.onOpenLibrarySetting}
          onResetLibrary={model.onResetLibrary}
          onToggleTunneling={model.onToggleTunneling}
          onToggleMatchFrameRate={model.onToggleMatchFrameRate}
          onSelectScrubOutcome={model.onSelectScrubOutcome}
          onSelectScrubDelay={model.onSelectScrubDelay}
          onChangeStillWatching={model.onChangeStillWatching}
          onToggleTrailerPreviews={model.onToggleTrailerPreviews}
          onToggleTrailerPreviewSound={model.onToggleTrailerPreviewSound}
          onSelectTrailerPreviewDelay={model.onSelectTrailerPreviewDelay}
          appearance={PLATFORM_TRAITS.liquidGlass}
          onToggleLiquidGlass={PLATFORM_TRAITS.liquidGlass ? model.onToggleLiquidGlass : undefined}
          renderTier={lite.renderTier}
          onSelectLiteMode={lite.onSelectLiteMode}
          onSelectCardSize={cardSizeStore.set}
          onMoveNavEntry={nav.onMoveNavEntry}
          onToggleNavEntry={nav.onToggleNavEntry}
          onShowAllNav={nav.onShowAllNav}
          onResetNavOrder={nav.onResetNavOrder}
          onApplyNavToProfiles={onApplyNavToProfiles}
        />
      </TabDestinationProvider>
      {/* Une seule liste de choix : celle d'un réglage de bibliothèque, ou les favoris du bandeau. */}
      <ChoiceModal
        list={model.choiceList ?? home.choiceList}
        focus={screen.focus}
        onChoose={model.choiceList ? model.onChoose : home.onChoose}
        onClose={model.choiceList ? model.closeChoices : home.closeChoices}
      />
      <LicenseReaderModal reader={legal.reader} focus={screen.focus} onClose={legal.closeReader} />
    </RedesignScreen>
  );
}
