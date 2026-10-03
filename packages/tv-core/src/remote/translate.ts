import type { DragPhase, HoldPhase, RemoteIntent } from "./intents";
import type { IntentEvent, RemoteSignal, SignalPhase } from "./signals";
import { boundSignals, type RemoteBindings } from "./bindings/types";

/**
 * La traduction : un signal natif → l'intention que la table lui donne.
 *
 * Écrite une fois pour toutes les tables. Une plateforme n'y ajoute rien :
 * elle lit ses événements en `RemoteSignal` (son adaptateur) et fournit sa
 * table (`bindings/<plateforme>.ts`).
 *
 * Rien ne se perd en chemin : l'intention garde le signal d'où elle vient
 * (`IntentEvent.signal`), et un signal qui n'est pas une intention — inconnu,
 * bruit déclaré, glisser sans mesures — donne `null`, sans erreur : une
 * télécommande émet des choses qu'aucun écran n'écoute.
 *
 * Module pur : ni DOM, ni React Native.
 */

/** La phase d'un maintien. Sans phase dite, l'appui dure toujours (tvOS : « Changed »). */
export function holdPhaseOf(phase: SignalPhase | null): HoldPhase {
  if (phase === "down") return "start";
  if (phase === "up") return "end";
  return "update";
}

const DRAG_PHASES: Readonly<Record<SignalPhase, DragPhase>> = { down: "start", change: "move", up: "end" };

/** La phase d'un glisser ; `null` : la plateforme ne l'a pas dite, ce n'est pas un geste lisible. */
export function dragPhaseOf(phase: SignalPhase | null): DragPhase | null {
  return phase === null ? null : DRAG_PHASES[phase];
}

type Rule = (signal: RemoteSignal) => RemoteIntent | null;

export interface Translator {
  /** L'intention que porte ce signal, datée ; `null` s'il n'en porte aucune. */
  translate(signal: RemoteSignal): IntentEvent | null;
  /** Le signal est-il dans la table (intention, ou bruit déclaré) ? */
  knows(name: string): boolean;
}

/** Une table où un signal paraît deux fois est une erreur d'écriture : on la refuse d'emblée. */
function assertUnique(bindings: RemoteBindings): void {
  const seen = new Set<string>();
  for (const signal of boundSignals(bindings)) {
    if (seen.has(signal)) throw new Error(`Table ${bindings.platform} : le signal « ${signal} » est lié deux fois.`);
    seen.add(signal);
  }
}

function rulesOf(bindings: RemoteBindings): Map<string, Rule> {
  const rules = new Map<string, Rule>();
  for (const { signal, intent, on } of bindings.presses) {
    rules.set(signal, (s) => (on && (s.phase === null || !on.includes(s.phase)) ? null : withRepeat(intent, s)));
  }
  for (const { signal, key } of bindings.holds) {
    rules.set(signal, (s) => ({ type: "hold", key, phase: holdPhaseOf(s.phase) }));
  }
  for (const { signal, direction } of bindings.swipes) {
    rules.set(signal, () => ({ type: "swipe", direction }));
  }
  for (const { signal } of bindings.drags) {
    rules.set(signal, (s) => {
      const phase = dragPhaseOf(s.phase);
      if (!phase || !s.motion) return null;
      const { x, y, vx, vy } = s.motion;
      return { type: "drag", phase, x, y, vx, vy };
    });
  }
  for (const { signal } of bindings.noise) rules.set(signal, () => null);
  return rules;
}

/** Une copie de l'intention de la table (jamais l'objet de la table lui-même) ;
 *  la répétition d'une touche tenue suit l'appui qui la porte (`move`, `select`). */
function withRepeat(intent: RemoteIntent, signal: RemoteSignal): RemoteIntent {
  if (!signal.repeat || (intent.type !== "move" && intent.type !== "select")) return { ...intent };
  return { ...intent, repeat: true };
}

export function createTranslator(bindings: RemoteBindings): Translator {
  assertUnique(bindings);
  const rules = rulesOf(bindings);
  return {
    translate(signal) {
      const intent = rules.get(signal.name)?.(signal) ?? null;
      return intent ? { intent, at: signal.at, signal } : null;
    },
    knows: (name) => rules.has(name),
  };
}
