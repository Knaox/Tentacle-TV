/**
 * Octave — la FIN d'un import : la pochette en grand de l'album créé (ou des albums, un lot peut en faire
 * plusieurs), « Ouvrir l'album » en action principale ; un échec dit pourquoi, en mots, avec « Réessayer ».
 */

import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { releaseArrival, type ReleaseFlowState } from "@tentacle-tv/api-client";
import { releaseArtSized, type MusicAlbum } from "@tentacle-tv/shared/music";
import { Artwork } from "../components/Artwork";

const BUTTON = "min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

interface Props {
  titleId: string;
  state: ReleaseFlowState;
  onOpen: (album: MusicAlbum) => void;
  onAnother: () => void;
  onClose: () => void;
}

export function ReleaseImportResult({ titleId, state, onOpen, onAnother, onClose }: Props) {
  const { t } = useTranslation("musicReleases");
  if (state.phase === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold tracking-tight text-content-primary">
          <AlertCircle className="h-5 w-5 text-amber-300" aria-hidden />
          {t("phase.failed")}
        </h2>
        <p className="text-sm text-content-secondary" role="alert">
          {t(`refusal.${state.refusal ?? "failed"}`)}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BUTTON} text-content-tertiary hover:text-content-primary`}>
            {t("close")}
          </button>
          <button type="button" autoFocus onClick={onAnother} className={`${BUTTON} octave-brand-fill px-6`}>
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }
  const albums = state.job?.albums ?? [];
  const album = releaseArrival(state.job);
  const others = albums.filter((a) => a !== album);
  return (
    <div className="flex flex-col gap-5">
      <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
        {t("phase.done")}
      </h2>
      {album ? (
        <div className="flex items-center gap-4">
          <Artwork url={album.artworkUrl ? releaseArtSized(album.artworkUrl, "700") : null} alt={album.title} label={album.title} radius="lg" className="h-28 w-28 shrink-0 shadow-[var(--oc-shadow-art-lg)]" eager />
          <div className="min-w-0">
            <p className="line-clamp-2 text-base font-bold text-content-primary">{album.title}</p>
            <p className="truncate text-sm text-content-secondary">{album.artists.map((a) => a.name).join(", ")}</p>
            <p className="mt-1 text-xs text-content-tertiary">{t("doneAlbums", { count: albums.length })}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-content-secondary">{t("doneNothingNew")}</p>
      )}
      {others.length > 0 && (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {others.map((other) => (
            <li key={other.key}>
              <button type="button" onClick={() => onOpen(other)} className="flex w-20 cursor-pointer flex-col gap-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
                <Artwork url={other.artworkUrl ? releaseArtSized(other.artworkUrl, "300") : null} label={other.title} radius="sm" className="h-20 w-20" />
                <span className="truncate text-xs text-content-secondary">{other.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onAnother} className={`${BUTTON} text-content-tertiary hover:text-content-primary`}>
          {t("another")}
        </button>
        {album && (
          <button type="button" autoFocus onClick={() => onOpen(album)} className={`${BUTTON} octave-brand-fill px-6`}>
            {t("openAlbum")}
          </button>
        )}
      </div>
    </div>
  );
}
