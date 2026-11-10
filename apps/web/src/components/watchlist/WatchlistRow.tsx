import { memo } from "react";
import { useTranslation } from "react-i18next";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CheckIcon as Check } from "@phosphor-icons/react/dist/csr/Check";
import { CircleNotchIcon as Loader2 } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { PlayIcon as Play } from "../icons/transport";
import { useCardMarkers, useJellyfinClient, useToggleWatchlistForItem } from "@tentacle-tv/api-client";
import { formatDuration, type MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "../MediaContextMenu";
import { useCardContextMenu } from "../cards/useCardContextMenu";
import { FadeImage } from "../ui/FadeImage";
import { itemImageColor } from "../../lib/itemImageColor";
import { WatchProgressLine, shownWatchStage } from "./WatchProgressLine";

interface WatchlistRowProps {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  playPending: boolean;
  onRemoved: (item: MediaItem) => void;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

/**
 * Une ligne de la vue liste de Ma liste : affiche, titre, métadonnées, où l'on
 * en est, et les deux gestes de la page — Lire et Retirer — TOUJOURS visibles.
 * Sur la grille, ces gestes n'apparaissent qu'au survol ; la liste est la vue
 * du tactile et du clavier.
 *
 * Toute la ligne ouvre la fiche : un bouton étiré sous le contenu, et les
 * actions posées au-dessus. Pas de boutons imbriqués dans un bouton.
 *
 * Le survol est un calque en fondu d'OPACITÉ, pas une couleur de fond animée
 * (CLAUDE.md, coût GPU, règle 3).
 *
 * Refonte de nov. 2026 : la ligne est une tuile à l'encre 1, sans liseré ; cochée, le fond
 * doux et le trait de la teinte franche. L'affiche paraît sur sa couleur, en UN fondu
 * (`FadeImage`). « Vu » se lit par les marqueurs (`useCardMarkers`) : le geste en cours —
 * depuis le menu contextuel — change « Terminé » et « Reprendre » sans attendre le serveur.
 */
export const WatchlistRow = memo(function WatchlistRow({
  item, onOpen, onPlay, playPending, onRemoved, selecting, selected, onToggleSelect,
}: WatchlistRowProps) {
  const { t } = useTranslation("watchlist");
  const { t: tc } = useTranslation("common");
  const client = useJellyfinClient();
  const { remove } = useToggleWatchlistForItem(item);
  // Le clic droit des cartes de la grille, repris tel quel : la vue liste ne
  // doit rien retirer de ce que la grille offre.
  const ctx = useCardContextMenu();
  const poster = client.getImageUrl(item.Id, "Primary", { height: 240, quality: 85 });
  // Les marqueurs, pas `item.UserData` : le geste en cours passe devant le cache.
  const markers = useCardMarkers(item, { communityRating: null });
  const watched = markers.statuses.includes("watched");
  const stage = shownWatchStage(item, watched);

  const meta = [
    item.ProductionYear ? String(item.ProductionYear) : null,
    item.Type === "Movie" ? tc("movie") : tc("series"),
    item.Type === "Movie" ? formatDuration(item.RunTimeTicks) : null,
    (item.Genres ?? []).slice(0, 2).join(", ") || null,
  ].filter(Boolean);

  // Annoncé AU GESTE, pas au succès : le retrait est optimiste, la ligne se
  // démonte aussitôt — et React Query ne rappelle pas le `onSuccess` d'un
  // `mutate` dont l'observateur a disparu. En cas d'échec, le cache se
  // restaure et « Annuler » ne fait que confirmer la présence du titre.
  const handleRemove = () => {
    remove.mutate();
    onRemoved(item);
  };

  return (
    <div
      className={`group/row relative flex items-center gap-3 rounded-tile p-2.5 sm:gap-4 sm:p-3 ${
        selected ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-surface-1"
      }`}
      {...(selecting ? {} : ctx.contextHandlers)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-tile bg-fill-faint opacity-0 transition-opacity duration-hover group-hover/row:opacity-100"
      />
      <button
        type="button"
        onClick={() => {
          if (selecting) onToggleSelect(item.Id);
          else if (!ctx.ctxMenu) onOpen(item);
        }}
        aria-label={selecting ? item.Name : `${item.Name} — ${t("openDetail")}`}
        aria-pressed={selecting ? selected : undefined}
        className="absolute inset-0 z-[1] cursor-pointer rounded-tile focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      />

      {selecting && (
        <span aria-hidden data-checked={selected} className="ui-check relative">
          <Check weight="bold" size={13} />
        </span>
      )}

      <FadeImage
        src={poster}
        alt=""
        color={itemImageColor(item, "Primary", item.ImageTags?.Primary)}
        className="aspect-[2/3] w-14 shrink-0 rounded-field sm:w-16"
      />

      <div className="relative min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-content-primary">{item.Name}</h3>
        <p className="mt-0.5 truncate text-xs tabular-nums text-content-tertiary">{meta.join(" · ")}</p>
        <div className="mt-2">
          <WatchProgressLine item={item} watched={watched} />
        </div>
      </div>

      {!selecting && (
        <div className="relative z-[2] flex shrink-0 items-center gap-2">
          {/* Une action de lecture par LIGNE : la pilule neutre — le dégradé du logo reste à
              l'action de lecture unique d'un écran (la fiche). */}
          <button
            type="button"
            onClick={() => onPlay(item)}
            disabled={playPending}
            aria-label={t("playTitle", { title: item.Name })}
            className={`btn btn-solid px-3 sm:px-[18px] ${playPending ? "cursor-wait" : ""}`}
          >
            {playPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />}
            <span className="hidden sm:inline">{stage === "inProgress" ? t("resume") : t("play")}</span>
          </button>
          {/* Le signet PLEIN, à la teinte franche : le titre EST dans la liste, le presser l'en
              retire — la bascule des cartes et de la fiche, toujours visible ici. */}
          <button
            type="button"
            onClick={handleRemove}
            disabled={remove.isPending}
            // `data-on` et non `aria-pressed` : le nom du bouton dit déjà le geste (« Retirer… »).
            data-on="true"
            aria-label={t("removeTitle", { title: item.Name })}
            title={t("remove")}
            className="icon-btn btn-soft"
          >
            <BookmarkSimpleIcon size={18} weight="fill" aria-hidden />
          </button>
        </div>
      )}

      {!selecting && ctx.ctxMenu && (
        <MediaContextMenu
          item={item}
          x={ctx.ctxMenu.x}
          y={ctx.ctxMenu.y}
          onClose={ctx.closeCtxMenu}
        />
      )}
    </div>
  );
});
