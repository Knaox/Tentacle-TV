import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeasonBrowser, useJellyfinClient } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import { EpisodeRow } from "@/components/EpisodeRow";
import { EpisodeRowTv } from "./EpisodeRowTv";
import { SeasonBandTv } from "./SeasonBandTv";
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
 *
 * **Les données sont celles de toutes les plateformes** (`useSeasonBrowser`) :
 * la fiche d'une série attend l'état de visionnage pour ouvrir la saison en
 * cours (elle ouvrait la première saison du serveur — souvent « Spéciaux » — et
 * y restait) en préchargeant la saison pressentie ; liste légère puis sources ;
 * voisines préchargées ; un onglet qui garde le focus précharge sa saison.
 */

interface EpisodeListTvProps {
  seriesId: string;
  /** Épisode en cours de consultation — surligné (fiche épisode). */
  currentEpisodeId?: string;
  /** Saison à présélectionner : celle de l'épisode en cours de reprise. */
  initialSeasonId?: string;
  /** Fiche d'une SÉRIE : la liste s'ouvre sur la saison de l'épisode à reprendre. */
  followResume?: boolean;
}

export function EpisodeList({
  seriesId,
  currentEpisodeId,
  initialSeasonId,
  followResume = false,
}: EpisodeListTvProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  // `provisional: false` : une liste qui changerait sous le focus de la
  // télécommande le perdrait — on attend l'état de visionnage.
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: initialSeasonId,
    followResume,
    currentEpisodeSeasonId: currentEpisodeId ? initialSeasonId : undefined,
    provisional: false,
  });
  const { seasons, selectedSeasonId, episodes } = browser;
  const episodesLoading = browser.episodesLoading;

  const list = useRef<HTMLDivElement>(null);
  /** Une saison vient d'être validée : le premier épisode monté prend le focus. */
  const aimTheFirst = useRef(false);

  // Le premier épisode de la nouvelle saison, dès qu'il existe. L'effet dépend
  // des épisodes et non de la saison : c'est leur arrivée qui rend le focus
  // possible, et la requête est asynchrone.
  useEffect(() => {
    if (!aimTheFirst.current) return;
    if (episodesLoading || !episodes?.length) return;
    aimTheFirst.current = false;
    const first = list.current?.querySelector<HTMLElement>(".ligne-episode-tv");
    // Par le moteur, jamais `focus()` nu : sur la dalle, le focus natif
    // recentre la ligne au lieu de la poser sous la bande des saisons.
    if (first) giveFocus(first);
  }, [episodes, episodesLoading]);

  const { select } = browser;
  const chooseSeason = useCallback((seasonId: string) => {
    aimTheFirst.current = true;
    select(seasonId);
  }, [select]);

  return (
    <div className="px-4 md:px-8 py-4">
      {browser.seasonsLoading ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Shimmer key={index} width="100px" height="36px" />
          ))}
        </div>
      ) : (
        <SeasonBandTv
          seasons={seasons ?? []}
          selectedId={selectedSeasonId}
          markedId={browser.markedSeasonId}
          label={t("common:seasons", "Saisons")}
          onSelect={chooseSeason}
          onIntent={browser.prefetch}
        />
      )}

      <div className="space-y-3" ref={list}>
        {episodesLoading
          ? Array.from({ length: 6 }).map((_, index) => <Shimmer key={index} height="100px" />)
          : episodes?.map((episode) => (
              <EpisodeRowTv key={episode.Id} episodeId={episode.Id} episode={episode}>
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
