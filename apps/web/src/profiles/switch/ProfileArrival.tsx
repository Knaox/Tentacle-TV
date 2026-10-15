import { useEffect, useState } from "react";
import { CURTAIN_STARTUP_SOURCE, consumeArrival, useLiveArrival } from "./arrival";
import { ProfileCurtain, type CurtainPhase, type CurtainProfile } from "./ProfileCurtain";
import { publishStartupWindow, usePublishStartupWindow } from "../../startup/startupStore";

/** Après un rechargement, le rideau reste au moins ce temps : l'application pose ses premières pages dessous. */
const HOLD_AFTER_RELOAD_MS = 450;
/** Sans rechargement, l'application est déjà là : le rideau tombe (200 ms) et ne fait que passer. */
const HOLD_LIVE_MS = 360;
/** Au plus ce temps d'attente d'un moment calme du fil principal, après le minimum. */
const IDLE_TIMEOUT_MS = 650;
/** La levée du rideau (`ProfileCurtain`, 260 ms), et un peu de marge avant de le démonter. */
const LEAVE_MS = 300;

interface Showing {
  profile: CurtainProfile;
  hold: number;
  /** Change à chaque arrivée : une nouvelle arrivée relance le rideau. */
  serial: number;
}

/**
 * Le rideau d'ARRIVÉE, monté à la racine (`main.tsx`) hors des routes : déjà
 * là au premier rendu après le rechargement d'une bascule, ou tombé sur une
 * arrivée annoncée sans rechargement (son profil choisi depuis « Qui
 * regarde ? »). Il se lève dès que la page a eu le temps de se poser — jamais
 * de vide entre le profil quitté et celui qui arrive.
 *
 * Baissé, il tient la première fenêtre du démarrage (`startup/startupOrder.ts`) :
 * les nouveautés ou le code PIN conseillé paraissent APRÈS sa levée, jamais dessous.
 */
export function ProfileArrival() {
  const live = useLiveArrival();
  const [showing, setShowing] = useState<Showing | null>(() => {
    const profile = consumeArrival();
    // Publié dès le premier rendu : monté avant `App`, il précède toute fenêtre.
    if (profile) publishStartupWindow(CURTAIN_STARTUP_SOURCE, "profile", "open");
    return profile ? { profile, hold: HOLD_AFTER_RELOAD_MS, serial: 0 } : null;
  });
  usePublishStartupWindow(CURTAIN_STARTUP_SOURCE, "profile", showing ? "open" : "done");
  const [phase, setPhase] = useState<CurtainPhase>("shown");

  // Une arrivée annoncée en direct remplace ce qui se montrait ; le rideau
  // tombe sur le sélecteur (il n'était pas là avant), puis se lève.
  useEffect(() => {
    if (!live) return;
    setShowing({ profile: live.profile, hold: HOLD_LIVE_MS, serial: live.serial });
    setPhase("entering");
  }, [live]);

  useEffect(() => {
    if (!showing) return;
    let idle: number | null = null;
    const hold = window.setTimeout(() => {
      const leave = () => setPhase("leaving");
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(leave, { timeout: IDLE_TIMEOUT_MS });
      else leave();
    }, showing.hold);
    return () => {
      window.clearTimeout(hold);
      if (idle !== null) window.cancelIdleCallback?.(idle);
    };
  }, [showing]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const done = window.setTimeout(() => setShowing(null), LEAVE_MS);
    return () => window.clearTimeout(done);
  }, [phase]);

  if (!showing) return null;
  return <ProfileCurtain key={showing.serial} profile={showing.profile} phase={phase} />;
}
