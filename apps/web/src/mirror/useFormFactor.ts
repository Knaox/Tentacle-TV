import { useSyncExternalStore } from "react";
import { isDesktopApp } from "../desktop/detect";
import {
  FORM_FACTOR_OVERRIDE_KEY,
  parseOverride,
  resolveFormFactor,
  type FormFactor,
} from "./formFactor";

/**
 * Le gabarit courant, suivi en direct (rotation, redimensionnement).
 *
 * Un seul abonnement pour toute l'app : `resize` + le changement du pointeur
 * principal (une tablette qu'on branche à un clavier-pavé peut basculer).
 */

const TOUCH_QUERY = "(pointer: coarse) and (hover: none)";

interface Snapshot {
  formFactor: FormFactor;
  landscape: boolean;
  width: number;
  height: number;
}

const SERVER_SNAPSHOT: Snapshot = { formFactor: "desktop", landscape: true, width: 1280, height: 800 };

/** Forçage de développement : le volet de préversion n'émule pas le tactile d'un iPad. */
function readOverride(): FormFactor | null {
  if (!import.meta.env.DEV) return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("formFactor");
    if (fromUrl === "auto") localStorage.removeItem(FORM_FACTOR_OVERRIDE_KEY);
    else if (parseOverride(fromUrl)) localStorage.setItem(FORM_FACTOR_OVERRIDE_KEY, fromUrl!);
    return parseOverride(localStorage.getItem(FORM_FACTOR_OVERRIDE_KEY));
  } catch {
    return null;
  }
}

const override = typeof window === "undefined" ? null : readOverride();
let current: Snapshot | null = null;

function compute(): Snapshot {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const formFactor =
    override ??
    resolveFormFactor({
      width,
      height,
      touchPrimary: window.matchMedia(TOUCH_QUERY).matches,
      desktopShell: isDesktopApp(),
    });
  return { formFactor, landscape: width > height, width, height };
}

function getSnapshot(): Snapshot {
  if (!current) current = compute();
  return current;
}

function subscribe(onChange: () => void): () => void {
  const refresh = () => {
    const next = compute();
    const prev = current;
    // Même objet tant que rien d'utile n'a bougé : pas de rendu à chaque pixel.
    if (
      prev &&
      prev.formFactor === next.formFactor &&
      prev.landscape === next.landscape &&
      prev.width === next.width &&
      prev.height === next.height
    ) {
      return;
    }
    current = next;
    onChange();
  };
  const mq = window.matchMedia(TOUCH_QUERY);
  window.addEventListener("resize", refresh);
  mq.addEventListener("change", refresh);
  return () => {
    window.removeEventListener("resize", refresh);
    mq.removeEventListener("change", refresh);
  };
}

export function useViewport(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

export function useFormFactor(): FormFactor {
  return useViewport().formFactor;
}

/** `true` quand le web doit rendre le miroir de l'app mobile (téléphone ou tablette). */
export function useMirror(): boolean {
  return useViewport().formFactor !== "desktop";
}

/**
 * La navigation latérale de l'iPad : tablette ET paysage, comme
 * `sideNav = isTablet && isLandscape` dans `app/(tabs)/_layout.tsx`.
 */
export function useSideNav(): boolean {
  const v = useViewport();
  return v.formFactor === "tablet" && v.landscape;
}
