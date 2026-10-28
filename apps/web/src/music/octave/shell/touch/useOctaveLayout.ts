import { useIsMobile } from "../../../../hooks/useIsMobile";
import { useViewport } from "../../../../mirror/useFormFactor";
import { resolveOctaveLayout, type OctaveLayout } from "./octaveLayout";

/** La mise en page d'Octave, suivie en direct (rotation, redimensionnement). */
export function useOctaveLayout(): OctaveLayout {
  const { formFactor, landscape } = useViewport();
  const narrowWindow = useIsMobile();
  return resolveOctaveLayout({ formFactor, landscape, narrowWindow });
}
