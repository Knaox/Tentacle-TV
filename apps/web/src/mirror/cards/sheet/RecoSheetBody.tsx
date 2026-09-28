import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  recoBackdropUrl,
  recoPosterUrl,
  useCardRatingTarget,
  useJellyfinClient,
  useMediaItem,
  useRecoMarkerItem,
  useSendRecoFeedback,
  type RatingIdentity,
  type RecoRowItem,
} from "@tentacle-tv/api-client";
import { resolveCardOverlay, resumeState } from "@tentacle-tv/shared";
import { useRecoPlayTarget } from "../../../components/reco/useRecoPlayTarget";
import { useRecoNavigation } from "../../../lib/recoNavigation";
import { RecoReasonList } from "../../screens/forYou/RecoReasonList";
import { SheetActions } from "./SheetActions";
import { SheetHeader } from "./SheetHeader";
import { SheetPlayButton } from "./SheetPlayButton";
import { SheetRating } from "./SheetRating";

/**
 * La feuille d'une recommandation EN bibliothèque — la même que celle des
 * titres de la bibliothèque, variante `reco` du modèle (`RecoPosterHoverLayer`
 * au bureau) : « Pourquoi ce titre » sous le bandeau, la lecture (reprise, ou
 * l'épisode à suivre), Ma liste, favori, vu, « Ne plus me proposer », la note.
 *
 * Une recommandation HORS bibliothèque a la feuille des cartes Vigie
 * (`RecoActionSheet`) ; si elle arrivait ici malgré tout, le modèle n'y
 * offrirait que le refus et la note, par son tmdb.
 *
 * Le refus retire le titre de toutes les pages en cache (optimiste) et ferme.
 */
export function RecoSheetBody({ reco, onClose }: { reco: RecoRowItem; onClose: () => void }) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { t: tm } = useTranslation("media");
  const recoNav = useRecoNavigation();
  const feedback = useSendRecoFeedback();
  const inLibrary = reco.jellyfinItemId !== null;

  // Le visage des bascules : la fiche complète dès qu'elle arrive (son
  // `UserData` dit si un film est déjà dans Ma liste), le visage de la carte
  // d'ici là — une série répond de toute façon par les Sets partagés.
  const face = useRecoMarkerItem(reco);
  const { data: full } = useMediaItem(reco.jellyfinItemId ?? undefined);
  const item = inLibrary ? (full ?? face) : null;
  // Lecture : reprise, sinon l'épisode à suivre — `null` hors bibliothèque.
  const play = useRecoPlayTarget(reco.jellyfinItemId, reco.mediaType);
  const target = useCardRatingTarget(item, { scope: "series", enabled: true });
  // Hors bibliothèque, la note vit sur le tmdb : le visage `reco:…` n'est pas
  // un item Jellyfin à qui la rattacher.
  const identity: RatingIdentity | null = inLibrary
    ? target.identity
    : { mediaType: reco.mediaType === "tv" ? "series" : "movie", tmdbId: reco.tmdbId };

  const overlay = resolveCardOverlay({
    variant: "reco",
    inLibrary,
    playable: play !== null,
    resume: play?.kind === "resume",
    rateable: identity !== null || target.pending,
    offline: false,
  });

  const resume = play?.media ? resumeState(play.media) : null;
  const dismiss = () => {
    feedback.mutate({ itemKey: reco.key, action: "dismissed" });
    onClose();
  };
  const onPlay = () => {
    onClose();
    if (!play || play.kind === "detail") recoNav.open(reco);
    else navigate(play.path);
  };

  return (
    <>
      <SheetHeader
        title={reco.title}
        meta={[reco.year, tm(reco.mediaType === "tv" ? "kindSeries" : "kindMovie")].filter(Boolean).join(" · ")}
        posterUrl={recoPosterUrl(reco, (id) => client.getImageUrl(id, "Primary", { width: 240, quality: 85 }), "w185")}
        backdropUrl={recoBackdropUrl(reco, (id) => client.getImageUrl(id, "Backdrop", { width: 600, quality: 70 }), "w780")}
      />
      {reco.reasons.length > 0 && (
        <div className="mx-4 mb-4">
          <RecoReasonList reasons={reco.reasons} />
        </div>
      )}
      {overlay.play && play && (
        <SheetPlayButton
          plan={{
            targetId: play.kind === "detail" ? null : play.path,
            resume: play.kind === "resume",
            episodeCode: play.episodeCode,
            progress: resume?.progress ?? null,
            remainingMinutes: resume?.remainingMinutes ?? null,
          }}
          title={reco.title}
          onPress={onPlay}
        />
      )}
      <SheetActions item={item} overlay={overlay} onDismiss={dismiss} />
      {overlay.rate && <SheetRating identity={identity} jellyfinItemId={inLibrary ? target.jellyfinItemId : null} />}
    </>
  );
}
