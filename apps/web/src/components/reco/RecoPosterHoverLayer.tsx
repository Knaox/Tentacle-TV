import { useNavigate } from "react-router-dom";
import { useRecoMarkerItem, type RecoRowItem } from "@tentacle-tv/api-client";
import { CardHoverOverlay } from "../cards/CardHoverOverlay";
import { ExternalHoverOverlay } from "../cards/external/ExternalHoverOverlay";
import { useRecoPlayTarget } from "./useRecoPlayTarget";

interface RecoPosterHoverLayerProps {
  item: RecoRowItem;
  /** Cible du fondu : vrai au survol, faux le temps du sursis de démontage. */
  visible: boolean;
  /** « Ne plus me proposer » — le plateau arrête déjà le clic (pas de navigation). */
  onDismiss: () => void;
  /** Ouverture de la fiche AVEC sa transition — repli du bouton Lecture. */
  onOpenDetail: () => void;
}

/**
 * Le survol d'une carte de recommandation : le survol UNIQUE des cartes
 * (`CardHoverOverlay`, variante `reco`), à qui ce module ne fait que donner
 * ce qu'une recommandation seule connaît — la cible de lecture (reprise, ou
 * l'épisode à suivre), le visage des marqueurs et l'identité tmdb.
 *
 * Titre hors bibliothèque : c'est une carte Vigie, et son survol est celui de
 * toutes les cartes hors bibliothèque (`ExternalHoverOverlay`) — les étoiles
 * (par tmdb), puis la capsule : « Demander » en tête, Ma liste à l'arrivée et
 * le refus. Le même que sur la recherche ou dans l'extension.
 *
 * Monté au survol seulement : la cible de lecture (une ou deux requêtes), les
 * Sets du plateau et la liste des notes n'existent que le temps du survol.
 */
export function RecoPosterHoverLayer(props: RecoPosterHoverLayerProps) {
  const { item } = props;
  // Hors bibliothèque, c'est le survol des cartes Vigie : « Demander » en
  // tête du plateau, Ma liste à l'arrivée — le même que sur la recherche.
  if (item.jellyfinItemId === null) {
    return (
      <ExternalHoverOverlay
        variant="reco"
        title={{ mediaType: item.mediaType, tmdbId: item.tmdbId }}
        name={item.title}
        visible={props.visible}
        onDismiss={props.onDismiss}
      />
    );
  }
  return <LibraryRecoHoverLayer {...props} />;
}

function LibraryRecoHoverLayer({ item, visible, onDismiss, onOpenDetail }: RecoPosterHoverLayerProps) {
  const navigate = useNavigate();
  // Lecture (reprise, sinon l'épisode à suivre) — null hors bibliothèque.
  const target = useRecoPlayTarget(item.jellyfinItemId, item.mediaType);
  // Le plateau bascule le visage des marqueurs : pour un film, la fiche que
  // la lecture vient de charger (son UserData dit s'il est déjà dans Ma
  // liste) ; pour une série, les Sets partagés répondent.
  const face = useRecoMarkerItem(item);

  const onPlay = () => {
    if (!target || target.kind === "detail") onOpenDetail();
    else navigate(target.path);
  };

  return (
    <CardHoverOverlay
      variant="reco"
      item={face}
      title={item.title}
      visible={visible}
      play={target ? { resume: target.kind === "resume", label: target.label, onPlay } : null}
      meta={target?.media ?? null}
      onDismiss={onDismiss}
    />
  );
}
