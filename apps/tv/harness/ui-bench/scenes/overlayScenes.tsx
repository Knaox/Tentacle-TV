import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BootView } from "../../../src/redesign/screens/overlays/BootView";
import { EXPIRED_BANNER_BOTTOM, ExpiredPairingBanner } from "../../../src/redesign/screens/overlays/ExpiredPairingBanner";
import { OfflineOverlay } from "../../../src/redesign/screens/overlays/OfflineOverlay";
import { ScreenErrorView } from "../../../src/redesign/screens/overlays/ScreenErrorView";
import { ScreenSkeleton } from "../../../src/redesign/screens/overlays/ScreenSkeleton";
import { SessionMessages } from "../../../src/redesign/screens/overlays/SessionMessages";
import type { BenchData } from "../data/benchData";
import { ADMIN_MESSAGES, SCREEN_ERROR_DETAIL } from "../data/overlayModels";
import { navOf } from "../data/screenModels";
import { DEV_SERVER, heroPaletteOf } from "../data/settingsModels";
import { HOME_SCENES } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * Ce qui s'affiche par-dessus les écrans : hors ligne, jumelage expiré,
 * messages de l'administrateur — posés sur l'accueil RÉEL, comme dans
 * l'app — puis ce qui remplace un écran : son erreur, son chargement, et le
 * démarrage de l'application.
 */

/** L'accueil du compte, tel que le montre sa propre scène. */
function OverHome({ data, children }: { data: BenchData; children: ReactNode }) {
  const home = HOME_SCENES.find((scene) => scene.id === "accueil/defaut");
  return (
    <View style={styles.fill}>
      {home?.render(data)}
      {children}
    </View>
  );
}

const firstLibrary = (data: BenchData) => data.snapshot.libraries.find((lib) => lib.collectionType === "movies") ?? data.snapshot.libraries[0];

export const OVERLAY_SCENES: BenchScene[] = [
  {
    id: "surimpressions/hors-ligne",
    group: "Surimpressions",
    label: "Hors ligne (bloquant)",
    focusKeys: ["offline:retry", "offline:unpair"],
    settleMs: 1700,
    render: (data) => (
      <OverHome data={data}>
        <OfflineOverlay serverUrl={DEV_SERVER} />
      </OverHome>
    ),
  },
  {
    // Le premier appui de « Déjumeler cet appareil » : la pilule armée et la
    // ligne qui dit ce que fera le second.
    id: "surimpressions/hors-ligne-dejumeler",
    group: "Surimpressions",
    label: "Hors ligne · déjumeler armé",
    focusKeys: ["offline:unpair"],
    settleMs: 1700,
    render: (data) => (
      <OverHome data={data}>
        <OfflineOverlay serverUrl={DEV_SERVER} initialArmed />
      </OverHome>
    ),
  },
  {
    id: "surimpressions/jumelage-expire",
    group: "Surimpressions",
    label: "Bandeau « jumelage expiré »",
    focusKeys: ["hero:primary"],
    settleMs: 1700,
    render: (data) => (
      <OverHome data={data}>
        <ExpiredPairingBanner />
      </OverHome>
    ),
  },
  {
    id: "surimpressions/messages",
    group: "Surimpressions",
    label: "Messages de l'administrateur",
    focusKeys: ["hero:primary"],
    settleMs: 1700,
    render: (data) => (
      <OverHome data={data}>
        <SessionMessages messages={ADMIN_MESSAGES} />
      </OverHome>
    ),
  },
  {
    // Les deux en même temps : les messages se posent SOUS le bandeau (écart
    // de 18, comme l'intégration), sans quoi ils en couvraient la fin.
    id: "surimpressions/bandeau-et-messages",
    group: "Surimpressions",
    label: "Bandeau et messages ensemble",
    focusKeys: ["hero:primary"],
    settleMs: 1700,
    render: (data) => (
      <OverHome data={data}>
        <ExpiredPairingBanner />
        <SessionMessages messages={ADMIN_MESSAGES} top={EXPIRED_BANNER_BOTTOM + 18} />
      </OverHome>
    ),
  },
  {
    id: "surimpressions/erreur-ecran",
    group: "Surimpressions",
    label: "Erreur d'écran",
    focusKeys: ["screenError:retry", "screenError:back"],
    render: (data) => (
      <ScreenErrorView
        nav={navOf(data, "Recommendations")}
        palette={heroPaletteOf(data)}
        detail={SCREEN_ERROR_DETAIL}
      />
    ),
  },
  {
    id: "surimpressions/demarrage",
    group: "Surimpressions",
    label: "Démarrage",
    render: () => <BootView />,
  },
  {
    id: "surimpressions/chargement-ecran",
    group: "Surimpressions",
    label: "Chargement d'un écran (squelette)",
    render: (data) => {
      const library = firstLibrary(data);
      return <ScreenSkeleton nav={navOf(data, library ? `Library_${library.id}` : "Home")} palette={heroPaletteOf(data)} />;
    },
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
