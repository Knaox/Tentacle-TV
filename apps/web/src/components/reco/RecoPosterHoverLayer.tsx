import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useRecoMarkerItem, type RecoRowItem } from "@tentacle-tv/api-client";
import { CardHoverOverlay } from "../cards/CardHoverOverlay";
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
 * Titre hors bibliothèque : ni Lecture ni bascules (il n'y a pas d'item
 * Jellyfin à mettre dans Ma liste) — les étoiles (par tmdb) et le refus
 * restent, dans la même capsule. C'est le modèle partagé qui le décide.
 *
 * Monté au survol seulement : la cible de lecture (une ou deux requêtes), les
 * Sets du plateau et la liste des notes n'existent que le temps du survol.
 */
export function RecoPosterHoverLayer({ item, visible, onDismiss, onOpenDetail }: RecoPosterHoverLayerProps) {
  const navigate = useNavigate();
  // Lecture (reprise, sinon l'épisode à suivre) — null hors bibliothèque.
  const target = useRecoPlayTarget(item.jellyfinItemId, item.mediaType);
  // Le plateau bascule le visage des marqueurs : pour un film, la fiche que
  // la lecture vient de charger (son UserData dit s'il est déjà dans Ma
  // liste) ; pour une série, les Sets partagés répondent.
  const face = useRecoMarkerItem(item);
  const inLibrary = item.jellyfinItemId !== null;

  const onPlay = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!target || target.kind === "detail") onOpenDetail();
    else navigate(target.path);
  };

  return (
    <CardHoverOverlay
      variant="reco"
      item={inLibrary ? face : null}
      title={item.title}
      visible={visible}
      play={target ? { resume: target.kind === "resume", label: target.label, onPlay } : null}
      // Hors bibliothèque, la note vit sur le tmdb : le visage `reco:…` n'est
      // pas un item Jellyfin à qui la rattacher.
      ratingIdentity={inLibrary ? undefined : { mediaType: item.mediaType === "tv" ? "series" : "movie", tmdbId: item.tmdbId }}
      meta={target?.media ?? null}
      onDismiss={onDismiss}
    />
  );
}
