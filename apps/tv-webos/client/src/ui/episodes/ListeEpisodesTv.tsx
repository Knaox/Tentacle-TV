import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeasons, useEpisodes, useJellyfinClient } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import { EpisodeRow } from "@/components/EpisodeRow";
import { RevealCell, RevealScope } from "@/components/grid/RevealCell";
import { LigneEpisodeTv } from "./LigneEpisodeTv";

/**
 * Saisons et épisodes, pour une télécommande.
 *
 * Remplace `components/EpisodeList.tsx`. Ce qui change tient en deux points, et
 * le reste — hooks, données, rendu d'une ligne — est celui du client web.
 *
 * **Chaque ligne devient atteignable**, enveloppée par `LigneEpisodeTv`. C'est
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
 * déjà — mais un conteneur simple laisse `amenerEnVue` faire défiler la bande
 * jusqu'à la saison visée, ce dont une série de six saisons a besoin.
 *
 * **Changer de saison mène aux épisodes.** Valider un onglet pose le focus sur
 * le premier épisode de la saison choisie dès qu'il est monté : sans cela on
 * restait sur la bande, à devoir redescendre à la main après chaque changement.
 */

/** Hauteur d'une ligne, réservée avant son premier passage. */
const HAUTEUR_LIGNE = 100;

interface ProprietesListeEpisodesTv {
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
}: ProprietesListeEpisodesTv) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: seasons, isLoading: seasonsLoading } = useSeasons(seriesId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>();
  const { data: episodes, isLoading: episodesLoading } = useEpisodes(seriesId, selectedSeasonId);

  const liste = useRef<HTMLDivElement>(null);
  /** Une saison vient d'être validée : le premier épisode monté prend le focus. */
  const viserLePremier = useRef(false);
  const bande = useRef<HTMLDivElement>(null);
  /** La bande ne se cale sur la saison active qu'UNE fois, à l'arrivée. */
  const bandeCalee = useRef(false);

  useEffect(() => {
    if (!seasons?.length || selectedSeasonId) return;
    const preferee =
      initialSeasonId && seasons.some((saison) => saison.Id === initialSeasonId)
        ? initialSeasonId
        : seasons[0].Id;
    setSelectedSeasonId(preferee);
  }, [seasons, selectedSeasonId, initialSeasonId]);

  // Le premier épisode de la nouvelle saison, dès qu'il existe. L'effet dépend
  // des épisodes et non de la saison : c'est leur arrivée qui rend le focus
  // possible, et la requête est asynchrone.
  useEffect(() => {
    if (!viserLePremier.current) return;
    if (episodesLoading || !episodes?.length) return;
    viserLePremier.current = false;
    const premiere = liste.current?.querySelector<HTMLElement>(".ligne-episode-tv");
    premiere?.focus();
  }, [episodes, episodesLoading]);

  const choisirSaison = useCallback((saisonId: string) => {
    viserLePremier.current = true;
    setSelectedSeasonId(saisonId);
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
    if (bandeCalee.current || !selectedSeasonId) return;
    const conteneur = bande.current;
    const actif = conteneur?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!conteneur || !actif) return;
    bandeCalee.current = true;
    const delta =
      actif.getBoundingClientRect().left - conteneur.getBoundingClientRect().left - 24;
    if (delta > 0) conteneur.scrollLeft += delta;
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
          ref={bande}
        >
          {seasons?.map((saison) => (
            <button
              key={saison.Id}
              type="button"
              role="tab"
              aria-selected={selectedSeasonId === saison.Id}
              onClick={() => choisirSaison(saison.Id)}
              className={`saison-tv ${selectedSeasonId === saison.Id ? "saison-tv-active" : ""}`}
            >
              {saison.Name}
            </button>
          ))}
        </div>
      )}

      <RevealScope>
        <div className="space-y-3" ref={liste}>
          {episodesLoading
            ? Array.from({ length: 6 }).map((_, index) => <Shimmer key={index} height="100px" />)
            : episodes?.map((episode, index) => (
                <RevealCell key={episode.Id} minHeight={HAUTEUR_LIGNE} eager={index < 8}>
                  <LigneEpisodeTv episodeId={episode.Id}>
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
                  </LigneEpisodeTv>
                </RevealCell>
              ))}
        </div>
      </RevealScope>
    </div>
  );
}
