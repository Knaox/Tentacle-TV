import { invoke } from "../../desktop/bridge";
import { hardwareDecodingChoice, setHardwareDecoding } from "../../lib/hardwareDecoding";
import { mpvDisabledByDebug, toggleMpvDebug } from "../../lib/nativePlayer";
import type { DebugAction } from "./debugActionTypes";
import { debugShell, liveMpvUnavailable, readMpvProp, shellHasCommand, writeMpvProp } from "./debugShell";

/**
 * Le nom de la commande de pont qui PROVOQUE une panne de mpv (lot rf2, axe lecture : « de
 * quoi provoquer la panne — variable d'environnement et commande de pont »). L'entrée du menu
 * est prête ; elle s'allume dès que la coquille ANNONCE cette commande dans ses capacités.
 * Si l'axe lecture lui a donné un autre nom, c'est la seule ligne à changer.
 */
export const MPV_FAILURE_COMMAND = "mpv_debug_fail";

/** Le groupe « Lecteur » : ce qui décide QUEL lecteur joue, et avec quel décodeur. */
export const PLAYER_ACTIONS: readonly DebugAction[] = [
  {
    id: "mpv-off",
    key: "m",
    group: "player",
    kind: "switch",
    label: "Lecteur mpv coupé",
    hint: "La page se comporte comme si mpv n'existait pas : le lecteur web prend le relais, même en pleine lecture. Persiste au relancement.",
    status: () => (debugShell().kind === "web" ? { unavailable: "pas de lecteur mpv dans un navigateur" } : { on: mpvDisabledByDebug() }),
    run: async () => (toggleMpvDebug()
      ? "lecteur mpv COUPÉ — la lecture passe au lecteur web (persiste au relancement)"
      : "lecteur mpv rallumé — effectif à la prochaine lecture"),
  },
  {
    id: "mpv-fail",
    key: "x",
    group: "player",
    kind: "button",
    label: "Simuler mpv en panne",
    hint: "Fait tomber mpv en erreur fatale pendant la lecture : le lecteur web doit reprendre à la même position.",
    status: () => (shellHasCommand(MPV_FAILURE_COMMAND)
      ? {}
      : { unavailable: `la coquille n'annonce pas ${MPV_FAILURE_COMMAND} — en attendant : « Lecteur mpv coupé »` }),
    run: async () => {
      if (!shellHasCommand(MPV_FAILURE_COMMAND)) return `commande ${MPV_FAILURE_COMMAND} absente de cette coquille`;
      try {
        await invoke(MPV_FAILURE_COMMAND, { mode: "fatal" });
        return "panne de mpv provoquée — le lecteur web doit prendre le relais";
      } catch (error) {
        return `panne refusée : ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  {
    id: "hwdec",
    key: "d",
    group: "player",
    kind: "switch",
    label: "Décodage matériel",
    hint: "Electron : bascule mpv en direct. CEF et hors lecture : change le réglage de l'appareil, pris à la prochaine lecture.",
    status: async () => {
      if (debugShell().kind === "web") return { unavailable: "pas de lecteur mpv dans un navigateur" };
      const live = await readMpvProp("hwdec-current");
      const wanted = hardwareDecodingChoice();
      return { on: wanted !== "off", value: live ?? (wanted === "off" ? "coupé" : wanted) };
    },
    run: async () => {
      // En direct là où la coquille l'accepte (Electron, lecture en cours).
      if (liveMpvUnavailable(debugShell()) === undefined) {
        const current = await readMpvProp("hwdec");
        const next = current === "no" ? "auto-safe" : "no";
        if (await writeMpvProp("hwdec", next)) return `hwdec = ${next} (en direct, cette lecture seulement)`;
      }
      // Sinon le RÉGLAGE de l'appareil (Réglages › Lecture) : `hwdec` est une option d'init.
      const next = hardwareDecodingChoice() === "off" ? "auto" : "off";
      setHardwareDecoding(next);
      return `décodage matériel ${next === "off" ? "COUPÉ" : "rallumé"} — réglage de l'appareil, pris à la prochaine lecture`;
    },
  },
];
