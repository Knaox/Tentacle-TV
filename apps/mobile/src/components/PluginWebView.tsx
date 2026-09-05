import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { useActivePlugins } from "@/hooks/useActivePlugins";
import { usePluginBundle, useSharedDeps } from "@/plugins/usePluginBundle";
import { buildPluginHtml } from "@/plugins/pluginHtmlTemplate";
import { createBridgeHandler } from "@/plugins/pluginBridge";
import { PluginLoadingOverlay } from "./PluginLoadingOverlay";
import { typography, FONT_FAMILY, RADIUS, useTheme, useResponsive } from "@/theme";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";
import { useScrollChromeSetter } from "@/components/navigation/scrollChrome";

function getWebView(): typeof import("react-native-webview").WebView | null {
  try {
    return require("react-native-webview").WebView;
  } catch {
    return null;
  }
}

interface PluginWebViewProps {
  /** Identifiant du plugin (`seer`…) : la WebView n'existe que s'il est actif. */
  pluginId: string;
  /** Route du plugin à ouvrir (`/discover`…), telle que publiée par son manifeste. */
  path: string;
  /** Libellé déjà localisé, affiché par l'overlay de chargement. */
  label: string;
  /**
   * Vrai (défaut) : le cadre se décale du header flottant. Faux quand le
   * parent a déjà réservé cette place (bandeau de sections au-dessus).
   */
  padTop?: boolean;
  /**
   * Vrai (défaut) : le défilement de la page replie et redéploie le chrome
   * natif, comme un onglet. Faux pour un volet inactif, qui reste monté mais
   * ne doit pas parler au nom de la section affichée.
   */
  controlsChrome?: boolean;
}

export function PluginWebView({ pluginId, path, label, padTop = true, controlsChrome = true }: PluginWebViewProps) {
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
  const { data: plugins, isLoading: pluginsLoading } = useActivePlugins();

  // Le chrome suit le défilement de la page (message SCROLL_CHROME) — seul le
  // volet actif y a droit ; hors des onglets, le setter est nul : no-op.
  const setChrome = useScrollChromeSetter();
  const controlsRef = useRef(controlsChrome);
  controlsRef.current = controlsChrome;
  const onScrollChrome = useCallback(
    (collapsed: boolean) => { if (controlsRef.current) setChrome?.(collapsed); },
    [setChrome],
  );
  // Le natif vient de redéployer le chrome (focus, volet activé) : la page se
  // réaligne, sinon elle croirait le chrome encore replié.
  const resetPageChrome = useCallback(() => {
    webRef.current?.injectJavaScript("window.__tentacleScrollChrome && window.__tentacleScrollChrome.reset(); true;");
  }, []);
  useFocusEffect(resetPageChrome);
  useEffect(() => { if (controlsChrome) resetPageChrome(); }, [controlsChrome, resetPageChrome]);

  // Le plugin est adressé par son identifiant : un emplacement par index
  // n'est pas une identité (l'ordre des pages change avec le manifeste).
  const plugin = plugins?.find((p) => p.pluginId === pluginId);
  const { data: bundleCode, error: bundleError } = usePluginBundle(plugin ? pluginId : undefined);
  const { data: sharedDepsCode, error: depsError } = useSharedDeps();

  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";
  const userRaw = storage.getItem("tentacle_user") ?? "";
  const lang = i18n.language ?? "fr";

  const [webViewReady, setWebViewReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [webViewError, setWebViewError] = useState<string | null>(null);

  // Remise à zéro quand la page adressée change (retry implicite)
  const navKey = `${pluginId}:${path}`;
  useEffect(() => {
    setWebViewReady(false);
    setShowOverlay(true);
    setWebViewError(null);
  }, [navKey]);

  // `theme` en dépendance : au switch clair/sombre la source HTML change et la
  // WebView recharge sa page re-thémée (événement rare, rechargement assumé).
  const htmlContent = useMemo(() => {
    if (!plugin || !bundleCode || !sharedDepsCode) return null;
    return buildPluginHtml({
      backendUrl: serverUrl,
      token,
      userJson: userRaw,
      lang,
      bundleCode,
      sharedDepsCode,
      pluginPath: path,
      appTheme: theme,
      chromeBottom: chromeRef.current,
    });
  }, [plugin, path, bundleCode, sharedDepsCode, serverUrl, token, userRaw, lang, theme]);

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

  // Un plugin qui plante garde sa place (onglet, section) : le cadre montre
  // l'erreur et « Réessayer » — le retirer de la navigation démonterait ce
  // cadre et laisserait l'utilisateur sans recours jusqu'au redémarrage.
  const onBridgeError = useCallback((msg: string) => {
    setWebViewReady(true);
    setWebViewError(msg);
  }, []);

  const handleMessage = useMemo(
    () => createBridgeHandler(router, onReady, onBridgeError, onScrollChrome),
    [router, onReady, onBridgeError, onScrollChrome],
  );

  /* Android peut tuer le processus de rendu des WebViews (mémoire) : sans ce
   * crochet, chaque cadre resterait blanc en silence. On le traite comme un
   * plantage du plugin — message + Réessayer. */
  const onRenderGone = useCallback(() => {
    onBridgeError("render process gone");
  }, [onBridgeError]);

  const handleRetry = useCallback(() => {
    setWebViewError(null);
    setWebViewReady(false);
    setShowOverlay(true);
  }, []);

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

  // Plugin absent de la liste active (désactivé, désinstallé, ou pas encore chargé)
  if (!plugin && !pluginsLoading) {
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
    <View style={{ flex: 1, backgroundColor: colors.surface.s0, paddingTop: padTop ? headerH : 0 }}>
      {htmlContent ? (
        <WebViewComponent
          key={navKey}
          ref={webRef as never}
          source={{ html: htmlContent, baseUrl: serverUrl }}
          onMessage={handleMessage}
          onRenderProcessGone={onRenderGone}
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
          label={label}
          onHidden={() => setShowOverlay(false)}
        />
      )}
    </View>
  );
}
