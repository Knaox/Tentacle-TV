import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Share2 } from "lucide-react";
import { useCreateShareLink } from "@tentacle-tv/api-client";
import { getBackendBase } from "../../../lib/backendBase";

/**
 * « Partager ma liste » (`watchlist/ShareMyListButton` de l'app) : pilule
 * `fill.subtle` au filet fin, icône 15 `brand.light`, 13 semi-gras, 8 × 14.
 * Crée le lien (page publique `/share/:token`) et ouvre la feuille de partage
 * du système ; sans elle, le lien part dans le presse-papiers et le bouton
 * dit « Copié ! » un instant.
 */
export function ShareMyListButton() {
  const { t } = useTranslation("common");
  const create = useCreateShareLink();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { token } = await create.mutateAsync();
      // Même origine que le lien du bureau (`ShareLinkModal`) : le serveur public, sinon cette page.
      const origin = getBackendBase().replace(/\/$/, "") || window.location.origin;
      const url = `${origin}/share/${token}`;
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ url });
          return;
        } catch (e) {
          // Annulé par l'utilisateur : fini. Refusé (le geste a expiré pendant
          // la création du lien, Safari) : le presse-papiers prend le relais.
          if ((e as Error).name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* partage annulé, ou presse-papiers refusé : rien à signaler */
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={busy}
      aria-label={t("shareMyList")}
      className="flex items-center gap-[7px] rounded-full border border-line-subtle bg-fill-subtle px-3.5 py-2 active:opacity-70"
      style={{ borderWidth: 0.5 }}
    >
      {copied ? <Check size={15} className="text-brand-light" aria-hidden /> : <Share2 size={15} className="text-brand-light" aria-hidden />}
      <span className="text-[13px] font-semibold text-content-primary">{copied ? t("linkCopied") : t("shareMyList")}</span>
    </button>
  );
}
