import type { ReactNode } from "react";
import { labImages } from "./labFixtures";

/**
 * La SCÈNE du labo : une image fixe à la place de la vidéo, plein cadre, et par-dessus les
 * vrais composants d'habillage. Le fond est noir en dur, comme la toile du lecteur.
 */
export function LabStage({ children, image = "backdrop" }: { children: ReactNode; image?: "backdrop" | "backdropNext" }) {
  const src = labImages()[image];
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black" data-lab-stage>
      {src ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #2b3a55, #6b4a3a 55%, #1b1b1e)" }} />
      )}
      {children}
    </div>
  );
}
