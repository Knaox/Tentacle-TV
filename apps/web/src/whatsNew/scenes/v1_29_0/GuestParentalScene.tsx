import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import {
  DIALOG_RATING, DIALOG_SAVE, DIALOG_SERIES, FauxFamilyList, FauxParentalDialog, PARENTAL_BUTTON,
} from "./FauxGuestParental";

/**
 * Réglages › Famille : le pointeur sur « Contrôle parental » de Léa, le
 * dialogue, la note maximale à 10, les séries sans note bloquées,
 * « Enregistrer » — et la mention sous l'invitée, avec l'annonce.
 */
const STEPS = [850, 600, 800, 600, 750, 650, 600, 1800] as const;
const HOVER = 1;
const OPEN = 2;
const TO_RATING = 3;
const RATED = 4;
const SERIES = 5;
const SAVE = 6;
const SAVED = 7;
const RATING = "10";

/**
 * Le contrôle parental d'un profil invité, posé par celui qui l'a créé (ou par
 * le propriétaire) depuis Réglages › Famille — et jamais au-delà des droits de
 * ce créateur : le dialogue le dit en tête.
 */
export function GuestParentalScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "familyWeb"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const owner = t("whatsNew:sceneFamilyOwner");
  const guest = t("whatsNew:sceneFamilyGuest");
  const dialog = step >= OPEN && step < SAVED;
  const cursor = step >= SAVE ? DIALOG_SAVE : step >= SERIES ? DIALOG_SERIES : step >= TO_RATING ? DIALOG_RATING
    : step >= HOVER ? PARENTAL_BUTTON : { x: 300, y: 300 };

  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={640} h={360} className="bg-surface-0" />
      <FauxFamilyList owner={owner} guest={guest} parental={step >= SAVED} />
      <Place x={0} y={0} w={640} h={360} className="bg-black/50" visible={dialog} />
      <FauxParentalDialog
        owner={owner} guest={guest} rating={step >= RATED ? RATING : null} series={step >= SERIES}
        visible={dialog} scale={dialog ? 1 : 0.96}
      />
      <Place x={420} y={308} visible={step >= SAVED} dy={step >= SAVED ? 0 : 8}>
        <span className="whitespace-nowrap rounded-xl border border-line-subtle bg-[var(--surface-sheet)] px-3 py-2 text-[11px] text-content-primary shadow-lg">
          {t("familyWeb:parental.saved")}
        </span>
      </Place>
      <FauxCursor
        x={cursor.x} y={cursor.y} pressed={step === OPEN || step === RATED || step === SERIES || step === SAVE}
        hidden={step === 0 || step >= SAVED} reduced={reduced}
      />
    </SceneStage>
  );
}
