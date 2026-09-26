import { useTranslation } from "react-i18next";
import { StatusPill } from "../admin/kit";
import { InstallButton, UpdateButton } from "./PluginActionButtons";
import { usePluginAdmin } from "./PluginAdminContext";
import type { InstalledPlugin, MarketplacePlugin } from "./types";

interface CatalogEntryActionProps {
  entry: MarketplacePlugin;
  /** Le plugin tel qu'il est installé — la liste des installés fait foi, pas le drapeau du catalogue. */
  installed: InstalledPlugin | undefined;
  update: string | null;
}

/**
 * Le geste principal d'une entrée du catalogue, le même sur la carte et dans
 * la fiche : installer, mettre à jour, ou dire que c'est fait. L'état du
 * geste est celui du plugin (un seul, où qu'on l'ait lancé).
 */
export function CatalogEntryAction({ entry, installed, update }: CatalogEntryActionProps) {
  const { t } = useTranslation("adminPlugins");
  const { actions, locked } = usePluginAdmin();
  const state = actions.states.get(entry.pluginId);

  if (installed && update) {
    return (
      <UpdateButton
        name={installed.name}
        version={update}
        restarts={installed.restartsOn?.update ?? false}
        state={state}
        locked={locked}
        onUpdate={() => void actions.update(installed)}
      />
    );
  }
  if (installed) {
    return <StatusPill tone="success">{t("installedVersion", { version: installed.version })}</StatusPill>;
  }
  return (
    <InstallButton
      name={entry.name}
      thirdParty={!entry.official}
      sourceName={entry.sourceName}
      state={state}
      locked={locked}
      onInstall={() => void actions.install(entry)}
    />
  );
}
