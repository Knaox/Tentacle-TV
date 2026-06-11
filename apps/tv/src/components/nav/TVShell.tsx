import { useCallback, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useLibraries, useTentacleConfig, useAuth, setPreferencesToken,
} from "@tentacle-tv/api-client";
import type { RootStackParamList } from "../../navigation/types";
import { TVSideRail, RAIL_COLLAPSED } from "./TVSideRail";
import { SelectionModal } from "../SelectionModal";
import { Colors } from "../../theme/colors";

interface TVShellProps {
  /** Clé d'item actif du rail : "Home" | "Search" | "Preferences" | "About" | `Library_${id}`. */
  currentRoute: string;
  /** Incrémenter pour redonner le focus au rail (ex: BACK sur l'accueil). */
  railFocusSignal?: number;
  children: React.ReactNode;
}

/**
 * Coquille commune des pages top-level : rail latéral persistant type tvOS à
 * gauche, contenu décalé de la largeur repliée. Centralise la navigation du
 * rail (y compris déconnexion / changement de serveur avec confirmation).
 */
export function TVShell({ currentRoute, railFocusSignal, children }: TVShellProps) {
  const { t } = useTranslation("nav");
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { storage } = useTentacleConfig();
  const { changeServer } = useAuth();
  const queryClient = useQueryClient();
  const { data: libraries } = useLibraries();
  const [confirm, setConfirm] = useState<null | "logout" | "changeServer">(null);

  const handleNavigate = useCallback((key: string) => {
    if (key === currentRoute) return;
    if (key === "Logout") { setConfirm("logout"); return; }
    if (key === "ChangeServer") { setConfirm("changeServer"); return; }
    if (key === "Home") navigation.navigate("Home");
    else if (key === "Search") navigation.navigate("Search");
    else if (key === "Preferences") navigation.navigate("Preferences");
    else if (key === "About") navigation.navigate("About");
    else if (key.startsWith("Library_")) {
      const libId = key.replace("Library_", "");
      const lib = libraries?.find((l) => l.Id === libId);
      navigation.navigate("Library", { libraryId: libId, libraryName: lib?.Name ?? "" });
    }
  }, [currentRoute, navigation, libraries]);

  const handleConfirm = useCallback((value: string) => {
    const action = confirm;
    setConfirm(null);
    if (value !== "confirm") return;
    if (action === "logout") {
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
      storage.removeItem("tentacle_jellyfin_token");
      storage.removeItem("tentacle_jellyfin_url");
      setPreferencesToken(null);
      queryClient.clear();
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } else if (action === "changeServer") {
      changeServer.mutate(undefined, {
        onSettled: () => {
          setPreferencesToken(null);
          navigation.reset({ index: 0, routes: [{ name: "PairCode" }] });
        },
      });
    }
  }, [confirm, storage, queryClient, navigation, changeServer]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <View style={{ flex: 1, paddingLeft: RAIL_COLLAPSED }}>{children}</View>
      <TVSideRail
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        grabFocusSignal={railFocusSignal}
      />
      {confirm && (
        <SelectionModal
          title={confirm === "logout" ? t("logoutConfirmTitle", { defaultValue: t("logout") }) : t("changeServer")}
          options={[
            { value: "confirm", label: confirm === "logout" ? t("logout") : t("changeServer") },
            { value: "cancel", label: t("cancel", { defaultValue: "Cancel" }) },
          ]}
          selectedValue={null}
          onSelect={handleConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </View>
  );
}
