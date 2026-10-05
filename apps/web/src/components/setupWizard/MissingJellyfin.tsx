import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import type { MissingJellyfinGuide } from "@tentacle-tv/shared";
import { CopyBlock } from "../remoteAccess/CopyBlock";

const linkCls = "inline-flex items-center gap-1 font-semibold text-content-primary underline underline-offset-4 hover:opacity-80";

/**
 * Pas de Jellyfin : l'assistant n'installe rien. Il montre la commande
 * officielle (Debian, Ubuntu), le guide officiel (autres systèmes), ou la pile
 * Docker complète — et vérifie de lui-même que Jellyfin répond.
 */
export function MissingJellyfin({ guide, waiting }: { guide: MissingJellyfinGuide; waiting: boolean }) {
  const { t } = useTranslation("setupWizard");
  return (
    <div className="space-y-3 rounded-xl border border-line-subtle bg-fill-faint p-4 text-sm leading-relaxed text-content-secondary">
      <p className="font-semibold text-content-primary">{t("jfMissingTitle")}</p>
      {guide.kind === "command" ? (
        <>
          <CopyBlock label={t("jfMissingCommand", { os: guide.os })} code={guide.command} />
          <a href={guide.docsUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
            {t("jfDocsLink")}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </>
      ) : guide.kind === "docs" ? (
        <p>
          {t("jfMissingDocs")}{" "}
          <a href={guide.docsUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
            {t("jfDocsLink")}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </p>
      ) : (
        <p>
          {t("jfMissingCompose")}{" "}
          <a href={guide.docsUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
            {t("jfComposeLink")}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </p>
      )}
      {waiting ? <p className="text-xs text-content-tertiary" aria-live="polite">{t("jfMissingWaiting")}</p> : null}
    </div>
  );
}
