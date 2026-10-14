import { useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useItemTrailer, type RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { HERO_INFO_CLASS, HERO_PLAY_CLASS, HERO_PLAY_STYLE } from "../../hero/HeroActions";
import { InfoIcon, PlayIcon } from "../../icons/HeroIcons";
import { FilmIcon } from "../../media/MediaDetailIcons";
import { CardQuickActions } from "../../cards/CardQuickActions";
import { TrailerViewer } from "../../detail/TrailerViewer";
import { useWebTrailerPlatform } from "../../detail/trailerPlatform";
import { CatalogTrailerPlayer } from "../../detail/CatalogTrailerPlayer";
import { shouldOpenYouTubeExternally } from "../../detail/youtube";
import { PressableScale } from "../../ui/PressableScale";
import { openExternal } from "../../../lib/openExternal";
import { useRecoNavigation } from "../../../lib/recoNavigation";
import { useRecoPlayTarget } from "../useRecoPlayTarget";

interface SpotlightActionsProps {
  item: RecoRowItem;
  /** La fiche Jellyfin du titre (bibliothèque) — bande-annonce, Ma liste ; absente hors bibliothèque. */
  media: MediaItem | undefined;
  /** Ouvre la fiche (ou Vigie) avec la transition depuis le cadre. */
  onOpenDetail: (e: MouseEvent<HTMLElement>) => void;
  onDismiss: () => void;
}

/**
 * Les gestes de la une, dans l'ordre où l'on décide : LIRE (le seul bouton
 * plein — la reprise ou l'épisode à suivre s'il y en a), la bande-annonce,
 * la fiche, Ma liste (et le cœur, le vu : les gestes de toutes les cartes),
 * puis « Ne plus me proposer », en texte, à part. Hors bibliothèque, la fiche
 * du catalogue tient la place de Lire.
 */
export function SpotlightActions({ item, media, onOpenDetail, onDismiss }: SpotlightActionsProps) {
  const { t } = useTranslation("reco");
  const navigate = useNavigate();
  const { canOpen } = useRecoNavigation();
  const target = useRecoPlayTarget(item.jellyfinItemId, item.mediaType);

  const play = (e: MouseEvent<HTMLElement>) => {
    if (!target || target.kind === "detail") onOpenDetail(e);
    else navigate(target.path);
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {target ? (
        <PressableScale onClick={play} className={HERO_PLAY_CLASS} style={HERO_PLAY_STYLE}>
          <PlayIcon />
          {target.label}
        </PressableScale>
      ) : (
        canOpen(item) && (
          <PressableScale onClick={onOpenDetail} className={HERO_PLAY_CLASS} style={HERO_PLAY_STYLE}>
            {t("heroOpenVigie")}
          </PressableScale>
        )
      )}
      {media && <SpotlightTrailer media={media} />}
      {target && (
        <PressableScale onClick={onOpenDetail} className={HERO_INFO_CLASS}>
          <InfoIcon />
          {t("heroOpenDetail")}
        </PressableScale>
      )}
      {media && (
        <div className="hidden items-center gap-1.5 sm:flex">
          <CardQuickActions item={media} variant="inline" />
        </div>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 min-h-[44px] rounded-full px-3 text-sm font-medium text-on-media-secondary underline-offset-4 transition-colors hover:text-on-media-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)]"
      >
        {t("dismissAction")}
      </button>
    </div>
  );
}

/** La bande-annonce : la première du catalogue (lecteur complet), sinon locale puis YouTube (modale) — rien sans bande-annonce. */
function SpotlightTrailer({ media }: { media: MediaItem }) {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { target, visible, remote, entries, language } = useItemTrailer(media, i18n.language, useWebTrailerPlatform());
  const [open, setOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  if (!visible) return null;

  const play = () => {
    if (!target) return;
    if (target.kind === "local") return navigate(`/watch/${target.itemId}`);
    if (target.kind === "relay") return setPlayerOpen(true);
    if (shouldOpenYouTubeExternally()) return void openExternal(target.trailer.Url);
    setOpen(true);
  };

  return (
    <>
      <PressableScale onClick={play} className={HERO_INFO_CLASS}>
        <FilmIcon />
        {t("trailer")}
      </PressableScale>
      {remote.length > 0 && <TrailerViewer open={open} onClose={() => setOpen(false)} trailers={remote} />}
      {playerOpen && target?.kind === "relay" && (
        <CatalogTrailerPlayer entries={entries} start={target.entry} language={language} onClose={() => setPlayerOpen(false)} />
      )}
    </>
  );
}
