/**
 * Octave — garder un album ou une playlist ENTIERS sur cet appareil, depuis
 * leur en-tête (`CollectionHeader` → `extra`). Un rond de la taille des autres
 * gestes, une seule forme qui change d'état :
 *   - le glyphe hors ligne au trait : « Garder … hors ligne » ;
 *   - un anneau qui se remplit, « 3 sur 12 » pour les lecteurs d'écran : le bouton
 *     ne fait rien de plus (aucun geste accidentel) ;
 *   - gardé (glyphe plein, ton de réussite) ou en défaut : le clic retire,
 *     réessaie, ou garde les titres qui manquent (retirés un à un, ajoutés à la
 *     playlist depuis), dans un petit menu (le retrait n'est jamais au premier clic) —
 *     qui dit la place prise, et celle que le retrait rendra (les titres qu'un
 *     autre album ou une autre playlist retient restent).
 * Rien sans le droit, rien sur le web.
 */

import { useMemo, useRef, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { FloatingLayer } from "../../../components/floating/FloatingLayer";
import { DownloadGlyph } from "../../../downloads/DownloadGlyph";
import { formatBytes } from "../../../downloads/presets";
import { canKeepTrack, collectionSummary, ownCopies, bytesOnDisk, collectionBytes } from "@tentacle-tv/offline-core/music";
import { useOfflineSurface } from "./offlineSurfaceContext";
import { ProgressRing } from "./ProgressRing";
import { useKeepGestures } from "./useKeepGestures";
import { useKeptMusic } from "./useKeptMusic";
import { octavePaths } from "../octavePaths";

interface KeepCollectionButtonProps {
  kind: "album" | "playlist";
  collectionKey: string;
  title: string;
  subtitle?: string | null;
  tracks: readonly MusicTrack[];
}

const ROUND =
  "flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-octave-line bg-octave-hover text-content-primary transition-colors duration-150 hover:bg-octave-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default";

const ITEM =
  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-content-primary hover:bg-octave-hover focus-visible:bg-octave-hover focus-visible:outline-none";

export function KeepCollectionButton(props: KeepCollectionButtonProps) {
  const surface = useOfflineSurface();
  if (!surface.visible || props.tracks.length === 0) return null;
  return <KeepCollectionButtonFor {...props} />;
}

function KeepCollectionButtonFor({ kind, collectionKey, title, subtitle = null, tracks }: KeepCollectionButtonProps) {
  const { t } = useTranslation("musicOffline");
  const navigate = useNavigate();
  const surface = useOfflineSurface();
  const kept = useKeptMusic();
  const gestures = useKeepGestures();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const keys = useMemo(() => tracks.map((track) => track.key), [tracks]);
  const wholeKey = `${kind}:${collectionKey}`;
  const summary = collectionSummary(keys, kept.byKey, kept.collections.some((c) => c.key === wholeKey));
  const keepable = tracks.some((track) => canKeepTrack(track, surface));
  // Un titre retiré, ou arrivé dans la playlist depuis : la collection n'est plus entière sur l'appareil.
  const missing = tracks.filter((track) => canKeepTrack(track, surface) && !kept.byKey.has(track.key));
  const keepLabel = t(kind === "album" ? "keepAlbum" : "keepPlaylist");
  const collection = { key: wholeKey, kind, title, subtitle, trackKeys: keys };
  // Retirer la collection n'emporte pas ce qu'un autre album, une autre playlist ou un geste retient encore.
  const ownKept = () => ownCopies(keys, kept.byKey, kept.collections, wholeKey);

  if (summary.phase === "none") {
    if (!keepable) return null;
    return (
      <button type="button" className={ROUND} title={keepLabel} aria-label={keepLabel} onClick={() => void gestures.keep(tracks, collection)}>
        <DownloadGlyph done={false} className="h-5 w-5" />
      </button>
    );
  }
  if (summary.phase === "progress") {
    const label = t("progress", { done: summary.done, total: summary.total });
    return (
      // Cliquer l'anneau ouvre « Sur cet appareil », où se suivent les transferts (lot fl).
      <button
        type="button"
        className={`${ROUND} text-octave-accent-text`}
        title={`${label} · ${t("progressOpen")}`}
        aria-label={`${label}. ${t("progressOpen")}`}
        onClick={(e) => {
          e.preventDefault();
          navigate(octavePaths.device);
        }}
      >
        <ProgressRing fraction={summary.fraction} size={22} stroke={2.5} />
      </button>
    );
  }
  const failed = summary.phase === "failed";
  const label = failed ? t("failed") : t("kept");
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`${ROUND} ${failed ? "text-status-error-fg" : "text-status-success-fg"}`}
        onClick={() => setOpen((v) => !v)}
      >
        <DownloadGlyph done className="h-5 w-5" />
      </button>
      {open && (
        <FloatingLayer
          open
          anchor={anchor}
          onDismiss={() => setOpen(false)}
          role="menu"
          ariaLabel={label}
          side="bottom"
          align="start"
          className="w-64 p-1.5"
          // L'îlot d'encre opaque des menus d'Octave (IDENTITE.md) : jamais de verre sur du verre.
          style={{ background: "var(--oc-ink-raised)", borderRadius: "var(--oc-radius-panel)", boxShadow: "var(--oc-shadow-panel)" }}
        >
          <p className="px-3 py-2 text-xs tabular-nums text-content-tertiary">
            {t("keptCount", { count: summary.done })} · {formatBytes(collectionBytes(keys, kept.byKey))}
          </p>
          {missing.length > 0 && (
            <button type="button" role="menuitem" className={ITEM} onClick={() => (setOpen(false), void gestures.keep(missing, collection))}>
              <DownloadGlyph done={false} className="h-4 w-4 text-content-tertiary" />
              {t("keepMissing", { count: missing.length })}
            </button>
          )}
          {failed && keepable && (
            <button type="button" role="menuitem" className={ITEM} onClick={() => (setOpen(false), void gestures.keep(tracks, collection))}>
              <RotateCcw className="h-4 w-4 text-content-tertiary" aria-hidden />
              {t("retry")}
            </button>
          )}
          <button type="button" role="menuitem" className={`${ITEM} text-status-error-fg`} onClick={() => (setOpen(false), void gestures.remove(ownKept(), collection.key))}>
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            {t(kind === "album" ? "removeAlbum" : "removePlaylist")}
            <FreedSize copies={ownKept()} />
          </button>
        </FloatingLayer>
      )}
    </>
  );
}

/** Ce que le retrait rend au disque : les copies que rien d'autre ne retient. Rien s'il ne rend rien. */
function FreedSize({ copies }: { copies: readonly KeptMusicTrack[] }) {
  const { t } = useTranslation("musicOffline");
  const bytes = bytesOnDisk(copies);
  if (bytes === 0) return null;
  return <span className="ml-auto pl-2 text-xs tabular-nums text-content-tertiary">{t("size.frees", { size: formatBytes(bytes) })}</span>;
}
