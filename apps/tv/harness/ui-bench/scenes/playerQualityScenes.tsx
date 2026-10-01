import { byName, t } from "../data/playerModels";
import { settingsOf } from "../data/playerPanelModels";
import { episode, film, hailMary, patch, scene, troublePanel } from "./playerScenes";
import type { BenchScene } from "./types";

/**
 * L'onglet « Réglages » du lecteur (la qualité, sortie de « Pistes ») et le
 * transcodage lent, état par état : l'ouverture qui se fait attendre, la
 * lecture arrêtée qui le dit sans rien bloquer, les deux minutes sans rien,
 * et le réseau accusé seulement MESURÉ trop lent (chiffres posés à la main,
 * comme le plafond automatique les dirait).
 */

const MB = 1_000_000;

export const PLAYER_QUALITY_SCENES: BenchScene[] = [
  scene("osd-reglages", "Habillage · Pistes, puis Réglages", film, ["player:settings", "player:tracks"]),
  scene("reglages", "Réglages · qualité (film 4K HDR)", patch(film, (data) => {
    const item = byName(data, "Interstellar");
    return { panel: item ? { kind: "settings", settings: settingsOf(item) } : null };
  }), ["settings:quality:original", "settings:quality:quality720p", "settings:close"], 1400),
  scene("reglages-auto", "Réglages · qualité réduite (Auto)", patch(hailMary, (data) => {
    const item = byName(data, "Projet Dernière Chance");
    return { panel: item ? { kind: "settings", settings: settingsOf(item, { quality: "quality1080p", auto: true }) } : null };
  }), ["settings:quality:quality1080p"], 1400),
  scene("transcodage-ouverture", "Transcodage lent · ouverture", patch(film, () => ({
    phase: { kind: "starting", hint: t("player:transcodeSlowHint") },
  })), ["loading:back"]),
  scene("transcodage-ouverture-reseau", "Ouverture · réseau mesuré trop lent", patch(episode, () => ({
    phase: { kind: "starting", hint: t("player:networkSlowHint") },
  })), ["loading:back"]),
  scene("transcodage-ouverture-echec", "Ouverture · rien depuis deux minutes", patch(film, () => ({
    phase: { kind: "failed", message: t("player:troubleTranscodeDetail") },
  })), ["loading:retry"]),
  scene("transcodage-lecture", "Transcodage lent · en pleine lecture", patch(episode, () => ({
    osdVisible: false, buffering: true, bufferingHint: t("player:transcodeSlowHint"),
  }))),
  scene("transcodage-qualite", "Changement de qualité · transcodage lent", patch(film, (_data, stage) => ({
    osdVisible: false, reloadFrame: stage.frame ? { uri: stage.frame } : null, bufferingHint: t("player:transcodeSlowHint"),
  }))),
  scene("transcodage-bloque", "Transcodage · aucune image depuis deux minutes", patch(film, (_data, stage) => ({
    osdVisible: false, troubleCovers: true,
    trouble: troublePanel({ kind: "stuck", cause: "transcode", since: 0 }, stage, { active: true, lower: true }),
  })), ["trouble:retry", "trouble:quality", "trouble:back"]),
  scene("reseau-lent", "Réseau MESURÉ trop lent · lecture arrêtée", patch(episode, (_data, stage) => ({
    osdVisible: false,
    trouble: troublePanel({ kind: "waiting", cause: "slow", since: 0, network: { measuredBps: 3.1 * MB, neededBps: 8 * MB } }, stage, { lower: true }),
  }))),
  scene("lecture-attente", "Lecture directe · la vidéo se fait attendre", patch(film, (_data, stage) => ({
    osdVisible: false, trouble: troublePanel({ kind: "waiting", cause: "stall", since: 0 }, stage, {}),
  }))),
];
