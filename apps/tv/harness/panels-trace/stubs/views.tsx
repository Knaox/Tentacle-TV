import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useFocusBinding } from "@bench/src/redesign/focus/focusBinding";
import { hosts, note } from "./record";

/**
 * Les vues qui ne font que DESSINER, remplacées par des doublures qui notent
 * leurs props (`hosts`) et laissent le banc appeler leurs gestes. Les mêmes
 * pour les deux arbres : la trace compare ce que le CÂBLAGE leur passe.
 */

type Props = Record<string, unknown> & { children?: ReactNode };

/** L'échelle : un cran par clé ; le banc pose le focus par `onFocusChange`. */
export const RULER_CELL = { width: 104, height: 96, gap: 10, removeWidth: 240 } as const;
export function RulerCell(props: Props) {
  hosts.set(`cell:${String(props.focusKey)}`, props);
  return null;
}

export function RatingStars(props: Props) {
  hosts.set("stars", props);
  return null;
}

export function ConfirmPill(props: Props) {
  hosts.set(`confirm:${String(props.focusKey)}`, props);
  return null;
}

export function PillButton(props: Props) {
  hosts.set(`pill:${String(props.focusKey)}`, props);
  return null;
}

export const BrandMark = () => null;
export const GlassSurface = ({ children }: Props) => <>{children}</>;
export const useNativeGlassBacking = () => ({});

/** Ce que la vue du grand panneau réexportait à l'origine (`ratingScaleKeys`), mêmes valeurs. */
export const RATING_ENTRY = 5;
export const scaleFocusKey = (score: number | null): string => `sheet:scale:${score ?? "remove"}`;
export const SCALE_FOCUS_KEYS: readonly string[] = [...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(scaleFocusKey), scaleFocusKey(null)];

/**
 * Le grand panneau : ses props notées ; monté déjà en sortie, il appelle
 * `onClosed` comme la vraie vue (sa présence part de zéro) ; sinon le banc
 * joue la fin de la sortie (`onClosed`).
 */
export function ActionSheetView(props: Props) {
  hosts.set("sheet", props);
  const mountedClosing = useRef(props.closing === true);
  useEffect(() => {
    if (mountedClosing.current) (props.onClosed as (() => void) | undefined)?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** La feuille des saisons : ses clés de focus (celles de l'origine) et ses props. */
export const SEASONS_ALL_KEY = "sheet:season:all";
export const seasonFocusKey = (number: number) => `sheet:season:${number}`;
/** Une cible de la feuille : sa liaison (verrou, observation du focus), tenue par un faux nœud. */
function SheetKey({ k }: { k: string }) {
  const binding = useFocusBinding(k);
  const ref = binding?.ref as ((node: unknown) => void) | undefined;
  useLayoutEffect(() => {
    ref?.({ setNativeProps: (props: object) => note({ native: k, props }) });
    return () => ref?.(null);
  }, [ref, k]);
  hosts.set(`key:${k}`, { binding, selectable: (binding?.native as { isTVSelectable?: boolean } | undefined)?.isTVSelectable ?? null });
  return null;
}

export function SeasonsSheet(props: Props) {
  hosts.set("seasons", props);
  const sheet = props.sheet as { all?: unknown; seasons?: Array<{ number: number; status?: unknown }> | null };
  const keys = [
    ...(sheet.all ? [SEASONS_ALL_KEY] : []),
    ...(sheet.seasons ?? []).filter((row) => !row.status).map((row) => seasonFocusKey(row.number)),
    "sheet:apply",
  ];
  return <>{keys.map((k) => <SheetKey key={k} k={k} />)}</>;
}

/** La Modal qui s'efface : ouverte tant que `value` est là ; à sa chute, la sortie est jouée d'un coup. */
export function FadingModal({ value, onRequestClose, onExited, children }: Props & { value: unknown; children: (v: unknown, leaving: boolean) => ReactNode }) {
  const last = useRef<unknown>(null);
  const wasOpen = useRef(false);
  if (value !== null) last.current = value;
  hosts.set("fading", { open: value !== null, onRequestClose });
  useEffect(() => {
    if (value !== null) wasOpen.current = true;
    else if (wasOpen.current) {
      wasOpen.current = false;
      note({ fadingExited: true });
      (onExited as (() => void) | undefined)?.();
    }
  }, [value, onExited]);
  if (last.current === null) return null;
  return <>{children(last.current, value === null)}</>;
}
