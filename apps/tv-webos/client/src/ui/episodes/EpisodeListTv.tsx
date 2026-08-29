import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeasons, useEpisodes, useJellyfinClient } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import { EpisodeRow } from "@/components/EpisodeRow";
import { EpisodeRowTv } from "./EpisodeRowTv";
import { giveFocus } from "../../focus/active";

/**
 * Saisons et épisodes, pour une télécommande.
 *
 * Remplace `components/EpisodeList.tsx`. Ce qui change tient en deux points, et
 * le reste — hooks, données, rendu d'une ligne — est celui du client web.
 *
 * **Chaque ligne devient atteignable**, enveloppée par `EpisodeRowTv`. C'est
 * l'objet de la substitution : la liste du web est le seul endroit du catalogue
 * où le D-pad ne pouvait rien viser.
 *
 * **Ce qui n'a pas de sens à trois mètres est retiré, pas masqué.** La sélection
 * multiple demande un mode, un curseur et une barre d'actions — trois niveaux de
 * navigation pour un geste d'administration. « Marquer la saison comme vue » et
 * les téléchargements relèvent du même registre. Aucun n'est compilé ici, ce qui
 * retire aussi leur code du fragment de la fiche.
 *
 * La bande des saisons n'est plus un `HorizontalScrollRow` : celui-ci pose un
 * `tabIndex` sur son conteneur de défilement, que `sansEnveloppes` neutralise
 * déjà — mais un conteneur simple laisse `bringIntoView` faire défiler la bande
 * jusqu'à la saison visée, ce dont une série de six saisons a besoin.
 *
 * **La révélation paresseuse est retirée, et c'est un correctif.** Le web
 * enveloppe chaque ligne dans un `RevealCell` qui réserve une hauteur en
 * attendant de monter son contenu. La réservation vaut 100 px là où une ligne
 * en fait près de 125 : une ligne jamais montée qui se révèle AU-DESSUS du
 * focus allonge donc le document en amont, et Chrome 53 n'a pas d'ancrage de
 * défilement pour compenser — tout ce qui suit descend, focus compris. Le
 * défaut ne se voyait qu'en remontant. Une saison compte dix à vingt-cinq
 * lignes, quand `RevealCell` est taillé pour des grilles de plusieurs
 * centaines de vignettes : on les monte toutes, la géométrie cesse de bouger
 * sous les pieds du moteur, et un observateur d'intersection quitte au passage
 * le graphe de la fiche.
 *
 * **Changer de saison mène aux épisodes.** Valider un onglet pose le focus sur
 * le premier épisode de la saison choisie dès qu'il est monté : sans cela on
 * restait sur la bande, à devoir redescendre à la main après chaque changement.
 */

interface EpisodeListTvProps {
  seriesId: string;
  /** Épisode en cours de consultation — surligné (fiche épisode). */
  currentEpisodeId?: string;
  /** Saison à présélectionner : celle de l'épisode en cours de reprise. */
  initialSeasonId?: string;
}

export function EpisodeList({
  seriesId,
  currentEpisodeId,
  initialSeasonId,
}: EpisodeListTvProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: seasons, isLoading: seasonsLoading } = useSeasons(seriesId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>();
  const { data: episodes, isLoading: episodesLoading } = useEpisodes(seriesId, selectedSeasonId);

  const list = useRef<HTMLDivElement>(null);
  /** Une saison vient d'être validée : le premier épisode monté prend le focus. */
  const aimTheFirst = useRef(false);
  const band = useRef<HTMLDivElement>(null);
  /** La bande ne se cale sur la saison active qu'UNE fois, à l'arrivée. */
  const wedgedBand = useRef(false);

  useEffect(() => {
    if (!seasons?.length || selectedSeasonId) return;
    const preferred =
      initialSeasonId && seasons.some((season) => season.Id === initialSeasonId)
        ? initialSeasonId
        : seasons[0].Id;
    setSelectedSeasonId(preferred);
  }, [seasons, selectedSeasonId, initialSeasonId]);

  // Le premier épisode de la nouvelle saison, dès qu'il existe. L'effet dépend
  // des épisodes et non de la saison : c'est leur arrivée qui rend le focus
  // possible, et la requête est asynchrone.
  useEffect(() => {
    if (!aimTheFirst.current) return;
    if (episodesLoading || !episodes?.length) return;
    aimTheFirst.current = false;
    const premiere = list.current?.querySelector<HTMLElement>(".ligne-episode-tv");
    // Par le moteur, jamais `focus()` nu : sur la dalle, le focus natif
    // recentre la ligne au lieu de la poser sous la bande des saisons.
    if (premiere) giveFocus(premiere);
  }, [episodes, episodesLoading]);

  const chooseSeason = useCallback((seasonId: string) => {
    aimTheFirst.current = true;
    setSelectedSeasonId(seasonId);
  }, []);

  // Le calage initial de la bande : la saison active en vue, une seule fois.
  //
  // Une série reprise en saison 5 présélectionne l'onglet 5 — hors de la bande
  // visible sur une longue série. Sans ce défilement, l'entrée de zone visait
  // un onglet que l'écran ne montrait pas. Écriture directe de `scrollLeft`,
  // jamais `scrollIntoView(options)` : Chrome 53 évalue l'objet comme un
  // booléen et saute brutalement. La position se mesure par les rectangles —
  // `offsetLeft` se rapporte au premier ancêtre positionné, pas au scroller.
  useEffect(() => {
    if (wedgedBand.current || !selectedSeasonId) return;
    const container = band.current;
    const active = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!container || !active) return;
    wedgedBand.current = true;
    const delta =
      active.getBoundingClientRect().left - container.getBoundingClientRect().left - 24;
    if (delta > 0) container.scrollLeft += delta;
  }, [selectedSeasonId, seasons]);

  return (
    <div className="px-4 md:px-8 py-4">
      {seasonsLoading ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Shimmer key={index} width="100px" height="36px" />
          ))}
        </div>
      ) : (
        /* La bande est une PISTE — confinement horizontal, défilement suivi —
           et une ZONE : y entrer transversalement vise l'onglet actif
           (aria-selected), pas la pastille que l'abscisse du point de départ
           désignait — la saison 4 sous « Infos techniques ». */
        <div
          className="saisons-tv"
          role="tablist"
          aria-label={t("common:seasons", "Saisons")}
          data-tv-piste=""
          data-tv-zone="saisons"
          ref={band}
        >
          {seasons?.map((season) => (
            <button
              key={season.Id}
              type="button"
              role="tab"
              aria-selected={selectedSeasonId === season.Id}
              onClick={() => chooseSeason(season.Id)}
              className={`saison-tv ${selectedSeasonId === season.Id ? "saison-tv-active" : ""}`}
            >
              {season.Name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3" ref={list}>
        {episodesLoading
          ? Array.from({ length: 6 }).map((_, index) => <Shimmer key={index} height="100px" />)
          : episodes?.map((episode) => (
              <EpisodeRowTv key={episode.Id} episodeId={episode.Id}>
                <EpisodeRow
                  episode={episode}
                  client={client}
                  seriesId={seriesId}
                  seasonId={selectedSeasonId}
                  isSelecting={false}
                  isSelected={false}
                  isCurrent={episode.Id === currentEpisodeId}
                  onToggleSelect={() => {}}
                  onPlay={() => navigate(`/watch/${episode.Id}`)}
                />
              </EpisodeRowTv>
            ))}
      </div>
    </div>
  );
}
