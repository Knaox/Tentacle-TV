import { memo } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedChoice } from "../../../settings/SegmentedChoice";
import { FAMILY_ACCESS_LEVELS, type FamilyAccessFeature, type FamilyAccessLevel } from "./familyAccessModel";

interface FamilyAccessRowProps {
  feature: FamilyAccessFeature;
  level: FamilyAccessLevel;
  onChange: (level: FamilyAccessLevel) => void;
  /** Une phrase de plus sous l'explication (les invités sans les familles). */
  note?: string;
}

/**
 * Une fonction de la Famille et QUI y a droit, en trois positions à plat —
 * Coupées, Comptes permis, Tous les comptes. Sous le choix, ce que veut dire
 * la position en place : c'est là que se dit la différence entre couper (les
 * profils ouverts se ferment) et réserver (rien de ce qui existe ne tombe).
 */
export const FamilyAccessRow = memo(function FamilyAccessRow({ feature, level, onChange, note }: FamilyAccessRowProps) {
  const { t } = useTranslation("familyWeb");
  const title = t(`admin.${feature}`);
  return (
    <div>
      <p className="text-sm font-medium text-content-primary">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t(`admin.${feature}Access`)}</p>
      <SegmentedChoice
        label={title}
        value={level}
        options={FAMILY_ACCESS_LEVELS.map((value) => ({ value, label: t(`admin.${feature}Level_${value}`) }))}
        onChange={onChange}
        className="mt-3"
      />
      <p className="mt-2 text-xs leading-relaxed text-content-secondary">
        {t(`admin.${feature}LevelDetail_${level}`)}
        {note && <> {note}</>}
      </p>
    </div>
  );
});
