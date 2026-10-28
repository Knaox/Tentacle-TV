/**
 * Octave — les notes d'un album au pied de sa page : la description Jellyfin (mentions, source, licence d'un
 * contenu libre de droit…), ligne à ligne, adresses ouvrables. Règle : `useAlbumNotes` (api-client), la même sur
 * le web étroit et le mobile. Sans description : rien.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useAlbumNotes } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";

export const AlbumNotes = memo(function AlbumNotes({ album }: { album: Pick<MusicAlbum, "description"> }) {
  const { t } = useTranslation("music");
  const lines = useAlbumNotes(album);
  if (lines.length === 0) return null;
  return (
    <section aria-label={t("album.notes")} className="mt-6 max-w-3xl px-2 text-xs leading-relaxed text-content-tertiary">
      <h2 className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-content-secondary">{t("album.notes")}</h2>
      {lines.map((line, i) => (
        <p key={i} className="break-words">
          {line.map((segment, j) =>
            segment.kind === "link" ? (
              <a key={j} href={segment.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-content-primary">
                {segment.text}
              </a>
            ) : (
              <span key={j}>{segment.text}</span>
            ),
          )}
        </p>
      ))}
    </section>
  );
});
