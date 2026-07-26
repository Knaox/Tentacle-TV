import { useEffect, useRef } from "react";
import { desktopPlatform, invoke, listen, supportsSmtc } from "../desktop/bridge";

interface SmtcHandlers {
  onToggle: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

interface UseSmtcOptions extends SmtcHandlers {
  /** Titre principal affiché dans l'overlay « lecture en cours ». */
  title: string;
  /** Sous-titre (série / S0xE0x) → champ artiste SMTC. */
  artist?: string;
  /** URL de l'affiche pour la vignette SMTC. */
  cover?: string;
  /** État de lecture courant (sync vers l'OS). */
  paused: boolean;
}

/**
 * SMTC n'existe que sur le bureau Windows.
 *
 * La plateforme vient du pont : sous Electron elle est annoncée par le
 * processus principal, donc exacte, là où l'analyse du user agent restait une
 * approximation.
 */
function smtcEnabled(): boolean {
  return desktopPlatform() === "windows" && supportsSmtc();
}

async function invokeSmtc(cmd: string, args?: Record<string, unknown>): Promise<void> {
  try {
    await invoke(cmd, args);
  } catch {
    /* hors application de bureau / commande absente : no-op */
  }
}

/**
 * Enregistre la session SMTC Windows et la garde synchronisée avec le lecteur :
 * métadonnées + état lecture/pause poussés à l'OS, et boutons média (touches
 * clavier, overlay Windows, Stream Deck) relayés vers les handlers du lecteur.
 */
export function useSmtc(opts: UseSmtcOptions) {
  const handlers = useRef<SmtcHandlers>(opts);
  handlers.current = opts;

  // Init + écoute des boutons (une seule fois).
  useEffect(() => {
    if (!smtcEnabled()) return;
    let active = true;
    let unlisten: (() => void) | undefined;

    (async () => {
      await invokeSmtc("smtc_init");
      try {
        const un = await listen<string>("smtc-button", (e) => {
          const h = handlers.current;
          switch (e.payload) {
            case "toggle": h.onToggle(); break;
            case "play": h.onPlay(); break;
            case "pause": h.onPause(); break;
            case "stop": h.onStop(); break;
            case "next": h.onNext?.(); break;
            case "previous": h.onPrevious?.(); break;
          }
        });
        if (active) unlisten = un;
        else un();
      } catch {
        /* no-op */
      }
    })();

    return () => {
      active = false;
      unlisten?.();
      void invokeSmtc("smtc_clear");
    };
  }, []);

  // Métadonnées.
  useEffect(() => {
    if (!smtcEnabled()) return;
    void invokeSmtc("smtc_set_metadata", {
      title: opts.title,
      artist: opts.artist ?? "",
      cover: opts.cover ?? "",
    });
  }, [opts.title, opts.artist, opts.cover]);

  // État de lecture + nommage de la session audio Windows quand on (re)joue
  // (la session WASAPI n'existe qu'une fois la lecture démarrée → on la nomme là,
  // sinon Windows/Stream Deck affichent « System Sounds »).
  useEffect(() => {
    if (!smtcEnabled()) return;
    void invokeSmtc("smtc_set_playback", { status: opts.paused ? "paused" : "playing" });
    if (!opts.paused) {
      void invokeSmtc("set_audio_session_name", { name: "Tentacle TV" });
      // Re-essai court : la session peut apparaître quelques ms après le 1er flux.
      const id = setTimeout(() => void invokeSmtc("set_audio_session_name", { name: "Tentacle TV" }), 1500);
      return () => clearTimeout(id);
    }
  }, [opts.paused]);
}
