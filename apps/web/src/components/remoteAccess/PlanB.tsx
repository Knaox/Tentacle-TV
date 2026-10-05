import { useTranslation } from "react-i18next";
import { ChevronDown, ExternalLink } from "lucide-react";
import { REMOTE_ACCESS_DOCS, REMOTE_ACCESS_GUIDE_ANCHOR, remoteAccessDocLabelKey, type RemoteAccessDoc } from "@tentacle-tv/shared";

const LINKS: readonly RemoteAccessDoc[] = ["tailscaleDownload", "tailscaleQuickstart", "jellyfinTailscale"];

/** Le plan B, replié : quand rien ne s'ouvre (CGNAT), un réseau privé — documenté, jamais intégré. */
export function PlanB({ showGuideLink }: { showGuideLink: boolean }) {
  const { t } = useTranslation("remoteAccess");
  const { t: tHelp } = useTranslation("remoteAccessHelp");
  return (
    <details className="group rounded-2xl border border-line-subtle bg-fill-faint">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-semibold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus [&::-webkit-details-marker]:hidden">
        {t("planBTitle")}
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-content-tertiary transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-content-secondary">
        <p>{t("planBBody")}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((doc) => (
            <li key={doc}>
              <a
                href={REMOTE_ACCESS_DOCS[doc]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-content-primary underline underline-offset-4 hover:opacity-80"
              >
                {tHelp(remoteAccessDocLabelKey(doc))}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        {showGuideLink ? (
          <p>
            <a href={`#${REMOTE_ACCESS_GUIDE_ANCHOR}`} className="font-semibold text-content-primary underline underline-offset-4 hover:opacity-80">
              {t("planBGuide")}
            </a>
          </p>
        ) : null}
      </div>
    </details>
  );
}
