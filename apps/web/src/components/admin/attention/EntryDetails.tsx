import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { LinkIssue } from "@tentacle-tv/shared";
import { AdminNotice } from "../kit";
import { JELLYFIN_SETUP_ANCHOR } from "../jellyfin/SetupChecklist";
import { SetupRows } from "../jellyfin/SetupRows";
import { LinkEndpointLine } from "../../serverLinks/LinkEndpointLine";
import { detailsKind, entryKeys, type EntryId } from "./attentionCopy";
import type { AttentionContext } from "./useAdminAttention";

/**
 * Ce qui se replie sous une entrée : une phrase technique, les adresses que
 * le serveur a sondées (lien public, lecture directe, dans les mots de
 * l'espace `serverLinks`), ou — pour Jellyfin — ce qui reste à régler, avec
 * les gestes en un clic de la liste complète.
 */

interface Props {
  id: EntryId;
  variant: string | null;
  items: readonly string[];
  context: AttentionContext;
  values: Record<string, string | number>;
}

export function EntryDetails({ id, variant, items, context, values }: Props) {
  const { t } = useTranslation(["adminOverview", "serverLinks"]);
  const kind = detailsKind(id);

  if (kind === "text") {
    return (
      <p className="max-w-3xl rounded-lg bg-fill-subtle px-3 py-2 text-xs leading-relaxed text-content-secondary">
        {t(entryKeys(id, variant, "details").map((key) => `adminOverview:${key}`), values)}
      </p>
    );
  }
  if (kind === "links") {
    const check = context.links?.find((candidate) => candidate.id === id);
    if (!check) return null;
    const filled = check.endpoints.some((endpoint) => endpoint.url);
    const endpoints = filled ? check.endpoints : check.endpoints.filter((endpoint) => endpoint.role === "tentacle");
    return (
      <div className="max-w-3xl space-y-2">
        {endpoints.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {endpoints.map((endpoint) => (
              <LinkEndpointLine key={endpoint.role} endpoint={endpoint} hideIssues={variant ? [variant as LinkIssue] : undefined} />
            ))}
          </div>
        ) : null}
        {check.notes.map((note) => (
          <p key={note} className="text-xs leading-relaxed text-content-tertiary">{t(`serverLinks:note_${note}`)}</p>
        ))}
      </div>
    );
  }
  return id === "jellyfin" ? <JellyfinDetails items={items} context={context} /> : null;
}

function JellyfinDetails({ items, context }: { items: readonly string[]; context: AttentionContext }) {
  const { t } = useTranslation(["adminOverview", "adminJellyfin"]);
  const report = context.setup;
  const todo = report ? report.checks.filter((check) => items.includes(`setup:${check.id}`)) : [];
  const dashboardHome = report?.dashboardUrl ? `${report.dashboardUrl}/web/#/dashboard` : null;
  const linkClass = "inline-flex min-h-[36px] items-center gap-1 rounded-lg text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

  return (
    <div className="overflow-hidden rounded-xl border border-line-subtle">
      {items.includes("restart") || items.includes("partial") ? (
        <div className="space-y-2 p-3">
          {items.includes("restart") ? (
            <AdminNotice
              tone="warning"
              action={dashboardHome ? (
                <a href={dashboardHome} target="_blank" rel="noreferrer" className={linkClass}>
                  {t("adminJellyfin:openDashboard")}
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> {t("adminOverview:opensNewTab")}</span>
                </a>
              ) : undefined}
            >
              {t("adminOverview:entry_jellyfin_restart")}
            </AdminNotice>
          ) : null}
          {items.includes("partial") ? (
            <AdminNotice tone="info" action={<Link to="/admin/services#compat" className={linkClass}>{t("adminOverview:entry_jellyfin_compatLink")}</Link>}>
              {t("adminOverview:entry_jellyfin_partial", { version: context.jellyfinVersion ?? "?" })}
            </AdminNotice>
          ) : null}
        </div>
      ) : null}
      {report && todo.length > 0 ? <SetupRows report={report} checks={todo} /> : null}
      <div className="border-t border-line-subtle px-5 py-2">
        <Link to={`/admin/services#${JELLYFIN_SETUP_ANCHOR}`} className={linkClass}>{t("adminOverview:entry_jellyfin_allSettings")}</Link>
      </div>
    </div>
  );
}
