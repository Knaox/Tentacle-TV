import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { RESTORE_WITHIN_MS, createRowRewind } from "@tentacle-tv/tv-core";
import type { RowRewindPort } from "../../../redesign/rows/rowRewindPort";
import { onRailPageChange } from "../back/railNavigate";
import type { FocusStore } from "./focusStore";

/**
 * Les rangées qui reviennent au début (Apple TV) — l'APPLICATEUR de la règle
 * de tv-core (`focus/rowRewind.ts`) pour une page du rail qui le demande
 * (l'accueil, « Pour vous » : `useRedesignScreen({ rewindRows: true })`).
 *
 * Il tient le port des rangées (`rowRewindPort`) : chaque rangée s'y déclare
 * avec sa remise au début, la page y dit où elles sont et qu'elle défile. Il
 * suit le focus de l'écran, et le changement de page par le rail
 * (`onRailPageChange`). Ce que la règle décide, il le fait : la rangée revient
 * au début d'un `scrollTo` SANS animation — elle est hors de l'écran, ou sous
 * une autre page : ni rendu ni image de plus.
 *
 * Le reste passe par le socle de l'écran : le focus rendu au début de la
 * rangée en quittant l'accueil par le rail (`startOf`), la clé réclamée au
 * retour (`resume`, dans `useEntryFocus`), le Retour vers la première carte
 * (`backTarget`, dans `useRailBackLayers`).
 */

export interface RowRewindHandle {
  port: RowRewindPort;
  /** La clé à viser en quittant la page par le rail : le début de la rangée d'une carte, sinon elle-même. */
  startOf(focusKey: string): string;
  /** La pile redescend sur la page : remet au début ce qui attendait, rend la clé à réclamer. */
  resume(remembered: string | null): string | null;
  /** Retour : la première carte quand le focus est sur une autre carte d'une rangée, sinon null. */
  backTarget(focusKey: string | null): string | null;
}

export interface RowRewindOptions {
  /** La page en relève (sinon : rien de déclaré, rien ne bouge). */
  enabled: boolean;
  /** La clé que la plateforme rendra à la page au retour (`contentKey`). */
  remembered: () => string | null;
}

export function useRowRewind(focus: FocusStore, { enabled, remembered }: RowRewindOptions): RowRewindHandle | null {
  const [model] = useState(createRowRewind);
  const rows = useRef(new Map<string, () => void>());
  const rememberedRef = useRef(remembered);
  rememberedRef.current = remembered;
  const navigation = useNavigation();
  const routeName = useRoute().name;

  const rewind = useCallback((keys: readonly string[]) => {
    for (const key of keys) rows.current.get(key)?.();
  }, []);

  const handle = useMemo<RowRewindHandle>(
    () => ({
      port: {
        register(rowKey, toStart) {
          model.add(rowKey);
          rows.current.set(rowKey, toStart);
          return () => {
            if (rows.current.get(rowKey) !== toStart) return;
            rows.current.delete(rowKey);
            model.remove(rowKey);
          };
        },
        layout: (rowKey, top, height) => model.layout(rowKey, { top, height }),
        scroll: (offset, height) => rewind(model.scroll({ offset, height })),
      },
      startOf: model.startOf,
      resume(key) {
        const resumed = model.resume(key);
        if (!resumed) return key;
        if (!resumed.afterRestore) {
          rewind(resumed.rewind);
          return resumed.claim;
        }
        // Revenue d'être couverte : UIKit lui rend la carte retenue, APRÈS toute
        // réclamation. On le laisse faire (la carte, réclamée aussi), puis au
        // premier focus posé — au plus tard au bout du délai d'une restauration —
        // la rangée revient au début, le focus sur sa première carte.
        afterRestore(focus, () => {
          rewind(resumed.rewind);
          if (resumed.claim) focus.claim(resumed.claim);
        });
        return key;
      },
      backTarget: model.backTarget,
    }),
    [model, rewind, focus],
  );

  // Le focus de l'écran : une carte autre que la première déplace sa rangée.
  useEffect(() => {
    if (!enabled) return undefined;
    return focus.subscribe((key, focused) => {
      if (focused) model.focus(key);
    });
  }, [enabled, focus, model]);

  // Le changement de page par le rail, annoncé AVANT d'être posé : la page est
  // encore à l'écran (on la quitte) ou couverte (une fiche ouverte depuis elle).
  useEffect(() => {
    if (!enabled) return undefined;
    return onRailPageChange((target) => {
      const visible = navigation.isFocused();
      // Choisir la page où l'on est n'est pas en changer.
      if (visible && target.name === routeName) return;
      rewind(model.leave({ visible, remembered: rememberedRef.current() }));
    });
  }, [enabled, navigation, routeName, model, rewind]);

  return enabled ? handle : null;
}

/** `run` une fois : au premier focus posé dans l'écran, sinon au bout de `RESTORE_WITHIN_MS`. */
function afterRestore(focus: FocusStore, run: () => void): void {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    unsubscribe();
    clearTimeout(timer);
    run();
  };
  const unsubscribe = focus.subscribe((_key, focused) => {
    if (focused) finish();
  });
  const timer = setTimeout(finish, RESTORE_WITHIN_MS);
}

/** Vrai tant que le focus est sur une carte d'une rangée qui n'est pas sa première — un état, pour le Retour. */
export function useAwayFromRowStart(focus: FocusStore, rows: RowRewindHandle | null): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!rows) {
      setAway(false);
      return undefined;
    }
    setAway(rows.backTarget(focus.focusedKey()) !== null);
    // Les prises seulement : entre deux cartes, tvOS annonce la perte de l'une
    // avant la prise de l'autre — l'état ne clignote pas d'une carte à l'autre.
    return focus.subscribe((key, focused) => {
      if (focused) setAway(rows.backTarget(key) !== null);
    });
  }, [focus, rows]);
  return away;
}
