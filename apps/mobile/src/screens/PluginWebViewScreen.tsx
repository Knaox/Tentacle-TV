import { useMemo, useCallback } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { useActivePlugins } from "../hooks/useActivePlugins";
import { usePluginBundle, useSharedDeps } from "../plugins/usePluginBundle";
import { buildPluginHtml } from "../plugins/pluginHtmlTemplate";
import { createBridgeHandler } from "../plugins/pluginBridge";
import { spacing, typography, useTheme } from "../theme";
import { IconButton } from "../components/ui";

function getWebView(): typeof import("react-native-webview").WebView | null {
  try {
    return require("react-native-webview").WebView;
  } catch {
    return null;
  }
}

/**
 * L'écran d'un plugin en WebView. Ouvert par un onglet (premier chemin mobile
 * du plugin) ou par un deep-link : `path` désigne une route mobile du plugin,
 * `query` sa query string — c'est ainsi qu'une recommandation hors
 * bibliothèque ouvre sa fiche dans le catalogue Vigie (`?media=movie:603`).
 */
export function PluginWebViewScreen() {
  const { pluginId, path, query } = useLocalSearchParams<{ pluginId: string; path?: string; query?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;
  const router = useRouter();
  const { storage } = useTentacleConfig();
  const { i18n, t } = useTranslation("errors");
  const { data: plugins } = useActivePlugins();

  const plugin = plugins?.find((p) => p.pluginId === pluginId);
  const { data: bundleCode, isLoading: bundleLoading, error: bundleError } = usePluginBundle(pluginId);
  const { data: sharedDepsCode, isLoading: depsLoading, error: depsError } = useSharedDeps();

  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";
  const userRaw = storage.getItem("tentacle_user") ?? "";
  const lang = i18n.language ?? "fr";

  // Le chemin demandé s'il est une route mobile du plugin, sinon la première.
  const pluginPath = useMemo(() => {
    const mobileItems = (plugin?.navItems ?? []).filter((n) => n.platforms.includes("mobile"));
    const requested = typeof path === "string" ? mobileItems.find((n) => n.path === path) : undefined;
    return requested?.path ?? mobileItems[0]?.path ?? "/";
  }, [plugin, path]);
  const pluginQuery = typeof query === "string" && query.startsWith("?") ? query : undefined;

  // `theme` en dépendance : au switch clair/sombre la WebView remonte re-thémée.
  const htmlContent = useMemo(() => {
    if (!bundleCode || !sharedDepsCode) return null;
    return buildPluginHtml({
      backendUrl: serverUrl,
      token,
      userJson: userRaw,
      lang,
      bundleCode,
      sharedDepsCode,
      pluginPath,
      pluginQuery,
      appTheme: theme,
    });
  }, [bundleCode, sharedDepsCode, serverUrl, token, userRaw, lang, pluginPath, pluginQuery, theme]);

  const handleMessage = useCallback(
    createBridgeHandler(router),
    [router],
  );

  if (!plugin || bundleLoading || depsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.s0, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.brand.violet} />
      </View>
    );
  }

  if (bundleError || depsError || !htmlContent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.s0, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.text.secondary, textAlign: "center" }}>
          {t("pluginLoadFailed") ?? "Failed to load plugin"}
        </Text>
      </View>
    );
  }

  const WebViewComponent = getWebView();
  if (!WebViewComponent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.s0, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.text.secondary, textAlign: "center" }}>
          {t("webViewNotAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.s0 }}>
      <View style={{
        paddingTop: Math.max(insets.top, 24) + 8,
        paddingHorizontal: spacing.screenPadding,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.surface.s0,
      }}>
        <IconButton icon="←" onPress={() => backOrHome(router)} />
        <Text style={{ ...typography.subtitle, color: colors.text.primary, flex: 1 }}>
          {plugin.name}
        </Text>
      </View>
      <WebViewComponent
        source={{ html: htmlContent, baseUrl: serverUrl }}
        onMessage={handleMessage}
        style={{ flex: 1, backgroundColor: colors.surface.s0 }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        originWhitelist={["*"]}
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface.s0 }}>
            <ActivityIndicator color={colors.brand.violet} />
          </View>
        )}
      />
    </View>
  );
}
