/**
 * Octave — vos playlists (Jellyfin), et la création d'une nouvelle — une
 * playlist Jellyfin du compte, jamais un stockage à part.
 */

import { useState } from "react";
import { ListMusic, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCreateMusicPlaylist, useMusicPlaylists } from "@tentacle-tv/api-client";
import { useToast } from "../../../contexts/ToastContext";
import { CardGrid, PlaylistCard } from "../components/Cards";
import { CardsSkeleton, EMPTY_ACTION_CLASS, EmptyState, ErrorState } from "../components/ViewStates";
import { octavePaths } from "../octavePaths";
import { ImportEntryButton } from "../import/ImportEntryButton";

function NewPlaylist({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { t } = useTranslation("music");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { mutateAsync: createPlaylist } = useCreateMusicPlaylist();
  const navigate = useNavigate();
  const toast = useToast();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="octave-brand-fill flex h-10 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-[var(--oc-shadow-play)] transition-transform duration-150 hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus motion-reduce:transform-none"
      >
        <Plus className="h-4 w-4" />
        {t("playlist.new")}
      </button>
    );
  }
  const submit = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const created = await createPlaylist({ name: clean });
      navigate(octavePaths.playlist(created.jellyfinId));
    } catch {
      toast.show("error", t("refusal.failed"), { title: t("refusal.title") });
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label className="sr-only" htmlFor="octave-new-playlist">
        {t("playlist.namePlaceholder")}
      </label>
      <input
        id="octave-new-playlist"
        autoFocus
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("playlist.namePlaceholder")}
        className="h-10 w-64 rounded-full border border-line-subtle bg-fill-subtle px-4 text-sm text-content-primary placeholder:text-content-quaternary focus:border-line-focus focus:outline-none"
      />
      <button type="submit" disabled={!name.trim() || busy} className="octave-brand-fill h-10 cursor-pointer rounded-full px-5 text-sm font-semibold disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
        {t("playlist.create")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-10 cursor-pointer rounded-full px-3 text-sm font-semibold text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
        {t("playlist.cancel")}
      </button>
    </form>
  );
}

export function PlaylistsView() {
  const { t } = useTranslation("music");
  const playlists = useMusicPlaylists();
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-6 px-2 pb-10 pt-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <h1 className="oc-display text-3xl text-content-primary">{t("nav.playlists")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ImportEntryButton />
          <NewPlaylist open={creating} setOpen={setCreating} />
        </div>
      </div>
      {playlists.isPending && <CardsSkeleton />}
      {playlists.isError && <ErrorState onRetry={() => void playlists.refetch()} />}
      {playlists.data?.length === 0 && (
        <EmptyState
          icon={ListMusic}
          title={t("views.playlistsEmptyTitle")}
          action={
            creating ? undefined : (
              <button type="button" onClick={() => setCreating(true)} className={EMPTY_ACTION_CLASS}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("playlist.new")}
              </button>
            )
          }
        >
          {t("views.playlistsEmptyHint")}
        </EmptyState>
      )}
      {playlists.data && playlists.data.length > 0 && (
        <CardGrid>
          {playlists.data.map((p) => (
            <PlaylistCard key={p.jellyfinId} playlist={p} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}
