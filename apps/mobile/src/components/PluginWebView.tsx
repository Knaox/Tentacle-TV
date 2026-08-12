import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { useActivePlugins, useMobilePluginNavItems, markPluginFailed, clearPluginFailed } from "@/hooks/useActivePlugins";
import { usePluginBundle, useSharedDeps } from "@/plugins/usePluginBundle";
import { buildPluginHtml } from "@/plugins/pluginHtmlTemplate";
import { createBridgeHandler } from "@/plugins/pluginBridge";
import { PluginLoadingOverlay } from "./PluginLoadingOverlay";
import { typography, FONT_FAMILY, RADIUS, useTheme, useResponsive } from "@/theme";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";

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
  const theme = useTheme();
  const { colors } = theme;
  const headerH = useHeaderHeight();
  /* Le cadre du plugin descend jusqu'au bord de l'écran ; la barre d'onglets
   * flotte dessus. On lui dit de combien, pour qu'il en écarte ce qu'il ancre
   * en bas. En rail (tablette paysage) la nav occupe sa propre colonne : elle
   * ne recouvre rien. */
  const tabBarH = useGlassTabBarHeight();
  const { isTablet, isLandscape } = useResponsive();
  const chromeBottom = Math.round(isTablet && isLandscape ? 0 : tabBarH);
  const chromeRef = useRef(chromeBottom);
  const webRef = useRef<{ injectJavaScript: (js: string) => void } | null>(null);
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

  // `theme` en dépendance : au switch clair/sombre la source HTML change et la
  // WebView remonte re-thémée (événement rare, remontage assumé).
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
      appTheme: theme,
      chromeBottom: chromeRef.current,
    });
  }, [navItem, bundleCode, sharedDepsCode, serverUrl, token, userRaw, lang, theme]);

  /* La hauteur suit l'appareil : l'inset bas d'un iPhone n'est pas le même en
   * portrait et en paysage. On la RÉINJECTE plutôt que de la mettre dans les
   * dépendances du HTML — une rotation remonterait sinon la WebView entière,
   * et le plugin repartirait du haut de sa page. */
  useEffect(() => {
    chromeRef.current = chromeBottom;
    webRef.current?.injectJavaScript(
      `document.documentElement.style.setProperty('--tentacle-chrome-bottom','${chromeBottom}px');true;`,
    );
  }, [chromeBottom]);

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
      <View style={{ flex: 1, backgroundColor: colors.surface.s0, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.text.secondary, textAlign: "center", marginBottom: 16 }}>
          {te("pluginLoadFailed") ?? "Plugin crashed"}
        </Text>
        <TouchableOpacity
          onPress={handleRetry}
          activeOpacity={0.88}
          style={{
            paddingHorizontal: 24, paddingVertical: 12, minHeight: 44,
            backgroundColor: colors.cta.primaryBg, borderRadius: RADIUS.md,
            alignItems: "center", justifyContent: "center",
            shadowColor: colors.brand.violet,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.45,
            shadowRadius: 18,
            elevation: 8,
          }}
        >
          <Text style={{ ...typography.body, fontFamily: FONT_FAMILY.bold, color: colors.cta.primaryFg, letterSpacing: 0.1 }}>
            {tc("retry") ?? "Réessayer"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!navItem && !pluginsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.s0, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.text.tertiary, textAlign: "center" }}>
          {tc("noPlugins")}
        </Text>
      </View>
    );
  }

  if (bundleError || depsError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.s0, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.text.secondary, textAlign: "center" }}>
          {te("pluginLoadFailed") ?? "Failed to load plugin"}
        </Text>
      </View>
    );
  }

  const WebViewComponent = getWebView();
  if (!WebViewComponent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.s0, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ ...typography.body, color: colors.text.secondary, textAlign: "center" }}>
          {te("webViewNotAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.s0, paddingTop: headerH }}>
      {htmlContent ? (
        <WebViewComponent
          key={navKey}
          ref={webRef as never}
          source={{ html: htmlContent, baseUrl: serverUrl }}
          onMessage={handleMessage}
          style={{ flex: 1, backgroundColor: colors.surface.s0 }}
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
