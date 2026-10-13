import { useEffect, useState } from "react";
import { consumeArrival } from "./arrival";
import { ProfileCurtain, type CurtainPhase } from "./ProfileCurtain";

/** Le rideau reste au moins ce temps : l'application a celui de poser ses premières pages dessous. */
const HOLD_MS = 450;
/** Au plus ce temps d'attente d'un moment calme du fil principal, après le minimum. */
const IDLE_TIMEOUT_MS = 650;
/** La levée du rideau (`ProfileCurtain`, 260 ms), et un peu de marge avant de le démonter. */
const LEAVE_MS = 300;

/**
 * Le rideau d'ARRIVÉE, monté à la racine (`main.tsx`) hors des fournisseurs :
 * il ne lit que le stockage de session. Déjà là au premier rendu après le
 * rechargement d'une bascule, il se lève dès que la page a eu le temps de se
 * poser — jamais de vide entre le profil quitté et celui qui arrive.
 */
export function ProfileArrival() {
  const [profile] = useState(consumeArrival);
  const [phase, setPhase] = useState<CurtainPhase | null>(() => (profile ? "shown" : null));

  useEffect(() => {
    if (!profile) return;
    let idle: number | null = null;
    const hold = window.setTimeout(() => {
      const leave = () => setPhase("leaving");
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(leave, { timeout: IDLE_TIMEOUT_MS });
      else leave();
    }, HOLD_MS);
    return () => {
      window.clearTimeout(hold);
      if (idle !== null) window.cancelIdleCallback?.(idle);
    };
  }, [profile]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const done = window.setTimeout(() => setPhase(null), LEAVE_MS);
    return () => window.clearTimeout(done);
  }, [phase]);

  if (!profile || phase === null) return null;
  return <ProfileCurtain profile={profile} phase={phase} />;
}
