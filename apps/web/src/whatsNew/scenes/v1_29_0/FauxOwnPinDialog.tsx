import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FAMILY_PIN_LENGTH } from "@tentacle-tv/shared";
import { Place, type Animated } from "../Place";
import { instant } from "../sceneMotion";

interface FauxOwnPinDialogProps extends Animated {
  x: number;
  w: number;
  /** Le BAS du panneau : sa hauteur suit la consigne (et la langue), ses boutons non. */
  bottom: number;
  /** Les chiffres tapés dans « Nouveau code », puis dans « Confirmer le code ». */
  typed: boolean;
  confirmed: boolean;
  reduced: boolean;
}

/** Le premier chiffre arrive un peu après le champ, les suivants à la cadence d'une frappe (celle de `FauxPinPad`). */
const FIRST_DIGIT_S = 0.25;
const DIGIT_PACE_S = 0.17;
/** Le centre d'« Enregistrer », depuis le coin bas-droit du panneau, bordure comprise (cible du pointeur). */
export const OWN_PIN_SAVE = { right: 1 + 18 + 44, bottom: 1 + 18 + 15 };

/**
 * « Mon code PIN », en faux, au balisage de `PinDialog` ouvert par
 * `OwnPinDialog` (recopié : le vrai est un formulaire en portail) : le titre,
 * la consigne et son effet sur les TV, les deux champs masqués côte à côte —
 * « Nouveau code », « Confirmer le code » — dont les points se posent l'un
 * après l'autre, puis « Annuler » et « Enregistrer ».
 */
export function FauxOwnPinDialog({ x, w, bottom, typed, confirmed, reduced, ...animated }: FauxOwnPinDialogProps) {
  const { t } = useTranslation("familyWeb");
  return (
    <Place x={x} y={0} w={w} h={bottom} className="flex flex-col justify-end" {...animated}>
      <div className="rounded-[var(--radius-xl)] border border-line-subtle bg-[var(--surface-modal)] p-[18px] shadow-[var(--shadow-modal)]">
        <p className="text-[14px] font-bold tracking-tight text-content-primary">{t("pin.titleSelf")}</p>
        <p className="mt-1.5 text-[10px] leading-[14px] text-content-tertiary">
          {t("pin.hint")} {t("pin.effect")}
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <PinField label={t("pin.label")} filled={typed} reduced={reduced} />
          <PinField label={t("pin.confirmLabel")} filled={confirmed} reduced={reduced} />
        </div>
        <div className="mt-4 flex items-center justify-end gap-1.5">
          <span className="flex h-[30px] items-center rounded-lg border border-line-subtle bg-fill-soft px-3 text-[10.5px] font-semibold text-content-primary">
            {t("cancel")}
          </span>
          <span
            className="flex h-[30px] w-[88px] items-center justify-center rounded-lg text-[10.5px] font-semibold text-cta-brand-fg"
            style={{ backgroundImage: "var(--cta-brand-gradient)" }}
          >
            {t("pin.save")}
          </span>
        </div>
      </div>
    </Place>
  );
}

function PinField({ label, filled, reduced }: { label: string; filled: boolean; reduced: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-semibold text-content-secondary">{label}</p>
      <div className="flex h-[32px] max-w-[110px] items-center justify-center gap-2.5 rounded-lg border border-line-subtle bg-tentacle-surface">
        {Array.from({ length: FAMILY_PIN_LENGTH }, (_, i) => (
          <motion.span
            key={i}
            className="h-[6px] w-[6px] rounded-full bg-content-primary"
            initial={false}
            animate={{ opacity: filled ? 1 : 0 }}
            transition={reduced ? instant : { duration: 0.1, delay: filled ? FIRST_DIGIT_S + i * DIGIT_PACE_S : 0 }}
          />
        ))}
      </div>
    </div>
  );
}
