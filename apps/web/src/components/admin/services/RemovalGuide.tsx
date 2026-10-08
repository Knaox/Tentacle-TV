import { memo, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "../../ui/Tabs";
import { panelDomId, tabDomId } from "../../ui/tabsKeyboard";
import { CopyBlock } from "../../remoteAccess/CopyBlock";
import { AdminNotice } from "../kit";
import type { DatabaseMigrationSummary } from "./databaseMigrationApi";

/**
 * Comment RETIRER MariaDB, une fois la migration confirmée : un onglet par
 * installation, celle que le serveur a détectée en premier (sans parler à
 * Docker), les autres à côté — dans le doute, tous. Tentacle ne retire rien
 * lui-même ; pour une base externe, la commande de suppression est donnée à
 * copier, jamais exécutée.
 */
type Tab = "officialStack" | "compose" | "portainer" | "synology" | "unraid" | "casaos" | "external";

const ORDER: Record<string, Tab[]> = {
  "official-stack": ["officialStack", "compose", "portainer", "synology", "unraid", "casaos", "external"],
  "compose-service": ["compose", "portainer", "synology", "unraid", "casaos", "officialStack", "external"],
  external: ["external", "compose", "portainer", "synology", "unraid", "casaos", "officialStack"],
  unknown: ["compose", "portainer", "synology", "unraid", "casaos", "officialStack", "external"],
};

export const RemovalGuide = memo(function RemovalGuide({ summary }: { summary: DatabaseMigrationSummary }) {
  const { t } = useTranslation("adminDatabaseMigration");
  const idPrefix = useId();
  const tabs = ORDER[summary.removal.kind] ?? ORDER.unknown;
  const [active, setActive] = useState<Tab>(tabs[0]);
  const service = summary.removal.dbService ?? "db";

  return (
    <div className="max-w-3xl space-y-3">
      <AdminNotice tone="info">{t("guideWarning")}</AdminNotice>
      <Tabs idPrefix={idPrefix} label={t("tabsLabel")} items={tabs.map((id) => ({ id, label: t(`tab_${id}`) }))} active={active} onChange={setActive} />
      <div role="tabpanel" id={panelDomId(idPrefix, active)} aria-labelledby={tabDomId(idPrefix, active)} className="space-y-3">
        <p className="text-sm leading-relaxed text-content-secondary">{t(`guide_${active}`, { service })}</p>
        {/* La commande vient du serveur, échappée par lui ; le web n'en construit jamais. */}
        {active === "external" && summary.removal.dropCommand ? <CopyBlock label="SQL" code={summary.removal.dropCommand} /> : null}
      </div>
    </div>
  );
});
