import { PluginWebView } from "@/components/PluginWebView";
import { useMobilePluginNavItems } from "@/hooks/useActivePlugins";

// Provisoire : l'emplacement par index survit jusqu'à l'onglet unique des extensions.
export default function PluginsTab() {
  const item = useMobilePluginNavItems()[0];
  return <PluginWebView pluginId={item?.pluginId ?? ""} path={item?.path ?? ""} label={item?.label ?? ""} />;
}
