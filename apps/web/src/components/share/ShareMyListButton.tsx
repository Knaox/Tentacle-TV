import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShareLinkModal } from "./ShareLinkModal";

interface Props {
  /** Liste partagée : « Ma liste » (défaut) ou les titres likés. */
  kind?: "watchlist" | "likes";
}

/**
 * Bouton « Partager ma liste » — ouvre le modal de lien de partage.
 *
 * Un geste SECONDAIRE, mais qu'on doit trouver sans le chercher : il était
 * gris sur gris (`fill-subtle`), sans liseré, et se fondait dans la rangée.
 * Il prend le ton de la marque — aplat opaque teinté de violet, liseré et
 * texte violets — sans le dégradé plein réservé à l'action principale d'un
 * écran. 32 px de haut, comme les pastilles et menus du panneau qui
 * l'accueille. `kind` et le modal n'ont pas changé : la page publique
 * `/share/:token` reçoit le même lien.
 */
export function ShareMyListButton({ kind = "watchlist" }: Props) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-[color:var(--surface-2)] bg-[linear-gradient(rgba(var(--brand-rgb),0.16),rgba(var(--brand-rgb),0.16))] px-3.5 text-xs font-semibold text-[var(--brand-light)] shadow-[var(--elev-1)] ring-1 ring-[rgba(var(--brand-rgb),0.5)] transition-colors hover:text-content-primary hover:ring-[rgba(var(--brand-rgb),0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)]"
      >
        <ShareIcon className="h-4 w-4" />
        {t(kind === "likes" ? "common:shareMyFavorites" : "common:shareMyList")}
      </button>
      {open && <ShareLinkModal kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    </svg>
  );
}
