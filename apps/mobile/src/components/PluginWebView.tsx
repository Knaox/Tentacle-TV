import { useMemo, useCallback, useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { useActivePlugins, useMobilePluginNavItems, markPluginFailed, clearPluginFailed } from "@/hooks/useActivePlugins";
import { usePluginBundle, useSharedDeps } from "@/plugins/usePluginBundle";
import { buildPluginHtml } from "@/plugins/pluginHtmlTemplate";
import { createBridgeHandler } from "@/plugins/pluginBridge";
import { PluginLoadingOverlay } from "./PluginLoadingOverlay";
import { colors, typography } from "@/theme";

function getWebView(): typeof import("react-native-webview").WebView | null {
  try {
    return require("react-native-webview").WebView;
  } catch {
    return null;
  }
}

interface PluginWebViewProps {
  navItemIndex: number;
}

export function PluginWebView({ navItemIndex }: PluginWebViewProps) {
  const router = useRouter();
  const { storage } = useTentacleConfig();
  const { i18n, t: tc } = useTranslation("common");
  const { t: te } = useTranslation("errors");
  const { isLoading: pluginsLoading } = useActivePlugins();
  const navItems = useMobilePluginNavItems();

  const navItem = navItems[navItemIndex];
  const { data: bundleCode, error: bundleError } = usePluginBundle(navItem?.pluginId);
  const { data: sharedDepsCode, error: depsError } = useSharedDeps();

  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";
  const userRaw = storage.getItem("tentacle_user") ?? "";
  const lang = i18n.language ?? "fr";

  const [webViewReady, setWebViewReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [webViewError, setWebViewError] = useState<string | null>(null);

  // Reset states when navItem changes (retry implicite)
  const navKey = navItem ? `${navItem.pluginId}-${navItem.path}` : "";
  useEffect(() => {
    setWebViewReady(false);
    setShowOverlay(true);
    setWebViewError(null);
    if (navItem?.pluginId) clearPluginFailed(navItem.pluginId);
  }, [navKey]);

  const htmlContent = useMemo(() => {
    if (!navItem || !bundleCode || !sharedDepsCode) return null;
    return buildPluginHtml({
      backendUrl: serverUrl,
      token,
      userJson: userRaw,
      lang,
      bundleCode,
      sharedDepsCode,
      pluginPath: navItem.path,
    });
  }, [navItem, bundleCode, sharedDepsCode, serverUrl, token, userRaw, lang]);

  // Timeout 15s : si la WebView ne répond jamais, on retire l'overlay
  useEffect(() => {
    if (webViewReady || !htmlContent) return;
    const timer = setTimeout(() => {
      console.warn("[PluginWebView] Timeout 15s — dismissing overlay");
      setWebViewReady(true);
    }, 15_000);
    return () => clearTimeout(timer);
  }, [webViewReady, htmlContent, navKey]);

  const onReady = useCallback(() => {
    setWebViewReady(true);
  }, []);

  const onBridgeError = useCallback((msg: string) => {
    setWebViewReady(true);
    setWebViewError(msg);
    if (navItem?.pluginId) markPluginFailed(navItem.pluginId);
  }, [navItem?.pluginId]);

  const handleMessage = useCallback(
    createBridgeHandler(router, onReady, onBridgeError),
    [router, onReady, onBridgeError],
  );

  const handleRetry = useCallback(() => {
    setWebViewError(null);
    setWebViewReady(false);
    setShowOverlay(true);
    if (navItem?.pluginId) clearPluginFailed(navItem.pluginId);
  }, [navItem?.pluginId]);

  if (webViewError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: 16 }}>
          {te("pluginLoadFailed") ?? "Plugin crashed"}
        </Text>
        <TouchableOpacity
          onPress={handleRetry}
          style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 8 }}
        >
          <Text style={{ ...typography.body, color: "#fff" }}>
            {tc("retry") ?? "Réessayer"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!navItem && !pluginsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center" }}>
          {tc("noPlugins")}
        </Text>
      </View>
    );
  }

  if (bundleError || depsError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}>
          {te("pluginLoadFailed") ?? "Failed to load plugin"}
        </Text>
      </View>
    );
  }

  const WebViewComponent = getWebView();
  if (!WebViewComponent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}>
          {te("webViewNotAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {htmlContent ? (
        <WebViewComponent
          key={navKey}
          source={{ html: htmlContent, baseUrl: serverUrl }}
          onMessage={handleMessage}
          style={{ flex: 1, backgroundColor: colors.background }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          originWhitelist={["*"]}
        />
      ) : null}
      {showOverlay && (
        <PluginLoadingOverlay
          visible={!webViewReady}
          label={navItem?.label ?? ""}
          onHidden={() => setShowOverlay(false)}
        />
      )}
    </View>
  );
}
