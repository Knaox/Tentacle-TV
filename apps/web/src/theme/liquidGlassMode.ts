/**
 * Liquid Glass — le MODE rendu, posé sur `<html data-liquid-glass="…">`.
 *
 *  - `native`     : bureau Electron sur macOS 26 (le pont le dit) ET réglage
 *                   allumé — le verre de macOS (NSGlassEffectView) là où la
 *                   surface laisse voir la fenêtre, la réfraction de Chromium là
 *                   où elle couvre la page (voir `glass/`) ;
 *  - `refraction` : réglage allumé, sans verre natif — web, Windows, Linux,
 *                   macOS < 26 ;
 *  - `off`        : réglage coupé.
 *
 * ⚠️ Hors `native`, AUCUNE règle ne lit l'attribut ni les jetons `--lg-*` : le
 * rendu d'avant reste intact au pixel près. `refraction` et `off` rendent donc
 * la même chose aujourd'hui — les surfaces d'avant. L'attribut les distingue
 * quand même : c'est le réglage de l'utilisateur, et un banc doit pouvoir le
 * lire sur la page.
 *
 * Résolu au chargement du module, AVANT le premier rendu de React : un verre
 * natif ne doit pas apparaître d'abord sous sa forme d'avant. Le pont est
 * figé au démarrage (le système ne change pas de version en cours de session).
 */

import { desktopKind, type DesktopPlatform } from "../desktop/detect";
import type { LiquidGlassBridge } from "../desktop/types";
import { getLiquidGlass, subscribeLiquidGlass } from "./liquidGlass";

export type LiquidGlassMode = "native" | "refraction" | "off";

/** L'attribut de `<html>` que lisent les feuilles et les bancs. */
export const LIQUID_GLASS_ATTRIBUTE = "data-liquid-glass";

/** Le mode, d'après le réglage et ce que la coquille sait faire. */
export function resolveLiquidGlassMode(input: {
  enabled: boolean;
  nativeSupported: boolean;
}): LiquidGlassMode {
  if (!input.enabled) return "off";
  return input.nativeSupported ? "native" : "refraction";
}

/**
 * L'interrupteur « Liquid Glass » de Réglages › Apparence se montre-t-il ?
 *
 * Sur le bureau macOS, seulement là où le verre natif existe : sur un macOS
 * d'avant 26, l'option n'existe pas, et rien ne la remplace. Ailleurs (web,
 * Windows, Linux), le comportement d'avant : toujours là.
 */
export function liquidGlassToggleVisible(input: {
  platform: DesktopPlatform;
  nativeSupported: boolean;
}): boolean {
  return input.platform !== "macos" || input.nativeSupported;
}

/** Le pont du verre natif, s'il est là ET s'annonce supporté. */
export function readNativeGlassBridge(): LiquidGlassBridge | null {
  if (typeof window === "undefined" || desktopKind() !== "electron") return null;
  if (window.tentacle?.platform !== "darwin") return null;
  const bridge = window.tentacle.liquidGlass;
  return bridge?.supported === true ? bridge : null;
}

const bridge = readNativeGlassBridge();
let mode: LiquidGlassMode = resolveLiquidGlassMode({
  enabled: getLiquidGlass(),
  nativeSupported: bridge !== null,
});
const listeners = new Set<() => void>();

function applyToDocument(next: LiquidGlassMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(LIQUID_GLASS_ATTRIBUTE, next);
}

/** Dit le réglage à la coquille ; une coquille qui refuse ne casse pas la page. */
function syncBridge(): void {
  if (bridge === null) return;
  try {
    bridge.setEnabled(getLiquidGlass());
  } catch {
    /* Le pont a disparu (rechargement de la coquille) : le mode reste celui de la page. */
  }
}

applyToDocument(mode);
syncBridge();

subscribeLiquidGlass(() => {
  syncBridge();
  const next = resolveLiquidGlassMode({
    enabled: getLiquidGlass(),
    nativeSupported: bridge !== null,
  });
  if (next === mode) return;
  mode = next;
  applyToDocument(next);
  for (const listener of listeners) listener();
});

/** Le mode courant. */
export const getLiquidGlassMode = (): LiquidGlassMode => mode;

/** Le pont, s'il sert : `null` hors macOS 26. */
export const nativeGlassBridge = (): LiquidGlassBridge | null => bridge;

/**
 * Le verre natif peut-il se poser sur la VIDÉO (montage `fenetre` d'Apple
 * Silicon) ? Indépendant du réglage, comme `nativeGlassBridge`.
 */
export const nativeGlassRefractsVideo = (): boolean => bridge?.refractsVideo === true;

export function subscribeLiquidGlassMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
