import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { recoSectionOf, type RecoSection } from "./recoSection";

export type { RecoSection };

/**
 * La section de l'onglet Pour vous — « Pour vous » ou « Affiner » — portée
 * par le paramètre `section` de la route : un lien profond (`/for-you?section=refine`,
 * ou l'ancien `/swipe` qui y redirige) ouvre directement la pile, et changer de
 * section ne pousse aucun écran (`setParams`), le retour système ne les
 * rejoue pas une à une.
 */
export function useRecoSection(): { section: RecoSection; setSection: (next: RecoSection) => void } {
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const router = useRouter();
  const setSection = useCallback((next: RecoSection) => router.setParams({ section: next }), [router]);
  return { section: recoSectionOf(section), setSection };
}
