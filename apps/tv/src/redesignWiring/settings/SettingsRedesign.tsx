import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useJellyfinClient, useResumeItems } from "@tentacle-tv/api-client";
import type { RootStackParamList } from "../../navigation/types";
import { SettingsView } from "../../redesign/screens/settings/SettingsView";
import type { SettingsTab } from "../../redesign/screens/settings/settingsTypes";
import { backdropUriOf, paletteOfItem } from "../cards/cardArtwork";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { ChoiceModal } from "./ChoiceModal";
import { TabDestinationProvider, tabFocusKey, useActiveTabDestination, useSettingsGroups } from "./settingsFocus";
import { useSettingsModel } from "./useSettingsModel";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

/**
 * Les réglages refondus (Apple TV) : `SettingsView` dans le cadre du socle
 * (navigation, Menu, focus d'entrée et de retour), sur la logique partagée
 * avec les réglages d'Android TV (`useSettingsModel`).
 *
 * L'onglet est un état de l'ÉCRAN : l'arrivée focalise l'onglet affiché, et
 * Retour ne remonte pas les onglets parcourus. La liste de choix s'ouvre dans
 * une `Modal` (`ChoiceModal`), pas dans la vue. Le fond et l'aperçu du verre
 * prennent l'œuvre en cours de lecture, quand il y en a une.
 */
export function SettingsRedesign(_props: Props) {
  const model = useSettingsModel();
  const [tab, setTab] = useState<SettingsTab>("account");
  const screen = useRedesignScreen({ railKey: "Settings", entryKey: tabFocusKey(tab) });
  useSettingsGroups(screen.focus);
  const tabDestination = useActiveTabDestination(screen.focus, tab);

  // L'œuvre de la première reprise : déjà en cache, l'accueil l'a chargée.
  const client = useJellyfinClient();
  const { data: resume } = useResumeItems();
  const artwork = resume?.[0];

  return (
    <RedesignScreen screen={screen}>
      <TabDestinationProvider value={tabDestination}>
        <SettingsView
          nav={screen.nav}
          tab={tab}
          account={model.account}
          playback={model.playback}
          about={model.about}
          choiceList={null}
          glassPreviewUri={artwork ? backdropUriOf(client, artwork) : undefined}
          palette={artwork ? paletteOfItem(artwork) : undefined}
          onSelectTab={setTab}
          onChangeServer={model.onChangeServer}
          onLogout={model.onLogout}
          onSelectPreset={model.onSelectPreset}
          onSelectLanguage={model.onSelectLanguage}
          onOpenLibrarySetting={model.onOpenLibrarySetting}
          onResetLibrary={model.onResetLibrary}
          onToggleTunneling={model.onToggleTunneling}
          onToggleMatchFrameRate={model.onToggleMatchFrameRate}
          onToggleLiquidGlass={model.onToggleLiquidGlass}
        />
      </TabDestinationProvider>
      <ChoiceModal list={model.choiceList} focus={screen.focus} onChoose={model.onChoose} onClose={model.closeChoices} />
    </RedesignScreen>
  );
}
