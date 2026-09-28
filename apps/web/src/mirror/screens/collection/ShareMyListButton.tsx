import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Share2 } from "lucide-react";
import { useCreateShareLink, type ShareListKind } from "@tentacle-tv/api-client";
import { getBackendBase } from "../../../lib/backendBase";

/**
 * « Partager ma liste » ou « Partager mes titres likés »
 * (`watchlist/ShareMyListButton` de l'app) : pilule de 36 au ton de la
 * marque — aplat `brand.soft`, liseré `brand.glow`, icône et texte
 * `brand.light`. Repérable sous le titre sans être l'action principale (pas
 * de dégradé plein). Crée le lien (page publique `/share/:token`, la même
 * pour les deux listes) et ouvre la feuille de partage du système ; sans
 * elle, le lien part dans le presse-papiers et le bouton dit « Copié ! » un
 * instant.
 */
export function ShareMyListButton({ kind = "watchlist" }: { kind?: ShareListKind }) {
  const { t } = useTranslation("common");
  const create = useCreateShareLink(kind);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const label = t(kind === "likes" ? "shareMyFavorites" : "shareMyList");

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
      aria-label={label}
      className="flex min-h-[36px] items-center gap-[7px] rounded-full border px-3.5 transition-transform duration-100 active:scale-[0.97] active:opacity-80"
      style={{ background: "var(--brand-soft)", borderColor: "var(--brand-glow)" }}
    >
      {copied ? <Check size={15} className="text-brand-light" aria-hidden /> : <Share2 size={15} className="text-brand-light" aria-hidden />}
      <span className="whitespace-nowrap text-[13px] font-semibold text-brand-light">{copied ? t("linkCopied") : label}</span>
    </button>
  );
}
