/**
 * Octave — « Un album » : on cherche dans la bibliothèque (et dans ses imports), on choisit, et TOUS ses titres
 * entrent dans la playlist, dans l'ordre de l'album. Sans frappe : les albums ajoutés récemment et vos imports.
 * La playlist neuve prend le nom de l'album (renommable ensuite).
 */

import { useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { musicSearchText, useImportedReleases, useMusicHome, useMusicSearch } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { Artwork } from "../../components/Artwork";
import { useOctaveProvider } from "../../mode/useOctaveProvider";

interface Props {
  /** L'import vise une playlist existante (« Ajouter les titres ») plutôt qu'une neuve. */
  into: boolean;
  onStart: (album: MusicAlbum) => void;
  onCancel: () => void;
}

const matches = (album: MusicAlbum, q: string) => musicSearchText(`${album.title} ${album.artists.map((a) => a.name).join(" ")}`).includes(q);

function AlbumOption({ album, selected, onSelect }: { album: MusicAlbum; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation("musicImport");
  const meta = [album.artists.map((a) => a.name).join(", "), album.year, album.trackCount ? t("albumTracks", { count: album.trackCount }) : null].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={`flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${selected ? "bg-octave-hover" : "hover:bg-octave-hover"}`}
      >
        <Artwork url={album.artworkUrl} alt="" label={album.title} radius="xs" thumb className="h-11 w-11 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-content-primary">{album.title}</span>
          <span className="block truncate text-xs text-content-tertiary">{meta}</span>
        </span>
        {selected && <Check className="h-4 w-4 shrink-0 text-octave-accent-text" aria-hidden />}
      </button>
    </li>
  );
}

function Group({ label, albums, selected, onSelect }: { label?: string; albums: readonly MusicAlbum[]; selected: string | null; onSelect: (a: MusicAlbum) => void }) {
  if (albums.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {label && <p className="px-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">{label}</p>}
      <ul className="flex flex-col">
        {albums.map((album) => (
          <AlbumOption key={album.key} album={album} selected={selected === album.key} onSelect={() => onSelect(album)} />
        ))}
      </ul>
    </div>
  );
}

export function ImportAlbumPane({ into, onStart, onCancel }: Props) {
  const { t } = useTranslation("musicImport");
  const fieldId = useId();
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<MusicAlbum | null>(null);
  const q = musicSearchText(text);
  const search = useMusicSearch(text, { limit: 20 });
  const home = useMusicHome({ enabled: q.length === 0 });
  const imports = useImportedReleases(useOctaveProvider()).data?.albums;

  const { library, imported } = useMemo(() => {
    const own = (imports ?? []).filter((a) => q.length === 0 || matches(a, q)).slice(0, q.length === 0 ? 6 : 10);
    const lib = q.length > 0 ? (search.data?.albums ?? []) : (home.data?.recentlyAdded ?? []).slice(0, 12);
    return { library: lib, imported: own };
  }, [home.data, imports, q, search.data]);
  const none = q.length > 0 && !search.pending && library.length === 0 && imported.length === 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (chosen) onStart(chosen);
      }}
    >
      <p className="text-sm text-content-secondary">{t("albumIntro")}</p>
      <label htmlFor={fieldId} className="sr-only">
        {t("albumSearch")}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" aria-hidden />
        <input
          id={fieldId}
          autoFocus
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("albumPlaceholder")}
          className="min-h-[44px] w-full rounded-xl border border-line-subtle bg-fill-subtle py-2.5 pl-9 pr-3 text-sm text-content-primary placeholder:text-content-quaternary focus-visible:border-line-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        />
      </div>
      <div role="radiogroup" aria-label={t("albumSearch")} className="-mx-2 flex max-h-[320px] flex-col gap-3 overflow-y-auto overscroll-contain">
        <Group label={q.length === 0 ? t("albumRecent") : undefined} albums={library} selected={chosen?.key ?? null} onSelect={setChosen} />
        <Group label={t("albumImports")} albums={imported} selected={chosen?.key ?? null} onSelect={setChosen} />
        {none && <p className="px-2 py-6 text-center text-sm text-content-tertiary">{t("albumNone")}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] cursor-pointer rounded-full px-4 text-sm font-semibold text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t("cancel")}
        </button>
        <button type="submit" disabled={!chosen} className="octave-brand-fill min-h-[44px] cursor-pointer rounded-full px-6 text-sm font-semibold disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          {t(into ? "albumStartInto" : "albumStart")}
        </button>
      </div>
    </form>
  );
}
