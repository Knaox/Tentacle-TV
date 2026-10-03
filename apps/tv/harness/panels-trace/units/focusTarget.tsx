import { useCallback } from "react";
import { FocusBindingProvider, type FocusBinder } from "@bench/src/redesign/focus/focusBinding";
import { FocusTarget } from "@bench/src/redesign/focus/FocusTarget";
import { hosts, note } from "../stubs/record";
import { mount, take } from "./root";

/**
 * La garde anti-clic fantôme de `FocusTarget` : quels OK comptent, gardé ou
 * non, et l'appui visible (sa valeur d'enfoncement) au fil des gestes.
 */

type Handlers = Record<string, (() => void) | undefined>;

function Probe({ guarded, press }: { guarded: boolean; press: { value: number } }) {
  const bind = useCallback<FocusBinder>((key) => (key === "x" ? { phantomPressGuard: guarded } : undefined), [guarded]);
  return (
    <FocusBindingProvider bind={bind}>
      <FocusTarget focusKey="x" accessibilityLabel="x" pressProgress={press as never} onPress={() => note({ pressed: true })}>
        {() => null}
      </FocusTarget>
    </FocusBindingProvider>
  );
}

const SEQUENCES: Record<string, string[]> = {
  "OK sans appui commencé": ["onPress"],
  "appui, relâché, OK": ["onFocus", "onPressIn", "onPressOut", "onPress"],
  "appui emporté ailleurs": ["onFocus", "onPressIn", "onBlur", "onPress"],
  "deux OK pour un appui": ["onFocus", "onPressIn", "onPress", "onPress"],
  "appui, flou, retour, appui": ["onFocus", "onPressIn", "onBlur", "onFocus", "onPressIn", "onPress"],
};

export function runFocusTarget(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const guarded of [true, false]) {
    for (const [name, sequence] of Object.entries(SEQUENCES)) {
      const bench = mount();
      const press = { value: 0 };
      bench.render(<Probe guarded={guarded} press={press} />);
      const trace: unknown[] = [];
      for (const gesture of sequence) {
        const handlers = hosts.get("pressable:x") as Handlers | undefined;
        bench.run(() => handlers?.[gesture]?.());
        trace.push({ gesture, press: press.value, events: take() });
      }
      bench.unmount();
      out[`${guarded ? "gardé" : "libre"} — ${name}`] = trace;
    }
  }
  return out;
}
