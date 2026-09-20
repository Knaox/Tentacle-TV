// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/src/MpvPlayerView.tsx, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import { requireNativeView } from "expo";
import { forwardRef, useImperativeHandle, useRef, type ComponentType, type Ref } from "react";

import type { MpvPlayerNativeProps, MpvPlayerViewHandle } from "./MpvPlayer.types";
import { isMpvAvailable } from "./MpvPlayerModule";

/** Ce que la vue native expose sur sa ref (mêmes noms que les AsyncFunction Swift). */
type NativeViewRef = MpvPlayerViewHandle;

type NativeViewComponent = ComponentType<MpvPlayerNativeProps & { ref?: Ref<NativeViewRef> }>;

// `requireNativeView` lance sans le module : on ne le demande que s'il existe.
const NativeView: NativeViewComponent | null = isMpvAvailable()
  ? (requireNativeView("MpvPlayer") as NativeViewComponent)
  : null;

/**
 * La vue vidéo du lecteur avancé. Les réglages sont des props (déclaratives,
 * appliquées au changement) ; les actions passent par la ref.
 */
export const MpvPlayerView = forwardRef<MpvPlayerViewHandle, MpvPlayerNativeProps>(
  function MpvPlayerView(props, ref) {
    const nativeRef = useRef<NativeViewRef | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        seekTo: async (seconds) => {
          await nativeRef.current?.seekTo(seconds);
        },
        getPosition: async () => (await nativeRef.current?.getPosition()) ?? 0,
        setAudioTrack: async (id) => {
          await nativeRef.current?.setAudioTrack(id);
        },
        setSubtitleTrack: async (id) => {
          await nativeRef.current?.setSubtitleTrack(id);
        },
        addSubtitle: async (url, select) => {
          await nativeRef.current?.addSubtitle(url, select);
        },
        getTracks: async () => (await nativeRef.current?.getTracks()) ?? [],
        getTechnicalInfo: async () => (await nativeRef.current?.getTechnicalInfo()) ?? {},
        startPictureInPicture: async () => {
          await nativeRef.current?.startPictureInPicture();
        },
        stopPictureInPicture: async () => {
          await nativeRef.current?.stopPictureInPicture();
        },
        isPictureInPictureSupported: async () =>
          (await nativeRef.current?.isPictureInPictureSupported()) ?? false,
        isPictureInPictureActive: async () => (await nativeRef.current?.isPictureInPictureActive()) ?? false,
        stop: async () => {
          await nativeRef.current?.stop();
        },
      }),
      [],
    );

    if (NativeView === null) return null;
    return <NativeView ref={nativeRef} {...props} />;
  },
);
