import { invoke } from "../../desktop/bridge";
import { cancelFallbackSwitch, isFallbackActive } from "../../lib/fallbackPlayer";
import { hardwareDecodingChoice, setHardwareDecoding } from "../../lib/hardwareDecoding";
import { mpvDisabledByDebug, toggleMpvDebug } from "../../lib/nativePlayer";
import type { DebugAction, DebugChoice } from "./debugActionTypes";
import { debugShell, liveMpvUnavailable, readMpvProp, shellHasCommand, writeMpvProp } from "./debugShell";

/**
 * La commande de pont qui PROVOQUE une panne de mpv (lot rf2, axe lecture —
 * `apps/desktop-cef/src/bridge/mpv_fault.h`) : `mpv_debug_fail { mode }` → `{ mode, fired }`.
 * L'entrée du menu ne s'allume que si la coquille ANNONCE cette commande dans ses capacités.
 * ⚠️ Le nom et les modes traversent deux programmes : ils ne se renomment pas d'un seul côté.
 */
export const MPV_FAULT_COMMAND = "mpv_debug_fail";

/**
 * Les modes, dans les mots de `mpv_fault.h`. `fatal` ne tire qu'UNE fois (la lecture en cours
 * tombe) ; les autres restent posés jusqu'à `off`. `absent` (aucun canal `mpv_*`) ne se pose
 * qu'au lancement : `TENTACLE_MPV_FAIL=absent`, pas d'ici.
 */
const MPV_FAULT_CHOICES: readonly DebugChoice[] = [
  { id: "fatal", label: "Chute en lecture" },
  { id: "init", label: "Init refusée" },
  { id: "stall", label: "Init muette" },
  { id: "load", label: "Ouverture en échec" },
  { id: "off", label: "Lever la panne" },
];

/**
 * Le dernier mode que la coquille a dit tenir. Elle ne l'expose pas autrement, et il vit autant
 * qu'ELLE : gardé pour la session de la page (`sessionStorage`), il survit à un rechargement —
 * sans cela, une panne posée restait en place sans que le menu le dise.
 */
const FAULT_KEY = "tentacle_debug_mpv_fault";

function heldFault(): string {
  try {
    return sessionStorage.getItem(FAULT_KEY) ?? "off";
  } catch {
    return "off";
  }
}

function rememberFault(mode: string): void {
  try {
    sessionStorage.setItem(FAULT_KEY, mode);
  } catch {
    /* stockage indisponible : l'état vaut jusqu'au rechargement */
  }
}

/**
 * « Lever la panne » rend AUSSI sa chance à mpv. Une panne provoquée fait passer la SESSION de la
 * page au lecteur web (`lib/fallbackPlayer.ts` — elle ne repart qu'au rechargement) : levée dans
 * la coquille seulement, elle laissait toutes les lectures suivantes au lecteur de secours, et le
 * menu disait « panne levée » (recette du lot rf2 : la jointure des axes lecture et outils).
 * Comme l'interrupteur « Lecteur mpv coupé », l'effet est immédiat : une lecture de secours en
 * cours repart sur mpv.
 */
export function liftFault(): string {
  const onBackup = isFallbackActive();
  cancelFallbackSwitch();
  return onBackup ? "panne levée — le lecteur de secours rend la main : mpv rejoue" : "panne levée — effectif à la prochaine lecture";
}

/** Ce que la ligne dit de la panne : le mode que la coquille tient, sinon le secours encore en place. */
function faultValue(): string | undefined {
  if (heldFault() !== "off") return `panne : ${heldFault()}`;
  return isFallbackActive() ? "secours web actif" : undefined;
}

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
    hint: "Fait tomber le lecteur natif comme une vraie panne : le lecteur web doit reprendre à la même position. La touche fait tomber la lecture en cours ; « Lever la panne » rend la main à mpv.",
    choices: MPV_FAULT_CHOICES,
    status: () => (shellHasCommand(MPV_FAULT_COMMAND)
      ? { value: faultValue() }
      : { unavailable: `la coquille n'annonce pas ${MPV_FAULT_COMMAND} — en attendant : « Lecteur mpv coupé »` }),
    run: async (choice) => {
      if (!shellHasCommand(MPV_FAULT_COMMAND)) return `commande ${MPV_FAULT_COMMAND} absente de cette coquille`;
      const mode = choice ?? "fatal";
      try {
        const reply = await invoke<{ mode?: string; fired?: boolean }>(MPV_FAULT_COMMAND, { mode });
        if (reply?.mode) rememberFault(reply.mode);
        if (mode === "fatal") {
          return reply?.fired
            ? "lecture mise en échec — le lecteur web doit prendre le relais, à la même position"
            : "aucune lecture en cours : rien n'est tombé (lancer une lecture, puis recommencer)";
        }
        return mode === "off"
          ? liftFault()
          : `panne posée : ${MPV_FAULT_CHOICES.find((c) => c.id === mode)?.label ?? mode} — elle reste jusqu'à « Lever la panne »`;
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
