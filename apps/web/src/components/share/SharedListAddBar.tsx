import { useTranslation } from "react-i18next";
import type { ShareListKind } from "@tentacle-tv/api-client";

/**
 * Marge de la zone sûre, en style en ligne et non en classe : Tailwind génère
 * ses classes pour TOUTES les cibles, téléviseur compris, et `max()` n'existe
 * pas sous Chrome 53 (la garde de compatibilité webOS refuse la classe).
 */
const SAFE_BOTTOM = { paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" } as const;

interface Props {
  kind: ShareListKind;
  count: number;
  isAdding: boolean;
  added: boolean;
  onAdd: () => void;
}

/**
 * Barre flottante (connecté) : ajoute les titres cochés à SA liste — Ma liste
 * pour une liste partagée, les favoris pour des titres likés. Le libellé dit
 * enfin où partent les titres (il annonçait « ma liste » dans les deux cas).
 *
 * Montée seulement quand elle sert : son verre ne coûte rien le reste du temps.
 */
export function SharedListAddBar({ kind, count, isAdding, added, onAdd }: Props) {
  const { t } = useTranslation("share");
  if (count === 0 && !added) return null;
  const likes = kind === "likes";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4" style={SAFE_BOTTOM}>
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-4 rounded-full border border-line-strong bg-surface-toolbar py-2 pl-5 pr-2 shadow-2xl backdrop-blur-lg animate-fade-slide-up"
      >
        <span className="text-sm font-medium tabular-nums text-content-secondary">
          {added && count === 0
            ? t(likes ? "addedFavorites" : "addedWatchlist")
            : t("selectedCount", { count })}
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={isAdding || count === 0}
          aria-busy={isAdding || undefined}
          className="h-10 cursor-pointer rounded-full px-5 text-sm font-bold text-cta-brand-fg transition-transform duration-150 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100 motion-reduce:hover:scale-100"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        >
          {isAdding ? t("adding") : t(likes ? "addToFavorites" : "addToWatchlist")}
        </button>
      </div>
    </div>
  );
}
