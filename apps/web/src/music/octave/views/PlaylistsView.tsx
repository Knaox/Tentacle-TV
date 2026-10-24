/**
 * Octave — vos playlists (Jellyfin), et la création d'une nouvelle — une
 * playlist Jellyfin du compte, jamais un stockage à part.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { useToast } from "../../../contexts/ToastContext";
import { CardGrid, PlaylistCard } from "../components/Cards";
import { CardsSkeleton, EmptyState, ErrorState } from "../components/ViewStates";
import { libraryApi } from "../data/libraryApi";
import { octaveKeys, useMusicPlaylists } from "../data/libraryQueries";
import { octavePaths } from "../octavePaths";

function NewPlaylist() {
  const { t } = useTranslation("music");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const user = useUserId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-cta-primary-bg px-4 py-2 text-sm font-semibold text-cta-primary-fg hover:bg-cta-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
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
      const created = await libraryApi.createPlaylist(clean);
      await queryClient.invalidateQueries({ queryKey: octaveKeys.playlists(user) });
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
      <button type="submit" disabled={!name.trim() || busy} className="h-10 cursor-pointer rounded-full bg-cta-primary-bg px-4 text-sm font-semibold text-cta-primary-fg disabled:opacity-50">
        {t("playlist.create")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-10 cursor-pointer rounded-full px-3 text-sm font-semibold text-content-tertiary hover:text-content-primary">
        {t("playlist.cancel")}
      </button>
    </form>
  );
}

export function PlaylistsView() {
  const { t } = useTranslation("music");
  const playlists = useMusicPlaylists();
  return (
    <div className="flex flex-col gap-6 px-2 pb-10 pt-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <h1 className="text-3xl font-black tracking-tight text-content-primary">{t("nav.playlists")}</h1>
        <NewPlaylist />
      </div>
      {playlists.isPending && <CardsSkeleton />}
      {playlists.isError && <ErrorState onRetry={() => void playlists.refetch()} />}
      {playlists.data?.length === 0 && <EmptyState>{t("library.empty")}</EmptyState>}
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
