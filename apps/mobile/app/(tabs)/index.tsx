import { HomeScreen } from "@/screens/HomeScreen";
import { OfflineLibraryScreen } from "@/offline/library/OfflineLibraryScreen";
import { useOfflineMode } from "@/offline/useOfflineMode";

/** L'onglet Accueil : le serveur en ligne, ce qui est sur l'appareil hors ligne. */
export default function HomeRoute() {
  const offline = useOfflineMode();
  return offline ? <OfflineLibraryScreen /> : <HomeScreen />;
}
