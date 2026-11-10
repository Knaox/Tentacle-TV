/**
 * Les vues du labo du hors ligne : chacune monte un VRAI écran de l'axe, tel que l'application
 * le monte. `queue` : l'état de la file qu'elle demande par défaut ; `path` : la route où elle se
 * rend (les fiches locales lisent leurs paramètres dans l'adresse).
 */

import { useEffect, useState, type ComponentType } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { DeleteDownloadModal } from "../../downloads/DeleteDownloadModal";
import { DetailDownloadAction } from "../../downloads/DetailDownloadAction";
import { CardDownloadAction } from "../../downloads/CardDownloadAction";
import { DownloadDialog } from "../../downloads/DownloadDialog";
import { DownloadsNavButton } from "../../downloads/DownloadsNavButton";
import { DownloadsPage } from "../../downloads/DownloadsPage";
import { EpisodeDownloadAction } from "../../downloads/EpisodeDownloadAction";
import { OfflineCatalog } from "../../downloads/OfflineCatalog";
import { OfflineModeToggle } from "../../downloads/OfflineModeToggle";
import { SeasonDownloadAction } from "../../downloads/SeasonDownloadAction";
import { ConnectivityChip } from "../../offline/ConnectivityChip";
import { OfflineSwitchBanner } from "../../offline/OfflineSwitchBanner";
import { probeNow, getConnectivitySnapshot } from "../../offline/connectivityStore";
import { LAB_KEPT_SERIES_KEY, LAB_MOVIE, LAB_MOVIES, LAB_SEASON, LAB_SERIES_EPISODES } from "./labData";
import type { QueueState } from "./labQueue";

export interface LabView {
  id: string;
  queue: QueueState;
  /** La route du routeur du banc. */
  path: string;
  Component: ComponentType<{ state: QueueState }>;
}

/** La barre du haut, réduite à ce que l'axe y possède : le bouton et sa jauge. */
function TopBarStrip() {
  return (
    <div className="fixed right-4 top-3 z-30 flex h-[46px] items-center gap-1 rounded-pill bg-surface-1 px-1 shadow-edge" data-lab-bar>
      <ConnectivityChip />
      <DownloadsNavButton />
    </div>
  );
}

const noop = (): void => undefined;

function Dialog({ items, mode }: { items: MediaItem[]; mode?: "single" | "season" | "series" }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex min-h-screen items-start justify-center p-10">
      <button type="button" className="btn btn-soft" onClick={() => setOpen(true)}>Rouvrir la feuille</button>
      {open && <DownloadDialog items={items} mode={mode} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Queue() {
  return (
    <>
      <TopBarStrip />
      <DownloadsPage />
    </>
  );
}

function Catalogue() {
  return <OfflineCatalog />;
}

/** Les boutons de l'axe, dans leurs états : au repos, en route (ils lisent la file), sur la machine. */
function Buttons() {
  const idle = LAB_MOVIES[0] as MediaItem; // Sintel : déjà sur la machine dans la bibliothèque du labo
  const active = LAB_SEASON[0] as MediaItem; // l'épisode en transfert du lot
  const fresh = { ...LAB_MOVIE, Id: "pas-encore" } as MediaItem;
  const row = "flex flex-wrap items-center gap-4";
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-8 px-6 pb-16 pt-24">
      <TopBarStrip />
      <h1 className="font-display text-display-3">Les boutons</h1>
      <section className="flex flex-col gap-3">
        <span className="ui-eyebrow">Fiche — sur la page (pas encore · en route · sur la machine)</span>
        <div className={row}>
          <DetailDownloadAction item={fresh} />
          <DetailDownloadAction item={active} />
          <DetailDownloadAction item={idle} />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <span className="ui-eyebrow">Fiche — dans la capsule, sur le décor</span>
        <div className="flex h-14 w-fit items-center gap-0.5 rounded-full px-1.5" style={{ background: "#2a2f36" }}>
          <DetailDownloadAction item={fresh} variant="capsule" />
          <DetailDownloadAction item={active} variant="capsule" />
          <DetailDownloadAction item={idle} variant="capsule" />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <span className="ui-eyebrow">Carte — plateau du survol et pastille seule, sur l'image</span>
        <div className="flex w-fit items-center gap-3 rounded-tile p-3" style={{ background: "#5b4033" }}>
          <CardDownloadAction item={fresh} tone="tray" tray={{ box: "h-8 w-8", icon: "h-4 w-4" }} />
          <CardDownloadAction item={active} tone="tray" tray={{ box: "h-8 w-8", icon: "h-4 w-4" }} />
          <CardDownloadAction item={idle} tone="tray" tray={{ box: "h-8 w-8", icon: "h-4 w-4" }} />
          <CardDownloadAction item={fresh} variant="inline" />
          <CardDownloadAction item={active} variant="inline" />
          <CardDownloadAction item={idle} variant="inline" />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <span className="ui-eyebrow">Ligne d'épisode et barre de saison</span>
        <div className={row}>
          <EpisodeDownloadAction episode={{ ...active, Id: "ep-libre" } as MediaItem} />
          <EpisodeDownloadAction episode={active} />
          <EpisodeDownloadAction episode={{ ...active, Id: "spr-s1e1" } as MediaItem} />
          <SeasonDownloadAction episodes={LAB_SEASON} />
        </div>
      </section>
    </div>
  );
}

/** Le passage hors ligne : le message temporaire, la pastille de la barre et sa bulle, la bascule. */
function Notices() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Le serveur factice ne répond plus : deux sondes, et le magasin bascule de lui-même.
    void (async () => {
      for (let i = 0; i < 6 && getConnectivitySnapshot().state !== "offline-auto"; i += 1) await probeNow(true);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-6 pb-16 pt-72" data-lab-ready={ready}>
      <TopBarStrip />
      <OfflineSwitchBanner />
      <h1 className="font-display text-display-3">Le mode hors ligne</h1>
      <OfflineModeToggle />
    </div>
  );
}

function Deletion() {
  return (
    <div className="p-10">
      <DeleteDownloadModal title="Sueurs froides" busy={false} onConfirm={noop} onClose={noop} />
    </div>
  );
}

export const LAB_VIEWS: LabView[] = [
  { id: "feuille-film", queue: "repos", path: "/", Component: () => <Dialog items={[LAB_MOVIE]} /> },
  { id: "feuille-episode", queue: "repos", path: "/", Component: () => <Dialog items={[LAB_SEASON[2] as MediaItem]} /> },
  { id: "feuille-saison", queue: "milieu", path: "/", Component: () => <Dialog items={LAB_SEASON} mode="season" /> },
  { id: "feuille-serie", queue: "repos", path: "/", Component: () => <Dialog items={LAB_SERIES_EPISODES} mode="series" /> },
  { id: "file", queue: "debut", path: "/downloads", Component: Queue },
  { id: "catalogue", queue: "repos", path: "/on-device", Component: Catalogue },
  { id: "serie", queue: "repos", path: `/offline/series/${LAB_KEPT_SERIES_KEY}`, Component: Catalogue },
  { id: "film", queue: "repos", path: "/offline/item/bbb", Component: Catalogue },
  { id: "boutons", queue: "debut", path: "/", Component: Buttons },
  { id: "avis", queue: "repos", path: "/", Component: Notices },
  { id: "suppression", queue: "repos", path: "/", Component: Deletion },
];

export function labViewOf(id: string | null): LabView {
  return LAB_VIEWS.find((view) => view.id === id) ?? (LAB_VIEWS[4] as LabView);
}
