import { useCallback, useEffect, useRef, useState } from "react";
import { OwnPinSheet } from "@/components/family/PinSheet";
import { whenNoModal } from "@/components/ui/modalGate";
import { FamilyPinSuggestModal, type FamilyPinSuggestVariant } from "./FamilyPinSuggestModal";

interface FamilyPinSuggestProps {
  variant: FamilyPinSuggestVariant;
  owner?: string;
  /** « Configurer plus tard ». `startup` : masque le rappel pour le compte ; `joined` : ferme seulement. */
  onLater: () => void;
  /** Fermée sans réponse, ou le code posé (ou abandonné) dans sa feuille. */
  onClose: () => void;
}

/**
 * La suggestion, puis — « Poser un code PIN » — la feuille du code, À SA
 * PLACE. Jamais deux modales à la fois : la feuille n'est présentée qu'une
 * fois la fenêtre retirée (`whenNoModal`) ; présentée pendant la sortie de la
 * première, elle coincerait la pile native.
 */
export function FamilyPinSuggest({ variant, owner, onLater, onClose }: FamilyPinSuggestProps) {
  const [phase, setPhase] = useState<"suggest" | "between" | "pin">("suggest");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const toPin = useCallback(() => {
    setPhase("between");
    whenNoModal(() => {
      if (mounted.current) setPhase("pin");
    });
  }, []);

  if (phase === "pin") return <OwnPinSheet hasPin={false} onClose={onClose} />;
  if (phase === "between") return null;
  return <FamilyPinSuggestModal variant={variant} owner={owner} onSet={toPin} onLater={onLater} onClose={onClose} />;
}
