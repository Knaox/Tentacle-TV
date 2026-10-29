/**
 * Octave — l'IMPORT D'UNE SORTIE (lien Bandcamp, fichiers audio), monté une fois par la coquille. Sans le point
 * `releases` déclaré par l'extension, rien n'est rendu ni écouté. L'état vit dans api-client (`useReleaseImport`) :
 * fermer la boîte pendant le transfert le laisse continuer, et un avis dit sa fin (« Ouvrir l'album »).
 *
 * Des fichiers audio déposés N'IMPORTE OÙ dans Octave ouvrent la boîte avec eux (le bureau ne les ouvre plus
 * comme une page) ; un dépôt qui ne porte pas de fichiers n'est pas touché (le glisser des titres reste le leur).
 */

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { releaseArrival, useReleaseImport, type ReleaseFlowState } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../contexts/ToastContext";
import { rememberAlbumPreview } from "../data/albumPreview";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { entityTarget, octavePaths } from "../octavePaths";
import { closeReleaseDialog, openReleaseDialog, releaseDialogOpen, subscribeReleaseDialog, takeReleasePrefill } from "./releaseDialogStore";
import { ReleaseImportForm } from "./ReleaseImportForm";
import { ReleaseImportProgress } from "./ReleaseImportProgress";
import { ReleaseImportResult } from "./ReleaseImportResult";
import { albumHintOfFiles, pickAudio, toLocalFiles, type PickedFiles } from "./webReleaseFiles";

const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");

export function ReleaseImportHost() {
  const { t } = useTranslation("musicReleases");
  const open = useSyncExternalStore(subscribeReleaseDialog, releaseDialogOpen, () => false);
  const handle = useReleaseImport(useOctaveProvider());
  const navigate = useNavigate();
  const toast = useToast();
  const titleId = useId();
  const [link, setLink] = useState("");
  const [picked, setPicked] = useState<PickedFiles | null>(null);
  const openRef = useRef(open);
  const available = handle.available;
  const allowFiles = handle.sources.includes("files");

  useEffect(() => {
    openRef.current = open;
    const prefill = open ? takeReleasePrefill() : null;
    if (!prefill || handle.state) return;
    if (prefill.kind === "link") setLink(prefill.url);
    else setPicked(pickAudio(prefill.files));
  }, [open, handle.state]);

  // Des fichiers déposés n'importe où dans Octave : la boîte s'ouvre avec eux.
  useEffect(() => {
    if (!available || !allowFiles) return;
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented || !e.dataTransfer?.files.length) return;
      e.preventDefault();
      openReleaseDialog({ kind: "files", files: [...e.dataTransfer.files] });
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [available, allowFiles]);

  const goTo = useCallback(
    (album: MusicAlbum) => {
      const target = entityTarget(album);
      if (!target) return;
      rememberAlbumPreview(target, album);
      navigate(octavePaths.album(target));
    },
    [navigate],
  );

  const { reset } = handle;
  const finish = useCallback(
    (final: ReleaseFlowState | null) => {
      if (!final || openRef.current) return;
      // Boîte fermée pendant le travail : l'avis dit la fin, et mène à l'album.
      const album = releaseArrival(final.job);
      if (final.phase === "done" && album) {
        toast.show("success", album.artists.map((a) => a.name).join(", "), { title: t("toastDone", { name: album.title }), action: { label: t("openAlbum"), onPress: () => goTo(album) } });
        reset();
      } else if (final.phase === "failed") {
        toast.show("error", t(`refusal.${final.refusal ?? "failed"}`), { title: t("phase.failed") });
        reset();
      } else if (final.phase === "paused") {
        toast.show("error", t("pausedHint"), { title: t("phase.paused"), action: { label: t("resume"), onPress: () => openReleaseDialog() } });
      }
    },
    [goTo, reset, t, toast],
  );

  if (!available || !open) return null;
  const state = handle.state;
  const running = state !== null && state.phase !== "done" && state.phase !== "failed";
  const finished = state !== null && !running;
  const clearForm = () => {
    setLink("");
    setPicked(null);
  };
  const dismiss = () => {
    if (finished) {
      reset();
      clearForm();
    }
    closeReleaseDialog();
  };

  return (
    <Modal open onClose={dismiss} maxWidth={520} labelledBy={titleId} dismissOnBackdrop={!running}>
      <div className="p-6">
        {state === null && (
          <ReleaseImportForm
            titleId={titleId}
            sources={handle.sources}
            link={link}
            onLinkChange={setLink}
            picked={picked}
            onPick={setPicked}
            onImportLink={(url) => void handle.startLink(url).then(finish)}
            onImportFiles={() => picked && void handle.startFiles(toLocalFiles(picked.files), albumHintOfFiles(picked.files)).then(finish)}
            onCancel={dismiss}
          />
        )}
        {running && <ReleaseImportProgress titleId={titleId} state={state} onHide={closeReleaseDialog} onCancel={handle.cancel} onResume={() => void handle.resume().then(finish)} />}
        {finished && (
          <ReleaseImportResult
            titleId={titleId}
            state={state}
            onOpen={(album) => {
              reset();
              clearForm();
              closeReleaseDialog();
              goTo(album);
            }}
            onAnother={() => {
              reset();
              clearForm();
            }}
            onClose={dismiss}
          />
        )}
      </div>
    </Modal>
  );
}
