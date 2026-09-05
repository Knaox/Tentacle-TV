import { useCallback, useEffect, useRef, useState } from "react";
import { isDesktopApp } from "../desktop/detect";
import { resolveDesktopVersion } from "../hooks/useDesktopVersion";
import { isNewerVersion } from "../lib/updateCheckers";
import { WHATS_NEW_RELEASES } from "./releases";
import { selectWhatsNewFeatures, type WhatsNewSelection } from "./selectFeatures";
import { readSeenVersion, writeSeenVersion } from "./whatsNewStorage";

interface GateOptions {
  /** Les conditions d'affichage sont réunies : session ouverte, pas sur /watch, pop-up de mise à jour au repos. */
  enabled: boolean;
  /** Se comporter comme sur desktop (crochet de développement) — desktop seul sinon. */
  desktopLike?: boolean;
}

export interface WhatsNewGate {
  open: boolean;
  selection: WhatsNewSelection | null;
  /** Ferme ET marque la version vue — quel que soit le geste. */
  close: () => void;
}

/**
 * La porte de l'écran de nouveautés, desktop uniquement.
 *
 * Dès le montage : la vraie version du bundle, et — première installation,
 * aucune version vue — on l'enregistre sans rien montrer. Puis, quand les
 * conditions sont réunies, UNE décision : version courante plus récente que
 * la vue ET des nouveautés dans l'intervalle → l'écran ; sinon rien, et si
 * l'intervalle est vide on note la version courante tout de suite. Fermer
 * écrit la version courante, quel que soit le geste.
 */
export function useWhatsNewGate({ enabled, desktopLike = false }: GateOptions): WhatsNewGate {
  const eligible = desktopLike || isDesktopApp();
  const [version, setVersion] = useState<string | null>(null);
  const [selection, setSelection] = useState<WhatsNewSelection | null>(null);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    void resolveDesktopVersion().then((resolved) => {
      if (cancelled || !resolved) return;
      if (readSeenVersion() === null) writeSeenVersion(resolved);
      setVersion(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [eligible]);

  useEffect(() => {
    if (!eligible || !enabled || version === null || decidedRef.current) return;
    decidedRef.current = true;
    const seen = readSeenVersion();
    // Égale, rétrogradée ou illisible : rien à montrer, et rien à écrire.
    if (seen === null || !isNewerVersion(version, seen)) return;
    const next = selectWhatsNewFeatures(version, seen, WHATS_NEW_RELEASES);
    if (next.features.length === 0) {
      writeSeenVersion(version);
      return;
    }
    setSelection(next);
  }, [eligible, enabled, version]);

  const close = useCallback(() => {
    if (version) writeSeenVersion(version);
    setSelection(null);
  }, [version]);

  return { open: selection !== null, selection, close };
}
