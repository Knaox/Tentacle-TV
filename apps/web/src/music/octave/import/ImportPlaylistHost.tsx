/**
 * Octave — l'IMPORT d'une playlist, monté une fois par la coquille. Trois voies : un LIEN ou une liste collée
 * (capacité `music.playlistImport`), UN ALBUM de la bibliothèque, des FICHIERS de l'ordinateur (l'extension qui
 * importe des fichiers) — `useImportInto` pour ces deux-là. Ouverte depuis une playlist, la boîte y verse un album
 * ou des fichiers (« Importer dans « … » »). L'état vit HORS de la boîte : la fermer pendant le travail le laisse
 * continuer, et un avis dit sa fin (« Ouvrir »). Aucune voie : rien n'est rendu.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useImportInto, useMusicImport, type ImportIntoState, type ImportIntoTarget, type ImportUserInput } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../contexts/ToastContext";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { octavePaths } from "../octavePaths";
import { albumHintOfFiles, toLocalFiles, type PickedFiles } from "../releases/webReleaseFiles";
import { ImportForm } from "./ImportForm";
import { ImportProgress } from "./ImportProgress";
import { ImportResult } from "./ImportResult";
import { ImportAlbumPane } from "./into/ImportAlbumPane";
import { ImportFilesPane } from "./into/ImportFilesPane";
import { ImportIntoStatus } from "./into/ImportIntoStatus";
import { ImportModeTabs, type ImportMode } from "./into/ImportModeTabs";
import { closeImportDialog, importDialogOpen, importDialogTarget, subscribeImportDialog, takeImportPrefill } from "./importStore";

export function ImportPlaylistHost() {
  const { t, i18n } = useTranslation("musicImport");
  const open = useSyncExternalStore(subscribeImportDialog, importDialogOpen, () => false);
  const target = useSyncExternalStore(subscribeImportDialog, importDialogTarget, () => null);
  const provider = useOctaveProvider();
  const handle = useMusicImport(provider);
  const into = useImportInto(provider);
  const navigate = useNavigate();
  const toast = useToast();
  const titleId = useId();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ImportMode>("link");
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    // Un lien de partage ouvert depuis sa page (`/octave/import?share=`) : déjà collé, prêt à importer.
    const prefill = open ? takeImportPrefill() : null;
    if (prefill && handle.state === null) setText(prefill);
  }, [open, handle.state]);

  const modes = useMemo(
    () => [...(handle.available && !target ? (["link"] as const) : []), ...(into.albumAvailable ? (["album"] as const) : []), ...(into.filesAvailable ? (["files"] as const) : [])],
    [handle.available, into.albumAvailable, into.filesAvailable, target],
  );
  const shown: ImportMode | undefined = modes.includes(mode) ? mode : modes[0];

  const { start, reset } = handle;
  const go = useCallback(
    async (input: ImportUserInput) => {
      const final = await start(input);
      const summary = final?.summary;
      // Boîte fermée pendant le travail : l'avis dit la fin, et mène à la playlist.
      if (summary && !openRef.current) {
        toast.show("success", t("inLibrary", { count: summary.inLibrary }), {
          title: t("toastDone", { name: summary.name }),
          action: { label: t("open"), onPress: () => navigate(octavePaths.playlist(summary.playlistId)) },
        });
        reset();
      } else if (final?.phase === "failed" && !openRef.current) {
        toast.show("error", t(`failure.${final.failure ?? "network"}`), { title: t("title") });
        reset();
      }
    },
    [start, reset, toast, t, navigate],
  );

  const { reset: resetInto } = into;
  /** La fin d'un album ou de fichiers, boîte fermée : un avis, et « Ouvrir ». */
  const settleInto = useCallback(
    (final: ImportIntoState | null) => {
      if (!final || openRef.current) return;
      if (final.phase === "done" && final.result) {
        const { playlistId, name, added } = final.result;
        toast.show("success", t("intoDone", { count: added, name }), { title: t("toastDone", { name }), action: { label: t("open"), onPress: () => navigate(octavePaths.playlist(playlistId)) } });
        resetInto();
      } else if (final.phase === "failed") {
        toast.show("error", final.failure === "empty" || final.failure === "network" ? t(`intoFailure.${final.failure}`) : t("intoFailure.failed"), { title: t("title") });
        resetInto();
      }
    },
    [navigate, resetInto, t, toast],
  );
  const intoTarget = (): ImportIntoTarget =>
    target
      ? { kind: "existing", playlistId: target.playlistId, name: target.name }
      : { kind: "new", name: null, fallbackName: t("defaultName", { date: new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long" }).format(new Date()) }) };
  const startAlbum = (album: MusicAlbum) => void into.importAlbum(album, intoTarget()).then(settleInto);
  const startFiles = (picked: PickedFiles, name: string) => {
    const base = intoTarget();
    const chosen: ImportIntoTarget = base.kind === "new" ? { ...base, name: name || null } : base;
    void into.importFiles(toLocalFiles(picked.files), albumHintOfFiles(picked.files), chosen).then(settleInto);
  };

  if (!open || !shown) return null;
  const linkState = handle.state;
  const intoState = into.state;
  const running = (linkState !== null && linkState.phase !== "done" && linkState.phase !== "failed") || (intoState !== null && intoState.phase !== "done" && intoState.phase !== "failed");
  const dismiss = () => {
    // Fini : on oublie ; en cours : on laisse travailler (l'avis viendra).
    if (linkState && !running) {
      reset();
      setText("");
    }
    if (intoState && !running) resetInto();
    closeImportDialog();
  };
  const openPlaylist = (playlistId: string) => {
    reset();
    resetInto();
    setText("");
    closeImportDialog();
    navigate(octavePaths.playlist(playlistId));
  };
  const tabs = <ImportModeTabs modes={modes} value={shown} onChange={setMode} />;

  let body;
  if (intoState) {
    body = (
      <ImportIntoStatus titleId={titleId} state={intoState} release={into.release} onHide={closeImportDialog} onCancel={into.cancel} onResume={() => void into.resume().then(settleInto)} onOpen={openPlaylist} onRetry={resetInto} onClose={dismiss} />
    );
  } else if (linkState && linkState.phase !== "done" && linkState.phase !== "failed") {
    body = <ImportProgress titleId={titleId} state={linkState} outsideExpected={handle.outsideSupported} onHide={closeImportDialog} onCancel={() => handle.cancel()} />;
  } else if (linkState) {
    body = <ImportResult titleId={titleId} state={linkState} onOpen={openPlaylist} onAnother={reset} onClose={dismiss} />;
  } else if (shown === "link") {
    body = (
      <ImportForm
        titleId={titleId}
        value={text}
        onChange={setText}
        extensionSources={handle.extensionSources}
        tentacleShare={handle.tentacleShare}
        outsideSupported={handle.outsideSupported}
        onStart={(input) => void go(input)}
        onCancel={dismiss}
        tabs={tabs}
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
          {target ? t("intoTitle", { name: target.name }) : t("title")}
        </h2>
        {tabs}
        {shown === "album" ? <ImportAlbumPane into={!!target} onStart={startAlbum} onCancel={dismiss} /> : <ImportFilesPane into={!!target} onStart={startFiles} onCancel={dismiss} />}
      </div>
    );
  }

  return (
    <Modal open onClose={dismiss} maxWidth={520} labelledBy={titleId} dismissOnBackdrop={!running}>
      <div className="p-6">{body}</div>
    </Modal>
  );
}
