import { memo } from "react";
import { FadingModal } from "../../motion/FadingModal";
import { ChoiceSheet } from "./ChoiceSheet";
import type { FilterSheetHandlers, FilterSheetModel } from "./libraryTypes";
import { RatingSheet } from "./RatingSheet";
import { SortSheet } from "./SortSheet";
import { YearSheet } from "./YearSheet";

/**
 * La grande liste ouverte d'une barre de filtres — bibliothèque, Ma liste,
 * Favoris : dans une `Modal` (son propre contrôleur de vue, où le focus
 * reste, que Menu ou Retour referme : `onSheetClose`, sinon `onSheetApply`).
 * Elle entre avec son voile et son panneau, et s'efface d'un seul fondu avant
 * que la Modal ne se retire (`FadingModal`, puis `onSheetExited`). Pendant ce
 * fondu, plus aucun geste ne passe.
 */

export interface FilterSheetLayerProps extends FilterSheetHandlers {
  sheet?: FilterSheetModel | null;
  onSheetClose?: () => void;
  onSheetExited?: () => void;
}

const noop = () => {};

function Sheet({ sheet, ...handlers }: { sheet: FilterSheetModel } & FilterSheetHandlers) {
  switch (sheet.kind) {
    case "choice":
      return <ChoiceSheet sheet={sheet} {...handlers} />;
    case "sort":
      return <SortSheet sheet={sheet} {...handlers} />;
    case "years":
      return <YearSheet sheet={sheet} {...handlers} />;
    case "rating":
      return <RatingSheet sheet={sheet} {...handlers} />;
  }
}

export const FilterSheetLayer = memo(function FilterSheetLayer(props: FilterSheetLayerProps) {
  return (
    <FadingModal value={props.sheet ?? null} onRequestClose={props.onSheetClose ?? props.onSheetApply ?? noop} onExited={props.onSheetExited}>
      {(shown, leaving) => (
        <Sheet
          sheet={shown}
          onSheetOption={leaving ? undefined : props.onSheetOption}
          onSheetClear={leaving ? undefined : props.onSheetClear}
          onSheetApply={leaving ? undefined : props.onSheetApply}
          onYearStep={leaving ? undefined : props.onYearStep}
          onRatingSelect={leaving ? undefined : props.onRatingSelect}
        />
      )}
    </FadingModal>
  );
});
