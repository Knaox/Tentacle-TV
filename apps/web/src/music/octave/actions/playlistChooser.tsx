/**
 * Octave — choisir une playlist pour un titre (ou une sélection), ou en CRÉER une (« Nouvelle playlist… » : un nom, puis le titre y
 * entre aussitôt — bibliothèque comme hors bibliothèque). Une seule boîte pour tout Octave, montée par la
 * coquille ; ouverte par le « + » sans playlist connue, et par « Changer » de l'avis « Ajouté à X ». Les playlists
 * FAVORITES d'abord, dans l'ordre personnel, puis les autres (`usePlaylistChooserSections`, lot fl).
 */

import { useId, useState, useSyncExternalStore } from "react";
import { ListMusic, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlaylistChooserSections } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { Modal } from "../../../components/ui/Modal";
import { useTrackActions } from "./useTrackActions";
import { useBulkTrackActions } from "./selection/useBulkTrackActions";
import { chooserSnapshot, closePlaylistChooser, subscribeChooser, type ChooserRequest } from "./playlistChooserStore";

const rowClass =
  "flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm text-content-primary hover:bg-octave-hover focus-visible:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export function PlaylistChooserHost() {
  const request = useSyncExternalStore(subscribeChooser, chooserSnapshot, () => null);
  return request ? <Chooser request={request} /> : null;
}

function Chooser({ request }: { request: ChooserRequest }) {
  const { t } = useTranslation("music");
  const titleId = useId();
  const inputId = useId();
  const { t: tf } = useTranslation("musicFavorites");
  const sections = usePlaylistChooserSections(request.moveFrom?.jellyfinId);
  const actions = useTrackActions();
  const bulk = useBulkTrackActions();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const [first] = request.tracks;
  const many = request.tracks.length > 1;
  const pick = async (playlist: MusicPlaylist) => {
    if (!first) return;
    setBusy(true);
    const added = many ? await bulk.addToPlaylist(request.tracks, playlist) : await actions.addToPlaylist(first, playlist);
    if (added && request.moveFrom) await actions.removeFromPlaylist(first, request.moveFrom);
    setBusy(false);
    if (added) closePlaylistChooser();
  };
  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy || !first) return;
    setBusy(true);
    const created = many ? await bulk.createPlaylistAndAdd(request.tracks, trimmed) : await actions.createPlaylistAndAdd(first, trimmed);
    if (created && request.moveFrom) await actions.removeFromPlaylist(first, request.moveFrom);
    setBusy(false);
    if (created) closePlaylistChooser();
  };

  return (
    <Modal open onClose={closePlaylistChooser} maxWidth={400} labelledBy={titleId}>
      <div className="flex max-h-[70vh] flex-col gap-3 p-5">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
          {many ? t("selection.chooseTitle", { count: request.tracks.length }) : t(request.moveFrom ? "playlist.moveTitle" : "playlist.chooseTitle", { title: first?.title ?? "" })}
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="sr-only">{t("playlist.namePlaceholder")}</label>
          <input
            id={inputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void create();
            }}
            placeholder={t("playlist.newPlaceholder")}
            maxLength={200}
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-line-subtle bg-fill-subtle px-3 text-sm text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          />
          <button
            type="button"
            onClick={() => void create()}
            disabled={!name.trim() || busy}
            className="octave-brand-fill flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:cursor-default disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("playlist.create")}
          </button>
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {sections.empty && <p className="px-3 py-2 text-sm text-content-tertiary">{t("playlist.none")}</p>}
          {sections.favorites.length > 0 && <SectionTitle>{tf("chooser.favorites")}</SectionTitle>}
          {sections.favorites.map((p) => (
            <ChooserRow key={p.jellyfinId} playlist={p} disabled={busy} onPick={pick} />
          ))}
          {sections.favorites.length > 0 && sections.others.length > 0 && <SectionTitle>{tf("chooser.others")}</SectionTitle>}
          {sections.others.map((p) => (
            <ChooserRow key={p.jellyfinId} playlist={p} disabled={busy} onPick={pick} />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-content-tertiary">{children}</h3>;
}

function ChooserRow({ playlist, disabled, onPick }: { playlist: MusicPlaylist; disabled: boolean; onPick: (p: MusicPlaylist) => Promise<void> }) {
  return (
    <button type="button" className={rowClass} disabled={disabled} onClick={() => void onPick(playlist)}>
      <ListMusic className="h-4 w-4 shrink-0 text-content-tertiary" aria-hidden />
      <span className="truncate">{playlist.name}</span>
    </button>
  );
}
