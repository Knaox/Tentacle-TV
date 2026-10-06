import { memo, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SetupHostInfo } from "@tentacle-tv/shared";
import { TabPanel, Tabs } from "../ui/Tabs";
import { codeHelpCommands, codeHelpTabs, initialCodeHelpTab, type CodeHelpTab } from "./codeHelpModel";
import { CodeHelpPanel, CodeLineHint } from "./CodeHelpPanels";

/**
 * « Où trouver le code ? » — un onglet par façon de lire le journal du
 * serveur (ligne de commande, Portainer, Compose, NAS, installation native),
 * celui qui s'ouvre d'abord étant le plus probable. Ouvert d'office, sauf si le
 * code est déjà venu du lien.
 */
interface CodeHelpProps {
  /** `undefined` : réponse attendue ; `null` : serveur muet (tous les chemins). */
  host: SetupHostInfo | null | undefined;
  defaultOpen: boolean;
}

export const CodeHelp = memo(function CodeHelp({ host, defaultOpen }: CodeHelpProps) {
  const { t } = useTranslation("setupWizard");
  const idPrefix = useId();
  const [chosen, setChosen] = useState<CodeHelpTab | null>(null);
  const tabs = codeHelpTabs(host);
  const active = chosen && tabs.includes(chosen) ? chosen : initialCodeHelpTab(host);
  const containerId = host?.containerId ?? null;
  const commands = codeHelpCommands(containerId, t("codeHelp_containerPlaceholder"));
  const items = tabs.map((id) => ({ id, label: t(`codeHelp_tab_${id}`) }));

  return (
    <details open={defaultOpen} className="rounded-xl border border-line-subtle bg-fill-faint px-4 py-3 text-sm leading-relaxed text-content-secondary">
      <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-content-primary">{t("codeWhereTitle")}</summary>
      <div className="space-y-4 pb-1">
        <p>{t("codeHelp_intro")}</p>
        {containerId ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t("codeHelp_containerId")}</span>
            <code className="rounded-md border border-[rgba(var(--brand-rgb),0.35)] bg-[var(--brand-soft)] px-2 py-0.5 font-mono text-[var(--brand-light)]">
              {containerId}
            </code>
          </p>
        ) : null}
        <Tabs idPrefix={idPrefix} label={t("codeWhereTitle")} items={items} active={active} onChange={setChosen} className="flex-wrap" />
        {tabs.map((id) => (
          <TabPanel key={id} idPrefix={idPrefix} id={id} active={id === active} className="space-y-3">
            <CodeHelpPanel tab={id} commands={commands} containerId={containerId} />
          </TabPanel>
        ))}
        <div className="space-y-2 border-t border-line-subtle pt-3 text-xs text-content-tertiary">
          <CodeLineHint />
          <p>{t("codeWhereFile")}</p>
        </div>
      </div>
    </details>
  );
});
