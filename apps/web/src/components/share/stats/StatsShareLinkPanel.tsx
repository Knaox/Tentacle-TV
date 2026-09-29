import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Share2 } from "lucide-react";
import { openExternal } from "../../../lib/openExternal";
import { canShareNatively, shareListUrl, shareNatively } from "../../../lib/share";
import { ShareLinkField } from "../ShareLinkField";

interface Props {
  token: string;
  /** Révoque le lien ; rend la main une fois la réponse venue. */
  onRevoke: () => Promise<void>;
  revoking: boolean;
  /** La feuille du système a refusé : le panneau le dit, « Copier » reste là. */
  onShareFailed: () => void;
}

const SECONDARY =
  "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50";

/**
 * Le lien actif : le champ et son « Copier » (celui de Ma liste et de
 * Favoris, qui dit sa réussite ou son échec), la page publique à voir de ses
 * yeux, la feuille de partage du système quand il y en a une — puis la
 * révocation, à part, et confirmée : elle coupe le lien pour tous ceux qui
 * l'ont déjà reçu, et ne se défait pas.
 */
export function StatsShareLinkPanel({ token, onRevoke, revoking, onShareFailed }: Props) {
  const { t } = useTranslation("statsShare");
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);
  const url = shareListUrl(token);

  const share = async () => {
    // Refermée : rien à dire. Refusée : le dire — « Copier » reste à côté.
    if ((await shareNatively({ url, title: t("title") })) === "failed") onShareFailed();
  };

  return (
    <div>
      <ShareLinkField url={url} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void openExternal(url)}
          className={`${SECONDARY} bg-fill-soft text-content-primary hover:bg-fill-medium`}
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          {t("preview")}
        </button>
        {canShareNatively() && (
          <button
            type="button"
            onClick={share}
            className={`${SECONDARY} bg-[rgba(var(--brand-rgb),0.22)] text-cta-brand-fg ring-1 ring-[rgba(var(--brand-rgb),0.4)]`}
          >
            <Share2 aria-hidden className="h-4 w-4" />
            {t("shareLink")}
          </button>
        )}
      </div>

      <div className="mt-5 border-t border-line-subtle pt-4">
        {confirming ? (
          <div role="alertdialog" aria-labelledby={confirmId} className="rounded-xl bg-danger-surface p-4">
            <p id={confirmId} className="text-sm font-semibold text-content-primary">{t("revokeConfirmTitle")}</p>
            <p className="mt-1 text-[13px] leading-snug text-content-secondary">{t("revokeConfirmBody")}</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirming(false)}
                className={`${SECONDARY} bg-fill-soft text-content-primary hover:bg-fill-medium`}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={revoking}
                aria-busy={revoking || undefined}
                onClick={() => void onRevoke().finally(() => setConfirming(false))}
                className={`${SECONDARY} bg-status-error-bg text-status-error-fg hover:opacity-90`}
              >
                {t("revokeConfirm")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="-ml-2 min-h-10 cursor-pointer rounded-md px-2 text-sm font-medium text-status-error-fg transition-colors hover:bg-danger-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t("revoke")}
          </button>
        )}
      </div>
    </div>
  );
}
