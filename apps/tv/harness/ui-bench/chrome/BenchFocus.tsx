import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type { View } from "react-native";
import { FocusBindingProvider, type FocusBinding } from "../../../src/redesign/focus/focusBinding";
import type { SweepRequest } from "../control/benchRemote";
import { METER_SETTLE_MS } from "./FrameMeter";

/**
 * Le focus NATIF piloté par le banc, pour mesurer le mouvement comme à la
 * télécommande : un port du focus minimal (`FocusBindingProvider`) retient le
 * nœud de chaque clé, et le balayage réclame les cartes `<prefix>:<n>` l'une
 * après l'autre (`requestTVFocus`), en aller-retour — le moteur de focus de
 * tvOS, ses animations coordonnées, le défilement des rangées et les vrais
 * `onFocus` / `onBlur`. Le focus figé du banc masquerait tout cela : la
 * ligne de commande le lève avant de balayer.
 */

type TvNode = View & { requestTVFocus?: () => void };

const INDEXED = /:(\d+)$/;

export function BenchFocus({ sweep, children }: { sweep: SweepRequest | null | undefined; children: ReactNode }) {
  const nodes = useRef(new Map<string, TvNode>()).current;
  const bindings = useRef(new Map<string, FocusBinding>()).current;
  const bind = useCallback(
    (key: string): FocusBinding => {
      let binding = bindings.get(key);
      if (!binding) {
        binding = {
          ref: (node: View | null) => {
            if (node) nodes.set(key, node as TvNode);
            else nodes.delete(key);
          },
        };
        bindings.set(key, binding);
      }
      return binding;
    },
    [bindings, nodes],
  );

  const id = sweep?.id;
  useEffect(() => {
    if (!sweep) return undefined;
    const { prefix, everyMs, seconds } = sweep;
    let timer: ReturnType<typeof setTimeout>;
    const start = setTimeout(() => {
      // Les éléments DIRECTS du préfixe (`resume:3`, `hero:primary`), pas ce
      // qu'ils portent (`resume:3:tray:play`) ; dans l'ordre des index, sinon
      // dans l'ordre de montage.
      const keys = [...nodes.keys()].filter((key) => key.startsWith(`${prefix}:`) && !key.slice(prefix.length + 1).includes(":"));
      if (keys.every((key) => INDEXED.test(key))) keys.sort((a, b) => Number(a.match(INDEXED)?.[1]) - Number(b.match(INDEXED)?.[1]));
      if (keys.length < 2) return;
      const until = Date.now() + seconds * 1000;
      let index = 0;
      let step = 1;
      const tick = () => {
        nodes.get(keys[index])?.requestTVFocus?.();
        if (Date.now() >= until) return;
        if (index + step < 0 || index + step >= keys.length) step = -step;
        index += step;
        timer = setTimeout(tick, everyMs);
      };
      tick();
    }, METER_SETTLE_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
    // Un balayage par demande : seul son numéro compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return <FocusBindingProvider bind={bind}>{children}</FocusBindingProvider>;
}
