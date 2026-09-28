import { useTranslation } from "react-i18next";
import { PlayCtaButton } from "../../screens/detail/PlayCtaButton";
import { SHEET_MAX_WIDTH } from "../../responsive";
import { sheetPlayLabel, type SheetPlayPlan } from "./sheetPlay";

/**
 * La lecture de la feuille : le bouton Lecture de la fiche, tel quel — le
 * dégradé de marque, l'anneau d'avancement, le temps restant sous le verbe.
 * La seule action en couleur de la feuille, comme sur la carte survolée.
 */
export function SheetPlayButton({ plan, title, onPress }: {
  plan: Pick<SheetPlayPlan, "targetId" | "resume" | "episodeCode" | "progress" | "remainingMinutes">;
  title: string;
  onPress: () => void;
}) {
  const { t } = useTranslation("cards");
  const cta = {
    targetId: plan.targetId,
    label: sheetPlayLabel(plan, t),
    progress: plan.progress,
    remainingMinutes: plan.remainingMinutes,
  };
  return (
    <div className="flex justify-center px-4 pb-4">
      <PlayCtaButton cta={cta} title={title} maxWidth={SHEET_MAX_WIDTH} onPress={onPress} />
    </div>
  );
}
