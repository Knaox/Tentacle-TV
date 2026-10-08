import { memo, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { isCurrentStack, setupDocUrl } from "@tentacle-tv/shared";
import { Tabs } from "../../ui/Tabs";
import { panelDomId, tabDomId } from "../../ui/tabsKeyboard";
import { CopyBlock } from "../../remoteAccess/CopyBlock";
import { AdminNotice } from "../kit";
import type { DatabaseMigrationSummary } from "./databaseMigrationApi";
import { GuideSteps, GuideTitle } from "./GuideSteps";
import { OfficialStackGuide } from "./OfficialStackGuide";

/**
 * Comment RETIRER MariaDB, une fois la migration confirmée : un onglet par
 * installation, celle que le serveur a détectée en premier (sans parler à
 * Docker), les autres à côté — dans le doute, tous. Tentacle ne retire rien
 * lui-même ; les commandes (supprimer le fichier de l'ancien assistant, la base
 * externe) viennent du serveur, à copier, jamais exécutées.
 */
type Tab = "officialStack" | "compose" | "portainer" | "synology" | "unraid" | "casaos" | "external";

const ORDER: Record<string, Tab[]> = {
  "official-stack": ["officialStack", "compose", "portainer", "synology", "unraid", "casaos", "external"],
  "compose-service": ["compose", "portainer", "synology", "unraid", "casaos", "officialStack", "external"],
  external: ["external", "compose", "portainer", "synology", "unraid", "casaos", "officialStack"],
  unknown: ["compose", "portainer", "synology", "unraid", "casaos", "officialStack", "external"],
};

export const RemovalGuide = memo(function RemovalGuide({ summary }: { summary: DatabaseMigrationSummary }) {
  const { t, i18n } = useTranslation("adminDatabaseMigration");
  const idPrefix = useId();
  const removal = summary.removal;
  const tabs = ORDER[removal.kind] ?? ORDER.unknown;
  const [active, setActive] = useState<Tab>(tabs[0]);
  const service = removal.dbService ?? "db";

  return (
    <div className="max-w-3xl space-y-4">
      <AdminNotice tone="info">{t("guideWarning")}</AdminNotice>
      {removal.forgetCommand ? (
        <section className="space-y-2">
          <GuideTitle>{t("forgetTitle")}</GuideTitle>
          <p className="text-sm leading-relaxed text-content-secondary">{t(removal.containerized ? "forgetBody_container" : "forgetBody_native")}</p>
          <CopyBlock label="Shell" code={removal.forgetCommand} />
        </section>
      ) : null}
      <Tabs idPrefix={idPrefix} label={t("tabsLabel")} items={tabs.map((id) => ({ id, label: t(`tab_${id}`) }))} active={active} onChange={setActive} />
      <div role="tabpanel" id={panelDomId(idPrefix, active)} aria-labelledby={tabDomId(idPrefix, active)} className="space-y-3">
        {active === "officialStack" ? (
          <OfficialStackGuide newStack={isCurrentStack(removal.newStack) ? removal.newStack : null} service={service} />
        ) : (
          <GuideSteps text={t(`guide_${active}`, { service })} />
        )}
        {/* La commande vient du serveur, échappée par lui ; le web n'en construit jamais. */}
        {active === "external" && removal.dropCommand ? <CopyBlock label="SQL" code={removal.dropCommand} /> : null}
      </div>
      <a
        href={setupDocUrl("sqliteMigration", i18n.language)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80"
      >
        {t("fullGuide")}
      </a>
    </div>
  );
});
