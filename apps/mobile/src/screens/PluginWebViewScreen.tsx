import { useMemo, useCallback } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { useActivePlugins } from "../hooks/useActivePlugins";
import { usePluginBundle, useSharedDeps } from "../plugins/usePluginBundle";
import { buildPluginHtml } from "../plugins/pluginHtmlTemplate";
import { createBridgeHandler } from "../plugins/pluginBridge";
import { colors, spacing, typography } from "../theme";
import { IconButton } from "../components/ui";

function getWebView(): typeof import("react-native-webview").WebView | null {
  try {
    return require("react-native-webview").WebView;
  } catch {
    return null;
  }
}

export function PluginWebViewScreen() {
  const { pluginId } = useLocalSearchParams<{ pluginId: string }>();
  const insets = useSafeAreaInsets();
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

  // Utiliser le premier path mobile du plugin
  const pluginPath = useMemo(() => {
    return plugin?.navItems?.find((n) => n.platforms.includes("mobile"))?.path ?? "/";
  }, [plugin]);

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
    });
  }, [bundleCode, sharedDepsCode, serverUrl, token, userRaw, lang, pluginPath]);

  const handleMessage = useCallback(
    createBridgeHandler(router),
    [router],
  );

  if (!plugin || bundleLoading || depsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (bundleError || depsError || !htmlContent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}>
          {t("pluginLoadFailed") ?? "Failed to load plugin"}
        </Text>
      </View>
    );
  }

  const WebViewComponent = getWebView();
  if (!WebViewComponent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}>
          {t("webViewNotAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: spacing.screenPadding,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.background,
      }}>
        <IconButton icon="←" onPress={() => router.back()} />
        <Text style={{ ...typography.subtitle, color: colors.textPrimary, flex: 1 }}>
          {plugin.name}
        </Text>
      </View>
      <WebViewComponent
        source={{ html: htmlContent, baseUrl: serverUrl }}
        onMessage={handleMessage}
        style={{ flex: 1, backgroundColor: colors.background }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        originWhitelist={["*"]}
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      />
    </View>
  );
}
