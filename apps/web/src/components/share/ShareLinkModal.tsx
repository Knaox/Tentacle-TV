import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";
import { useMyShareLink, useCreateShareLink, useRevokeShareLink, type ShareListKind } from "@tentacle-tv/api-client";
import { useToast } from "../../contexts/ToastContext";
import { canShareNatively, shareListUrl, shareNatively } from "../../lib/share";
import { Modal } from "../ui/Modal";
import { ModalHeader } from "../ui/ModalHeader";
import { ShareLinkField } from "./ShareLinkField";

interface Props {
  onClose: () => void;
  /** Liste partagée : watchlist (défaut) ou titres likés (favoris). */
  kind?: ShareListKind;
}

/**
 * Modal « Partager ma liste » — génère / copie / partage / révoque le lien.
 * Le lien pointe vers la page publique /share/:token (`shareListUrl`).
 *
 * Posée sur la primitive `Modal` : Échap, bouton de fermeture, focus piégé
 * puis rendu au bouton d'origine, et un portail — dessinée en place, sous le
 * panneau d'outils de Ma liste, un `position: fixed` peut se caler sur un
 * parent transformé au lieu de l'écran. « Partager » n'apparaît que là où le
 * système a une feuille de partage : ailleurs (bureau, Firefox, Linux), il
 * doublait « Copier ».
 */
export function ShareLinkModal({ onClose, kind = "watchlist" }: Props) {
  const { t } = useTranslation("common");
  const toast = useToast();
  const titleId = useId();
  const { data, isLoading } = useMyShareLink(true, kind);
  const createLink = useCreateShareLink(kind);
  const revoke = useRevokeShareLink(kind);
  const title = t(kind === "likes" ? "shareMyFavorites" : "shareMyList");

  const token = createLink.data?.token ?? data?.token ?? null;
  const url = token ? shareListUrl(token) : "";

  const share = async () => {
    // Refermée : rien à dire. Refusée : le dire — « Copier » reste à côté.
    if ((await shareNatively({ url, title })) === "failed") toast.show("error", t("shareFailed"));
  };

  return (
    <Modal open onClose={onClose} labelledBy={titleId} maxWidth={448}>
      <ModalHeader
        title={title}
        subtitle={t(kind === "likes" ? "shareFavoritesLinkDescription" : "shareLinkDescription")}
        onClose={onClose}
        titleId={titleId}
      />
      <div className="px-6 pb-6 pt-5">
        {isLoading ? (
          <div className="h-12 animate-pulse rounded-lg bg-fill-subtle" />
        ) : token ? (
          <>
            <ShareLinkField url={url} />
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => revoke.mutate(undefined, { onSuccess: onClose })}
                disabled={revoke.isPending}
                className="-ml-2 min-h-9 rounded-md px-2 text-sm font-medium text-status-error-fg transition-colors hover:bg-danger-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
              >
                {t("revokeLink")}
              </button>
              {canShareNatively() && (
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[rgba(var(--brand-rgb),0.22)] px-4 text-sm font-semibold text-cta-brand-fg ring-1 ring-[rgba(var(--brand-rgb),0.4)] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                >
                  <Share2 aria-hidden className="h-4 w-4" />
                  {t("shareAction")}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => createLink.mutate()}
              disabled={createLink.isPending}
              className="w-full rounded-lg bg-[rgba(var(--brand-rgb),0.22)] px-4 py-2.5 text-sm font-semibold text-cta-brand-fg ring-1 ring-[rgba(var(--brand-rgb),0.4)] transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
            >
              {createLink.isPending ? t("loading") : t("generateLink")}
            </button>
            {createLink.isError && (
              <p role="alert" className="mt-3 text-center text-sm text-status-error-fg">
                {t("shareLinkError")}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
