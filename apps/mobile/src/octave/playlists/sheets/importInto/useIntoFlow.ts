/**
 * Octave mobile — l'import d'un album ou de fichiers vers une playlist, côté feuille : lancer (`useImportInto`, morceaux
 * de 2 Mo comme la chaîne des sorties), reprendre SEUL un envoi en pause au retour au premier plan, et — feuille
 * refermée pendant le travail — un avis qui dit la fin et mène à la playlist.
 */

import { useCallback, useEffect, type MutableRefObject } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import { useImportInto, type ImportIntoState, type ImportIntoTarget } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { haptic } from "@/utils/haptics";
import { showNotice, useOctavePagesProvider } from "../../../pages";
import { toReleaseFiles, type PhonePick } from "../../../releases/phoneReleaseFiles";

const MOBILE_CHUNK_BYTES = 2 * 1024 * 1024;

export interface IntoPlaylist {
  playlistId: string;
  name: string;
}

export function useIntoFlow(openRef: MutableRefObject<boolean>, openPlaylist: (id: string) => void, into: IntoPlaylist | null) {
  const { t, i18n } = useTranslation("musicImport");
  const handle = useImportInto(useOctavePagesProvider(), MOBILE_CHUNK_BYTES);
  const { reset, resume } = handle;

  const settle = useCallback(
    (final: ImportIntoState | null) => {
      if (!final) return;
      if (final.phase === "done") haptic("success");
      if (openRef.current) return;
      if (final.phase === "done" && final.result) {
        const { playlistId, name, added } = final.result;
        showNotice("success", t("intoDone", { count: added, name }), { title: t("toastDone", { name }), action: { label: t("open"), onPress: () => openPlaylist(playlistId) } });
        reset();
      } else if (final.phase === "failed") {
        showNotice("error", final.failure === "empty" || final.failure === "network" ? t(`intoFailure.${final.failure}`) : t("intoFailure.failed"), { title: t("title") });
        reset();
      }
    },
    [openPlaylist, openRef, reset, t],
  );

  // Un envoi en pause (réseau coupé, app en arrière-plan) repart seul au retour au premier plan.
  const paused = handle.state?.phase === "paused";
  useEffect(() => {
    if (!paused) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void resume().then(settle);
    });
    return () => sub.remove();
  }, [paused, resume, settle]);

  const target = useCallback(
    (name: string | null): ImportIntoTarget =>
      into
        ? { kind: "existing", playlistId: into.playlistId, name: into.name }
        : { kind: "new", name, fallbackName: t("defaultName", { date: new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long" }).format(new Date()) }) },
    [i18n.language, into, t],
  );
  const startAlbum = useCallback((album: MusicAlbum) => void handle.importAlbum(album, target(null)).then(settle), [handle, settle, target]);
  const startFiles = useCallback(
    (pick: PhonePick, name: string) => void handle.importFiles(toReleaseFiles(pick.files), undefined, target(name || null)).then(settle),
    [handle, settle, target],
  );
  const resumeNow = useCallback(() => void resume().then(settle), [resume, settle]);

  return { handle, startAlbum, startFiles, resumeNow };
}
