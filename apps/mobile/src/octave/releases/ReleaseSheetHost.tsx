/**
 * Octave mobile — l'HÔTE de la feuille « Importer une sortie », monté une fois au-dessus de la coquille (registre :
 * `overlays`). Sans le point `releases` de l'extension (et une source déclarée), rien n'est rendu. L'état de
 * l'import vit dans api-client (`useReleaseImport`) : refermer la feuille laisse le transfert continuer, et un avis
 * dit sa fin (« Ouvrir l'album »). Un LIEN partagé part sans attendre (le partage EST le geste) ; des FICHIERS
 * partagés attendent « Importer » dans la feuille.
 * Le mobile envoie par morceaux de 2 Mo (lus et encodés sur le fil JavaScript : rien de visible n'y attend).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useReleaseImport, releaseArrival, type ReleaseFlowState } from "@tentacle-tv/api-client";
import { rememberAlbumPreview } from "@tentacle-tv/shared/octave";
import { entityTarget, octavePaths } from "@tentacle-tv/shared/octave/mode";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { showNotice, useOctavePagesProvider } from "../pages";
import { ReleaseFormView } from "./ReleaseFormView";
import { ReleaseProgressView } from "./ReleaseProgressView";
import { closeReleaseSheet, openReleaseSheet, takeReleasePrefill, useReleaseSheet } from "./releaseSheetStore";
import { keepAudio, pickPhoneAudio, toReleaseFiles, type PhonePick } from "./phoneReleaseFiles";

const MOBILE_CHUNK_BYTES = 2 * 1024 * 1024;

export function ReleaseSheetHost() {
  const { t } = useTranslation("musicReleases");
  const theme = useTheme();
  const router = useRouter();
  const { open, version } = useReleaseSheet();
  const handle = useReleaseImport(useOctavePagesProvider(), MOBILE_CHUNK_BYTES);
  const [link, setLink] = useState("");
  const [picked, setPicked] = useState<PhonePick | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const goTo = useCallback(
    (album: MusicAlbum) => {
      const target = entityTarget(album);
      if (!target) return;
      rememberAlbumPreview(target, album);
      router.push(octavePaths.album(target) as never);
    },
    [router],
  );
  const { reset, startLink, startFiles } = handle;
  const finish = useCallback(
    (final: ReleaseFlowState | null) => {
      if (!final) return;
      if (final.phase === "done") haptic("success");
      if (openRef.current) return;
      // Feuille refermée pendant le travail : l'avis dit la fin, et mène à l'album.
      const album = releaseArrival(final.job);
      if (final.phase === "done" && album) {
        showNotice("success", album.artists.map((a) => a.name).join(", "), { title: t("toastDone", { name: album.title }), action: { label: t("openAlbum"), onPress: () => goTo(album) } });
        reset();
      } else if (final.phase === "failed") {
        showNotice("error", t(`refusal.${final.refusal ?? "failed"}`), { title: t("phase.failed") });
        reset();
      } else if (final.phase === "paused") {
        showNotice("error", t("pausedHint"), { title: t("phase.paused"), action: { label: t("resume"), onPress: () => openReleaseSheet() } });
      }
    },
    [goTo, reset, t],
  );
  const runFiles = useCallback((pick: PhonePick) => void startFiles(toReleaseFiles(pick.files)).then(finish), [finish, startFiles]);

  // Ce que la feuille reçoit (partage système), une fois par demande — seulement quand l'import est offert : une
  // demande arrivée avant la liste des extensions attend. Des fichiers s'ajoutent à ceux déjà choisis.
  const { available } = handle;
  useEffect(() => {
    if (!open || !available || handle.state) return;
    const prefill = takeReleasePrefill();
    if (!prefill || prefill.kind === "empty") return;
    if (prefill.kind === "link") {
      setLink(prefill.url);
      if (prefill.autoStart) void startLink(prefill.url).then(finish);
    } else {
      setPicked((before) => keepAudio([...(before?.files ?? []), ...prefill.files]));
    }
  }, [available, finish, handle.state, open, startLink, version]);

  // Le système a suspendu l'app pendant un transfert (arrière-plan) : il repart seul au retour, de ce que le serveur
  // tient déjà — jamais du début.
  const { resume } = handle;
  const paused = handle.state?.phase === "paused";
  useEffect(() => {
    if (!paused) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void resume().then(finish);
    });
    return () => sub.remove();
  }, [finish, paused, resume]);

  if (!handle.available) return null;
  const state = handle.state;
  const finished = state !== null && (state.phase === "done" || state.phase === "failed");
  const clearForm = () => {
    setLink("");
    setPicked(null);
  };
  const close = () => {
    if (finished) {
      reset();
      clearForm();
    }
    closeReleaseSheet();
  };
  const choose = () => {
    void pickPhoneAudio()
      .then((pick) => pick && setPicked(pick))
      .catch(() => showNotice("error", t("refusal.failed"), { title: t("title") }));
  };

  return (
    <BottomSheet visible={open} onClose={close} snapPoints={[0.7, 0.94]} avoidKeyboard header={<Text style={[typography.subtitle, styles.title, { color: theme.colors.text.primary }]}>{t(state?.phase === "done" ? "phase.done" : "title")}</Text>}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {state === null ? (
          <ReleaseFormView
            sources={handle.sources}
            link={link}
            onLink={setLink}
            picked={picked}
            onPick={choose}
            onClear={() => setPicked(null)}
            onImportLink={(url) => void startLink(url).then(finish)}
            onImportFiles={() => picked && runFiles(picked)}
          />
        ) : (
          <ReleaseProgressView
            state={state}
            onHide={closeReleaseSheet}
            onCancel={handle.cancel}
            onResume={() => void handle.resume().then(finish)}
            onOpen={(album) => {
              reset();
              clearForm();
              closeReleaseSheet();
              goTo(album);
            }}
            onAnother={() => {
              reset();
              clearForm();
            }}
          />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 20, paddingBottom: 8 },
  body: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
});
