import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMyShareLink, useCreateShareLink, useRevokeShareLink } from "@tentacle-tv/api-client";

interface Props {
  onClose: () => void;
}

/**
 * Modal « Partager ma liste » — génère / copie / partage / révoque le lien.
 * Le lien pointe vers la page publique /share/:token (même origine web).
 */
export function ShareLinkModal({ onClose }: Props) {
  const { t } = useTranslation("common");
  const { data, isLoading } = useMyShareLink();
  const createLink = useCreateShareLink();
  const revoke = useRevokeShareLink();
  const [copied, setCopied] = useState(false);

  const token = createLink.data?.token ?? data?.token ?? null;
  const url = token ? `${window.location.origin}/share/${token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponible */ }
  };

  const share = async () => {
    if (typeof navigator.share === "function") {
      await navigator.share({ url, title: t("common:shareMyList") }).catch(() => {});
    } else {
      copy();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/12 bg-[#12121a]/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-bold text-white">{t("common:shareMyList")}</h2>
        <p className="mt-1 text-sm text-white/55">{t("common:shareLinkDescription")}</p>

        {isLoading ? (
          <div className="mt-5 h-11 animate-pulse rounded-lg bg-white/5" />
        ) : token ? (
          <>
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5">
              <span className="flex-1 truncate text-sm text-white/80">{url}</span>
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
              >
                {copied ? t("common:linkCopied") : t("common:copyLink")}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => revoke.mutate(undefined, { onSuccess: onClose })}
                disabled={revoke.isPending}
                className="text-sm font-medium text-red-400/90 transition-colors hover:text-red-300 disabled:opacity-50"
              >
                {t("common:revokeLink")}
              </button>
              <button
                type="button"
                onClick={share}
                className="rounded-md bg-[rgba(var(--brand-rgb),0.22)] px-4 py-2 text-sm font-semibold text-white ring-1 ring-[rgba(var(--brand-rgb),0.4)] transition-transform hover:scale-[1.03]"
              >
                {t("common:shareAction")}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => createLink.mutate()}
            disabled={createLink.isPending}
            className="mt-5 w-full rounded-lg bg-[rgba(var(--brand-rgb),0.22)] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-[rgba(var(--brand-rgb),0.4)] transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {t("common:generateLink")}
          </button>
        )}
      </div>
    </div>
  );
}
