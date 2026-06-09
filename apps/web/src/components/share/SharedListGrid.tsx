import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SharedListItem } from "@tentacle-tv/api-client";

interface Props {
  items: SharedListItem[];
  authed: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** Token courant — pour ouvrir la fiche détail publique /share/:token/:id. */
  token?: string;
}

/** Image d'affiche via le proxy public (visible aussi pour les anonymes). */
function posterUrl(item: SharedListItem): string {
  const tag = item.ImageTags?.Primary;
  const params = `fillHeight=450&quality=90${tag ? `&tag=${tag}` : ""}`;
  return `/api/jellyfin/Items/${item.Id}/Images/Primary?${params}`;
}

/**
 * Grille d'une liste partagée. Le clic sur la vignette ouvre la fiche détail
 * publique (résumé + bandes-annonces, sans saisons ni lecture). La sélection
 * (pour ajouter à sa liste) se fait via la case à cocher, connecté uniquement.
 */
export function SharedListGrid({ items, authed, selected, onToggle, token }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const openDetail = (id: string) => navigate(`/share/${token}/${id}`);

  return (
    <div className="grid grid-cols-2 gap-2.5 xs:grid-cols-3 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
      {items.map((item) => {
        const isSel = selected.has(item.Id);
        return (
          <div key={item.Id} className="group relative overflow-hidden rounded-xl bg-tentacle-surface">
            <button
              type="button"
              onClick={() => openDetail(item.Id)}
              className="block w-full text-left transition-transform hover:scale-[1.02]"
            >
              <div className="relative aspect-[2/3]">
                <img src={posterUrl(item)} alt={item.Name} loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="p-2">
                <p className="line-clamp-1 text-sm font-medium text-white">{item.Name}</p>
                {item.ProductionYear && <p className="text-xs text-white/45">{item.ProductionYear}</p>}
              </div>
            </button>

            {/* Case de sélection (connecté) — toggle sans ouvrir la fiche. */}
            {authed && (
              <button
                type="button"
                onClick={() => onToggle(item.Id)}
                aria-label={t("select")}
                aria-pressed={isSel}
                className={`absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  isSel ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-white/60 bg-black/45 text-transparent hover:text-white/50"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
