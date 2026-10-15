import { useTranslation } from "react-i18next";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Place, type Animated } from "../Place";

interface FauxPinSuggestProps extends Animated {
  x: number;
  w: number;
  /** Le BAS du panneau, en px logiques : sa hauteur suit ses textes (et la langue), ses boutons non. */
  bottom: number;
}

/** Le centre de « Poser un code PIN », au-dessus du bas du panneau, bordure comprise (la cible du pointeur). */
export const SUGGEST_SET_FROM_BOTTOM = 1 + 18 + 28 + 5 + 14;

/**
 * La fenêtre « Action recommandée » du démarrage, en faux, au balisage de
 * `FamilyPinSuggestDialog` (variante `startup`, recopiée : la vraie est une
 * `Modal` en portail) : le cadenas en dégradé de marque, « Posez votre code
 * PIN », pourquoi, l'encadré qui dit ce que le code protège, puis « Poser un
 * code PIN » et « Configurer plus tard ». Un halo posé une fois, aucun flou.
 */
export function FauxPinSuggest({ x, w, bottom, ...animated }: FauxPinSuggestProps) {
  const { t } = useTranslation("family");
  return (
    <Place x={x} y={0} w={w} h={bottom} className="flex flex-col justify-end" {...animated}>
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-line-subtle bg-[var(--surface-modal)] p-[18px] shadow-[var(--shadow-modal)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60"
          style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(var(--brand-rgb), 0.28), transparent 70%)" }}
        />
        <div className="relative flex flex-col items-center text-center">
          <span
            className="flex h-[34px] w-[34px] items-center justify-center rounded-xl text-cta-brand-fg shadow-lg"
            style={{ backgroundImage: "var(--cta-brand-gradient)" }}
          >
            <LockKeyhole size={16} aria-hidden />
          </span>
          <p className="mt-2 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-light)]">{t("pinSuggest.eyebrow")}</p>
          <p className="mt-0.5 text-[14px] font-bold tracking-tight text-content-primary">{t("pinSuggest.title")}</p>
          <p className="mt-1 text-[10px] leading-[14px] text-content-secondary">{t("pinSuggest.body")}</p>
        </div>
        <p className="relative mt-3 flex gap-2 rounded-xl border border-line-subtle bg-fill-subtle p-2.5 text-left text-[9.5px] leading-[13.5px] text-content-secondary">
          <ShieldCheck size={13} aria-hidden className="mt-px flex-shrink-0 text-[var(--brand-light)]" />
          <span>{t("pinSuggest.why")}</span>
        </p>
        <div className="relative mt-3.5 flex flex-col gap-[5px]">
          <span
            className="flex h-[28px] w-full items-center justify-center rounded-lg text-[10.5px] font-bold text-cta-brand-fg"
            style={{ backgroundImage: "var(--cta-brand-gradient)" }}
          >
            {t("pinSuggest.set")}
          </span>
          <span className="flex h-[28px] w-full items-center justify-center rounded-lg text-[10.5px] font-semibold text-content-secondary">
            {t("pinSuggest.later")}
          </span>
        </div>
      </div>
    </Place>
  );
}
