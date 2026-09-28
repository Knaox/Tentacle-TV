import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useSharedItem, useSharedListView, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailStage } from "../components/detail/DetailStage";
import { DetailPoster } from "../components/detail/DetailPoster";
import { DetailTitle } from "../components/detail/DetailTitle";
import { DetailMetadata } from "../components/detail/DetailMetadata";
import { DetailOverview } from "../components/detail/DetailOverview";
import { DetailFacts } from "../components/detail/DetailFacts";
import { DetailPlaceholder } from "../components/detail/DetailPlaceholder";
import { ExtrasRow } from "../components/detail/ExtrasRow";
import { CastRow } from "../components/CastRow";
import { SharedItemActions } from "../components/share/SharedItemActions";
import { ShareShell } from "../components/share/ShareShell";
import { ShareError } from "../components/share/ShareStates";
import { useShareVisitor } from "../components/share/useShareVisitor";
import { resolveBackdropId } from "../components/hero/resolveBackdrop";
import { useItemRemoteTrailers } from "../hooks/useItemRemoteTrailers";
import { textCascadeDelayed } from "../theme/motion";

/** Item de repli stable pendant le chargement (les hooks doivent rester appelés). */
const EMPTY_ITEM = {} as MediaItem;

/**
 * Fiche PUBLIQUE d'un titre partagé (/share/:token/:itemId), au dessin de la
 * vraie fiche : bannière, bloc titre (surtitre, logo), méta, synopsis, puis
 * bandes-annonces, « Casting et équipe » en lecture seule et « Informations ».
 *
 * Rien qui exige une session : ni lecture, ni favoris, ni liens vers la
 * recherche ou les filmographies. Le seul geste principal mène à la connexion
 * (ou, connecté, à la vraie fiche). Le retour ramène à la liste partagée — un
 * visiteur arrivé par le lien n'a pas d'historique dans l'app.
 */
export function SharedItemDetail() {
  const { token = "", itemId = "" } = useParams<{ token: string; itemId: string }>();
  const { t } = useTranslation("share");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: item, isLoading, isError, isFetching, refetch } = useSharedItem(token, itemId);
  // Le nom de l'auteur : la liste est en cache quand on vient d'elle.
  const { data: list } = useSharedListView(token);
  const visitor = useShareVisitor(`/share/${token}/${itemId}`);
  // Extras triés selon la langue d'interface — même pipeline que la fiche
  // (Jellyfin + TMDB).
  const remoteTrailers = useItemRemoteTrailers(item ?? EMPTY_ITEM);

  if (isLoading) return <DetailPlaceholder failed={false} retrying={false} onRetry={() => undefined} />;

  if (isError || !item) {
    return (
      <ShareShell authed={visitor.authed}>
        <ShareError
          onRetry={() => void refetch()}
          retrying={isFetching}
          exitTo={`/share/${token}`}
          exitLabel={t("backToList")}
        />
      </ShareShell>
    );
  }

  const backdropId = resolveBackdropId(item);
  const backdropUrl = backdropId ? client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 85 }) : null;

  return (
    <div className="min-h-dvh bg-surface-0">
      {/* La scène de la vraie fiche : ses blocs sont dessinés pour le décor
          (jetons on-media), jamais pour un fond de page. */}
      <DetailStage
        backdropUrl={backdropUrl}
        item={item}
        onBack={() => navigate(`/share/${token}`)}
        backLabel={t("backToList")}
      >
        <motion.div
          className="flex items-end gap-8 px-5 pb-10 pt-28 md:px-12 md:pb-14 xl:gap-12 xl:px-16"
          initial="hidden"
          animate="show"
          variants={textCascadeDelayed}
        >
          <DetailPoster item={item} />
          <div className="min-w-0 max-w-4xl flex-1">
            <DetailTitle item={item} />
            <DetailMetadata item={item} linkGenres={false} />
            <DetailOverview item={item} />
            <SharedItemActions
              itemId={item.Id}
              authed={visitor.authed}
              loginPath={visitor.loginPath}
              ownerUsername={list?.ownerUsername}
            />
          </div>
        </motion.div>
      </DetailStage>

      <div className="mt-12 space-y-12 pb-16">
        {remoteTrailers.length > 0 && <ExtrasRow remoteTrailers={remoteTrailers} />}
        {item.People && item.People.length > 0 && <CastRow people={item.People} readOnly />}
        <DetailFacts item={item} readOnly />
      </div>
    </div>
  );
}
