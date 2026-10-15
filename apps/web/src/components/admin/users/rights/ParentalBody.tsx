import { RatingSelect, UnratedTypesField } from "../../../parental/RatingFields";
import { ScheduleListField } from "../../../parental/ScheduleListField";
import { TagListField } from "../../../parental/TagListField";
import { RightError } from "./RightRows";
import type { GroupProps } from "./GroupBodies";

/**
 * Le contrôle parental d'un compte : la note maximale dans la table de
 * Jellyfin, les types bloqués sans note, les étiquettes bloquées et permises,
 * les plages horaires. Chaque geste s'écrit aussitôt ; c'est Jellyfin qui
 * l'applique, et le serveur en filtre aussi les titres hors bibliothèque.
 */
export function ParentalBody({ rights, options, writer }: GroupProps) {
  const ratingPending = writer.isPending("maxParentalRating") || writer.isPending("maxParentalSubRating");
  return (
    <>
      <div>
        <RatingSelect
          ratings={options?.parentalRatings ?? []}
          score={rights.maxParentalRating}
          subScore={rights.maxParentalSubRating}
          disabled={ratingPending}
          onChange={(score, subScore) => writer.write({ maxParentalRating: score, maxParentalSubRating: subScore })}
        />
        <RightError text={writer.errorFor("maxParentalRating")} />
      </div>
      <div>
        <UnratedTypesField
          types={options?.unratedItemTypes ?? []}
          value={rights.blockUnratedItems}
          disabled={writer.isPending("blockUnratedItems")}
          onChange={(next) => writer.write({ blockUnratedItems: next })}
        />
        <RightError text={writer.errorFor("blockUnratedItems")} />
      </div>
      <div>
        <TagListField
          field="blockedTags"
          value={rights.blockedTags}
          known={options?.knownTags ?? []}
          disabled={writer.isPending("blockedTags")}
          onChange={(next) => writer.write({ blockedTags: next })}
        />
        <RightError text={writer.errorFor("blockedTags")} />
      </div>
      <div>
        <TagListField
          field="allowedTags"
          value={rights.allowedTags}
          known={options?.knownTags ?? []}
          disabled={writer.isPending("allowedTags")}
          onChange={(next) => writer.write({ allowedTags: next })}
        />
        <RightError text={writer.errorFor("allowedTags")} />
      </div>
      <div>
        <ScheduleListField
          value={rights.accessSchedules}
          disabled={writer.isPending("accessSchedules")}
          onChange={(next) => writer.write({ accessSchedules: next })}
        />
        <RightError text={writer.errorFor("accessSchedules")} />
      </div>
    </>
  );
}
