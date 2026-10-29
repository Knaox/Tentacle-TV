/**
 * Octave mobile — IMPORTER une playlist. Trois voies : « Lien ou liste » (ci-dessous), « Un album » et « Fichiers »
 * du téléphone (`importInto/`, `useImportInto`) ; ouverte depuis une playlist, la feuille y verse un album ou des
 * fichiers. Le lien : (Spotify, Apple Music, Deezer, ou celui d'un ami sur SON
 * Tentacle) ou une liste collée. Le déroulé est celui du bureau (`useMusicImport`, `classifyPasted`,
 * `importFraction`) : ce qu'Octave comprend du collage sous le champ, l'avancée, puis le résultat et
 * « Ouvrir la playlist ». L'état vit dans l'hôte (monté une fois) : refermer la feuille laisse travailler, un
 * avis dit la fin. Sans la capacité `music.playlistImport`, aucune entrée n'est offerte.
 * `autoStart` (partage système vers Tentacle TV : le partage EST le geste) : un lien lisible part aussitôt ;
 * un lien que rien ne lit encore reste collé, en attente d'« Importer ».
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { classifyPasted, importFraction, useMusicImport, type ImportUserInput } from "@tentacle-tv/api-client";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { showNotice, useOctavePagesProvider } from "../../pages";
import { closePlaylistSheet } from "./playlistSheetStore";
import { OctavePlayButton } from "../../layout/OctavePlayButton";
import { AlbumChoice } from "./importInto/AlbumChoice";
import { FilesChoice } from "./importInto/FilesChoice";
import { IntoStatusView } from "./importInto/IntoStatusView";
import { ModeSwitch, type ImportMode } from "./importInto/ModeSwitch";
import { useIntoFlow, type IntoPlaylist } from "./importInto/useIntoFlow";

export function ImportFlow({ open, prefill, autoStart, into = null }: { open: boolean; prefill?: string; autoStart?: boolean; into?: IntoPlaylist | null }) {
  const { t } = useTranslation("musicImport");
  const theme = useTheme();
  const router = useRouter();
  const handle = useMusicImport(useOctavePagesProvider());
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ImportMode>("link");
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (open && prefill && handle.state === null) setText(prefill);
  }, [handle.state, open, prefill]);
  const pasted = useMemo(() => classifyPasted(text, handle.extensionSources, handle.tentacleShare), [handle.extensionSources, handle.tentacleShare, text]);
  const input: ImportUserInput | null = (pasted.kind === "url" && pasted.readable) || pasted.kind === "text" ? pasted.input : null;
  const { start, reset } = handle;
  const openPlaylist = useCallback(
    (id: string) => {
      reset();
      setText("");
      closePlaylistSheet();
      router.push(octavePaths.playlist(id) as never);
    },
    [reset, router],
  );
  const intoFlow = useIntoFlow(openRef, openPlaylist, into);
  const intoHandle = intoFlow.handle;
  const modes = useMemo(
    () => [...(handle.available && !into ? (["link"] as const) : []), ...(intoHandle.albumAvailable ? (["album"] as const) : []), ...(intoHandle.filesAvailable ? (["files"] as const) : [])],
    [handle.available, into, intoHandle.albumAvailable, intoHandle.filesAvailable],
  );
  const shown: ImportMode | undefined = modes.includes(mode) ? mode : modes[0];
  const go = useCallback(async (override?: ImportUserInput) => {
    const chosen = override ?? input;
    if (!chosen) return;
    const final = await start(chosen);
    const summary = final?.summary;
    if (summary) haptic("success");
    // Feuille refermée pendant le travail : l'avis dit la fin, et mène à la playlist.
    if (summary && !openRef.current) {
      showNotice("success", t("inLibrary", { count: summary.inLibrary }), { title: t("toastDone", { name: summary.name }), action: { label: t("open"), onPress: () => openPlaylist(summary.playlistId) } });
      reset();
      setText("");
    } else if (final?.phase === "failed" && !openRef.current) {
      showNotice("error", t(`failure.${final.failure ?? "network"}`), { title: t("title") });
      reset();
    }
  }, [input, openPlaylist, reset, start, t]);
  // Un même lien partagé ne part qu'une fois, même si la feuille se rouvre avec lui.
  const autoStarted = useRef<string | null>(null);
  const { available, extensionSources, tentacleShare } = handle;
  useEffect(() => {
    if (!open || !autoStart || !prefill || !available || handle.state !== null || autoStarted.current === prefill) return;
    const shared = classifyPasted(prefill, extensionSources, tentacleShare);
    if (shared.kind !== "url" || !shared.readable) return;
    autoStarted.current = prefill;
    void go(shared.input);
  }, [autoStart, available, extensionSources, go, handle.state, open, prefill, tentacleShare]);

  if (!shown) return null;
  const state = handle.state;
  const intoState = intoHandle.state;
  const running = state !== null && state.phase !== "done" && state.phase !== "failed";
  const intoRunning = intoState !== null && intoState.phase !== "done" && intoState.phase !== "failed";
  const close = () => {
    if (state && !running) {
      reset();
      setText("");
    }
    if (intoState && !intoRunning) intoHandle.reset();
    closePlaylistSheet();
  };
  const openInto = (id: string) => {
    intoHandle.reset();
    openPlaylist(id);
  };

  let hint = t("sources");
  let tone: "ok" | "warn" | "muted" = "muted";
  if (pasted.kind === "url") {
    const source = t(`source.${pasted.source}`);
    hint = pasted.readable ? t(pasted.album ? "recognizedAlbum" : "recognized", { source }) : pasted.source === "tentacle" ? t("notRecognized") : t("needsExtension");
    tone = pasted.readable ? "ok" : "warn";
  } else if (pasted.kind === "unknownUrl") [hint, tone] = [t("notRecognized"), "warn"];
  else if (pasted.kind === "text") [hint, tone] = [t("recognizedText", { count: pasted.lines }), "ok"];
  const toneColor = tone === "warn" ? theme.colors.statusPairs.warning.fg : tone === "ok" ? theme.colors.text.primary : theme.colors.text.tertiary;
  const fraction = state ? importFraction(state, handle.outsideSupported) : 0;

  return (
    <BottomSheet
      visible={open}
      onClose={close}
      snapPoints={[0.7, 0.94]}
      avoidKeyboard
      header={<Text style={[typography.subtitle, styles.title, { color: theme.colors.text.primary }]}>{into ? t("intoTitle", { name: into.name }) : state?.name || t("title")}</Text>}
    >
      {/* Le clavier levé, tout ne tient plus : le contenu défile, et un toucher sur un bouton agit du premier coup. */}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {intoState ? (
          <IntoStatusView state={intoState} release={intoHandle.release} onHide={closePlaylistSheet} onCancel={intoHandle.cancel} onResume={intoFlow.resumeNow} onOpen={openInto} onRetry={intoHandle.reset} />
        ) : state === null && shown !== "link" ? (
          <>
            <ModeSwitch modes={modes} value={shown} onChange={setMode} />
            {shown === "album" ? <AlbumChoice into={!!into} onStart={intoFlow.startAlbum} /> : <FilesChoice into={!!into} onStart={intoFlow.startFiles} />}
          </>
        ) : state === null ? (
          <>
            <ModeSwitch modes={modes} value={shown} onChange={setMode} />
            <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("intro")}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              placeholder={t("placeholder")}
              placeholderTextColor={theme.colors.text.quaternary}
              accessibilityLabel={t("fieldLabel")}
              style={[typography.caption, styles.field, { color: theme.colors.text.primary, backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}
            />
            <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: toneColor }]}>{hint}</Text>
            <Text style={[typography.small, { color: theme.colors.text.tertiary }]}>{t(handle.outsideSupported ? "withOutside" : "libraryOnly")}</Text>
            <OctavePlayButton label={t("start")} Icon={null} onPress={() => void go()} disabled={!input} style={styles.primary} />
          </>
        ) : running ? (
          <>
            <Text style={[typography.body, { color: theme.colors.text.primary }]}>{t(`step.${state.phase === "reading" || state.phase === "matching" || state.phase === "creating" || state.phase === "outside" ? state.phase : "reading"}`)}</Text>
            {state.phase === "matching" && state.total > 0 ? (
              <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{`${t("progress", { done: state.matched, total: state.total })} · ${t("foundSoFar", { count: state.found })}`}</Text>
            ) : null}
            <View style={[styles.track, { backgroundColor: theme.colors.fill.subtle }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
              <View style={[styles.bar, { width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.colors.brand.accent }]} />
            </View>
            <Pressable onPress={closePlaylistSheet} accessibilityRole="button" style={styles.secondary}>
              <Text style={[typography.bodyBold, { color: theme.colors.text.secondary }]}>{t("hide")}</Text>
            </Pressable>
          </>
        ) : state.summary ? (
          <>
            <Text style={[typography.subtitle, { color: theme.colors.text.primary }]}>{t("doneTitle", { name: state.summary.name })}</Text>
            <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("inLibrary", { count: state.summary.inLibrary })}</Text>
            {state.summary.outside > 0 ? <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("outside", { count: state.summary.outside })}</Text> : null}
            {state.summary.missing.length > 0 ? <Text style={[typography.body, { color: theme.colors.text.tertiary }]}>{t("missing", { count: state.summary.missing.length })}</Text> : null}
            {state.summary.truncated ? <Text style={[typography.small, { color: theme.colors.text.tertiary }]}>{t("truncated")}</Text> : null}
            <OctavePlayButton label={t("open")} Icon={null} onPress={() => openPlaylist(state.summary!.playlistId)} style={styles.primary} />
          </>
        ) : (
          <>
            <Text style={[typography.body, { color: theme.colors.status.error }]}>{t(`failure.${state.failure ?? "network"}`)}</Text>
            <OctavePlayButton label={t("retry")} Icon={null} onPress={reset} style={styles.primary} />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 20, paddingBottom: 8 },
  body: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
  field: { minHeight: 96, maxHeight: 200, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, textAlignVertical: "top" },
  primary: { marginTop: 4 },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  bar: { height: 6, borderRadius: 3 },
});
