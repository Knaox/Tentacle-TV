/**
 * Octave — la rangée « Ambiances » de l'accueil (emplacement `HomeMoodsSlot` de M5) : une rangée PLEINE de cartes
 * (`CardRow`), dans l'ordre de l'extension. Sans extension qui les sert : rien, ni titre ni squelette ; la liste ne
 * coûte aucune requête à YouTube (l'extension la tient), et l'attente garde la place de la rangée.
 */

import { useTranslation } from "react-i18next";
import { Shelf } from "../components/Cards";
import { CardRow, CardRowSkeleton } from "../components/CardRow";
import { MoodCard } from "./MoodCard";
import { useMoods } from "./useMoods";

export function MoodsShelf() {
  const { t } = useTranslation("music");
  const { moods, pending } = useMoods();
  if (!pending && moods.length === 0) return null;
  return (
    <Shelf title={t("moods.shelf")}>
      {pending ? <CardRowSkeleton /> : <CardRow items={moods} render={(mood) => <MoodCard key={mood.id} mood={mood} />} />}
    </Shelf>
  );
}
