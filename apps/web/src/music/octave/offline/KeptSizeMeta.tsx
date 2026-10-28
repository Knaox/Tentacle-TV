/**
 * Octave — la place qu'un album ou une playlist GARDÉS prennent sur cet
 * appareil, dans la ligne de détails de leur en-tête (`CollectionHeader` →
 * `meta`) : « · 84 Mio sur cet appareil ». Le glyphe hors ligne au ton de
 * réussite une fois tout gardé ; pendant la préparation, les mots seuls (la
 * place grandit avec les octets écrits). Rien pour une collection qui n'est
 * pas gardée en entier, rien hors de la portée du hors ligne (web, session de
 * profil). Lue dans la base des transferts : aucune requête.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { DownloadGlyph } from "../../../downloads/DownloadGlyph";
import { formatBytes } from "../../../downloads/presets";
import { Dot } from "../components/CollectionHeader";
import { collectionSummary, collectionBytes } from "@tentacle-tv/offline-core/music";
import { useOfflineSurface } from "./offlineSurfaceContext";
import { useKeptMusic } from "./useKeptMusic";

interface KeptSizeMetaProps {
  kind: "album" | "playlist";
  /** La clé de la collection, celle que reçoit `KeepCollectionButton`. */
  collectionKey: string;
  tracks: readonly MusicTrack[];
}

export const KeptSizeMeta = memo(function KeptSizeMeta(props: KeptSizeMetaProps) {
  const surface = useOfflineSurface();
  if (!surface.visible || props.tracks.length === 0) return null;
  return <KeptSizeMetaFor {...props} />;
});

function KeptSizeMetaFor({ kind, collectionKey, tracks }: KeptSizeMetaProps) {
  const { t } = useTranslation("musicOffline");
  const kept = useKeptMusic();
  const keys = useMemo(() => tracks.map((track) => track.key), [tracks]);
  const wholeKey = `${kind}:${collectionKey}`;
  const summary = collectionSummary(keys, kept.byKey, kept.collections.some((c) => c.key === wholeKey));
  const bytes = summary.phase === "none" ? 0 : collectionBytes(keys, kept.byKey);
  if (bytes === 0) return null;
  const complete = summary.phase === "complete";
  return (
    <>
      <Dot />
      <span className="inline-flex items-center gap-1 tabular-nums" data-octave-kept-size>
        {complete && <DownloadGlyph done className="h-3.5 w-3.5 text-status-success-fg" />}
        {t("size.onDevice", { size: formatBytes(bytes) })}
      </span>
    </>
  );
}
