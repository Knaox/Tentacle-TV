/**
 * Octave — l'IMPORT d'une playlist, monté une fois par la coquille. L'état de
 * l'import vit ICI, pas dans la boîte : la fermer pendant le travail le
 * laisse continuer, et un avis dit sa fin (« Ouvrir »). Sans la capacité
 * `music.playlistImport`, rien n'est rendu.
 */

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMusicImport, type ImportUserInput } from "@tentacle-tv/api-client";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../contexts/ToastContext";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { octavePaths } from "../octavePaths";
import { ImportForm } from "./ImportForm";
import { ImportProgress } from "./ImportProgress";
import { ImportResult } from "./ImportResult";
import { closeImportDialog, importDialogOpen, subscribeImportDialog, takeImportPrefill } from "./importStore";

export function ImportPlaylistHost() {
  const { t } = useTranslation("musicImport");
  const open = useSyncExternalStore(subscribeImportDialog, importDialogOpen, () => false);
  const handle = useMusicImport(useOctaveProvider());
  const navigate = useNavigate();
  const toast = useToast();
  const titleId = useId();
  const [text, setText] = useState("");
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    // Un lien de partage ouvert depuis sa page (`/octave/import?share=`) : déjà collé, prêt à importer.
    const prefill = open ? takeImportPrefill() : null;
    if (prefill && handle.state === null) setText(prefill);
  }, [open, handle.state]);

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

  if (!handle.available || !open) return null;
  const state = handle.state;
  const running = state !== null && state.phase !== "done" && state.phase !== "failed";
  const finished = state !== null && !running;
  const restart = () => {
    reset();
  };
  const dismiss = () => {
    // Fini : on oublie ; en cours : on laisse travailler (l'avis viendra).
    if (finished) {
      reset();
      setText("");
    }
    closeImportDialog();
  };

  return (
    <Modal open onClose={dismiss} maxWidth={520} labelledBy={titleId} dismissOnBackdrop={!running}>
      <div className="p-6">
        {state === null && (
          <ImportForm
            titleId={titleId}
            value={text}
            onChange={setText}
            extensionSources={handle.extensionSources}
            tentacleShare={handle.tentacleShare}
            outsideSupported={handle.outsideSupported}
            onStart={(input) => void go(input)}
            onCancel={dismiss}
          />
        )}
        {running && (
          <ImportProgress
            titleId={titleId}
            state={state}
            outsideExpected={handle.outsideSupported}
            onHide={closeImportDialog}
            onCancel={() => {
              handle.cancel();
            }}
          />
        )}
        {finished && (
          <ImportResult
            titleId={titleId}
            state={state}
            onOpen={(playlistId) => {
              reset();
              setText("");
              closeImportDialog();
              navigate(octavePaths.playlist(playlistId));
            }}
            onAnother={restart}
            onClose={dismiss}
          />
        )}
      </div>
    </Modal>
  );
}
