import { memo } from "react";
import type { FamilyProfileColor } from "@tentacle-tv/shared";
import { FamilyAvatar } from "../../family/FamilyAvatar";

export interface CurtainProfile {
  id: string;
  name: string;
  color: FamilyProfileColor;
  imageTag: string | null;
}

/** `entering` : le rideau tombe ; `shown` : il est là (premier rendu après le rechargement) ; `leaving` : il se lève. */
export type CurtainPhase = "entering" | "shown" | "leaving";

interface ProfileCurtainProps {
  profile: CurtainProfile;
  phase: CurtainPhase;
  /** « Passage au profil de Léa… », sous le nom ; rien par défaut. */
  label?: string | null;
}

/**
 * Le RIDEAU d'une bascule de profil : l'écran se couvre au nom du profil
 * choisi (son rond et son nom au centre), la page se recharge dessous, et le
 * même rideau, déjà là au premier rendu, se lève sur l'application du profil.
 * Rien de l'ancien profil ne se voit entre les deux.
 *
 * `opacity` et `transform` seuls ; le fond est fixe (peint une fois). Sous la
 * bande de la fenêtre macOS (`--hote-bandeau`), jamais par-dessus : la fenêtre
 * reste déplaçable. Mouvement réduit : `motion-reduce.css` réduit les durées à
 * rien, le rideau paraît et disparaît.
 */
export const ProfileCurtain = memo(function ProfileCurtain({ profile, phase, label }: ProfileCurtainProps) {
  const visible = phase !== "leaving";
  return (
    <div
      aria-hidden={phase === "leaving"}
      role="status"
      className="fixed inset-x-0 bottom-0 z-[9000] flex flex-col items-center justify-center bg-surface-0"
      style={{
        top: "var(--hote-bandeau, 0px)",
        opacity: visible ? 1 : 0,
        transition: phase === "leaving" ? "opacity 260ms cubic-bezier(0.4, 0, 1, 1)" : undefined,
        animation: phase === "entering" ? "fadeIn 200ms ease-out both" : undefined,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 50% at 50% 45%, rgba(var(--brand-rgb), 0.16) 0%, transparent 70%)" }}
      />
      <div className={`relative flex flex-col items-center ${phase === "entering" ? "animate-scale-in" : ""}`}>
        <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={112} />
        <p className="mt-5 text-2xl font-bold tracking-tight text-content-primary">{profile.name}</p>
        <p className="mt-2 min-h-[1.25rem] text-sm text-content-tertiary">{label ?? ""}</p>
      </div>
    </div>
  );
});
