import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import type { AdminAttention } from "@tentacle-tv/shared";
import { AdminSection, StatusPill } from "../kit";
import { AttentionEntry } from "./AttentionEntry";
import type { AttentionContext } from "./useAdminAttention";

/** Une entrée à régler n'a pas de sous-points : la même liste vide, pour que `memo` tienne. */
const NO_ITEMS: readonly string[] = [];

/**
 * Les deux familles de la vue d'ensemble, dans cet ordre : À RÉGLER (jamais
 * masquable), puis RECOMMANDATIONS — et, à leur pied, « N recommandations
 * masquées », qui les montre en retrait pour les rétablir. Chaque famille
 * n'existe que si elle a quelque chose à dire : jamais une pile de bandeaux.
 */
export function AttentionPanel({ attention, context }: { attention: AdminAttention; context: AttentionContext }) {
  const { t } = useTranslation("adminOverview");
  const [showHidden, setShowHidden] = useState(false);
  const hiddenListId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const hiddenCount = attention.hidden.length;
  const previousHidden = useRef(hiddenCount);

  useEffect(() => {
    // Masquée, la recommandation part avec son bouton : le focus passe au pied
    // qui la garde, au lieu de retomber en haut de la page.
    if (hiddenCount > previousHidden.current && (document.activeElement === document.body || document.activeElement === null)) {
      toggle.current?.focus();
    }
    previousHidden.current = hiddenCount;
    if (hiddenCount === 0) setShowHidden(false);
  }, [hiddenCount]);

  const recommendations = attention.recommendations;

  return (
    <>
      {attention.blocking.length > 0 ? (
        <AdminSection
          title={t("blockingTitle")}
          description={t("blockingDescription")}
          badges={<StatusPill tone="error" size="sm" dot={false}>{attention.blocking.length}</StatusPill>}
          flush
        >
          <ul className="divide-y divide-line-subtle">
            {attention.blocking.map((entry) => (
              <AttentionEntry key={entry.id} id={entry.id} variant={entry.variant} items={NO_ITEMS} family="blocking" context={context} />
            ))}
          </ul>
        </AdminSection>
      ) : null}

      {recommendations.length + hiddenCount > 0 ? (
        <AdminSection
          title={t("recommendationsTitle")}
          description={t("recommendationsDescription")}
          badges={recommendations.length > 0 ? <StatusPill tone="brand" size="sm" dot={false}>{recommendations.length}</StatusPill> : undefined}
          flush
        >
          {recommendations.length > 0 ? (
            <ul className="divide-y divide-line-subtle">
              {recommendations.map((entry) => (
                <AttentionEntry key={entry.id} id={entry.id} variant={entry.variant} items={entry.items} family="recommendation" hint={entry.hint} context={context} />
              ))}
            </ul>
          ) : null}
          {hiddenCount > 0 ? (
            <div className={recommendations.length > 0 ? "border-t border-line-subtle" : ""}>
              <button
                ref={toggle}
                type="button"
                aria-expanded={showHidden}
                aria-controls={hiddenListId}
                onClick={() => setShowHidden((value) => !value)}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm transition hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
              >
                <span className="text-content-tertiary">{t("hiddenCount", { count: hiddenCount })}</span>
                <span className="inline-flex items-center gap-1 font-medium text-content-secondary">
                  {showHidden ? t("hiddenCollapse") : t("hiddenShow")}
                  <ChevronDown size={14} aria-hidden="true" className={`transition-transform duration-200 ${showHidden ? "rotate-180" : ""}`} />
                </span>
              </button>
              {showHidden ? (
                <ul id={hiddenListId} aria-label={t("hiddenTitle")} className="divide-y divide-line-subtle border-t border-line-subtle bg-fill-faint">
                  {attention.hidden.map((entry) => (
                    <AttentionEntry
                      key={entry.id}
                      id={entry.id}
                      variant={entry.variant}
                      items={entry.items}
                      family="recommendation"
                      hint={entry.hint}
                      hidden
                      context={context}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </AdminSection>
      ) : null}
    </>
  );
}
