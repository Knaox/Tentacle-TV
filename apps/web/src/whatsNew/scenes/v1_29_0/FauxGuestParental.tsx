import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Lock, ShieldCheck } from "lucide-react";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { Place, type Animated } from "../Place";

/** Les cibles du pointeur, en px du canevas. */
export const PARENTAL_BUTTON = { x: 452, y: 154 };
export const DIALOG_RATING = { x: 360, y: 168 };
export const DIALOG_SERIES = { x: 222, y: 228 };
export const DIALOG_SAVE = { x: 432, y: 300 };

const BRAND = { backgroundImage: "var(--cta-brand-gradient)" } as const;
const UNRATED = ["Movie", "Series", "Book", "Music"] as const;

interface FauxFamilyListProps extends Animated {
  owner: string;
  guest: string;
  /** Le contrôle parental posé : la mention paraît sous l'invitée. */
  parental: boolean;
}

/** Réglages › Famille, en faux, au balisage de `ProfileRow` : le propriétaire, puis l'invitée et ses boutons. */
export function FauxFamilyList({ owner, guest, parental, ...animated }: FauxFamilyListProps) {
  const { t } = useTranslation(["familyWeb", "family"]);
  return (
    <Place x={96} y={40} w={448} h={180} {...animated}>
      <p className="text-[18px] font-bold tracking-tight text-content-primary">{t("familyWeb:nav")}</p>
      <div className="mt-3 rounded-xl border border-line-subtle bg-fill-faint">
        <span className="flex items-center gap-3 border-b border-line-subtle px-3 py-2.5">
          <FamilyAvatar userId="alex" name={owner} color="violet" imageTag={null} size={30} />
          <span className="text-[12px] font-semibold text-content-primary">{owner}</span>
          <span className="rounded-full bg-fill-soft px-2 py-0.5 text-[9px] font-semibold text-content-secondary">{t("family:kindOwner")}</span>
        </span>
        <span className="flex items-center gap-3 px-3 py-2.5">
          <FamilyAvatar userId="lea" name={guest} color="teal" imageTag={null} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-content-primary">{guest}</span>
            <span className="mt-0.5 flex items-center gap-2 text-[9px] text-content-tertiary">
              <span className="rounded-full bg-[rgba(var(--brand-rgb),0.14)] px-2 py-0.5 font-semibold text-[var(--brand-light)]">{t("family:kindGuest")}</span>
              <span className="relative inline-block h-3 w-28">
                <Place x={0} y={0} visible={parental}>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap"><ShieldCheck size={9} aria-hidden />{t("familyWeb:parental.on")}</span>
                </Place>
              </span>
            </span>
          </span>
          <span className="inline-flex h-[24px] items-center gap-1 rounded-lg border border-line-subtle bg-fill-soft px-2 text-[9px] font-semibold text-content-primary">
            <ShieldCheck size={10} aria-hidden />{t("familyWeb:parental.open")}
          </span>
          <span className="inline-flex h-[24px] items-center gap-1 rounded-lg border border-line-subtle bg-fill-soft px-2 text-[9px] font-semibold text-content-primary">
            <Lock size={10} aria-hidden />{t("familyWeb:owned.setPin")}
          </span>
        </span>
      </div>
    </Place>
  );
}

interface FauxParentalDialogProps extends Animated {
  owner: string;
  guest: string;
  rating: string | null;
  series: boolean;
}

/**
 * Le dialogue « Contrôle parental » d'un invité, au balisage de
 * `GuestParentalDialog` (recopié) : l'en-tête au bouclier, l'avertissement —
 * jamais au-delà des droits du créateur —, la note maximale, les types bloqués
 * sans note, et le pied « Annuler / Enregistrer ».
 */
export function FauxParentalDialog({ owner, guest, rating, series, ...animated }: FauxParentalDialogProps) {
  const { t } = useTranslation(["familyWeb", "userRights"]);
  return (
    <Place x={170} y={24} w={300} h={312} className="rounded-2xl border border-line-subtle bg-[var(--surface-sheet)] shadow-2xl" {...animated}>
      <div className="flex items-start gap-2.5 border-b border-line-subtle px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-cta-brand-fg" style={BRAND}>
          <ShieldCheck size={14} aria-hidden />
        </span>
        <span className="text-[12px] font-bold leading-tight text-content-primary">{t("familyWeb:parental.title", { name: guest })}</span>
      </div>
      <div className="space-y-2 px-4 pt-3">
        <p className="rounded-lg border border-line-subtle bg-fill-subtle px-2 py-1.5 text-[8px] leading-snug text-content-secondary">
          {t("familyWeb:parental.ceiling", { name: guest, creator: owner })}
        </p>
        <p className="text-[10px] font-medium text-content-primary">{t("userRights:fields.maxParentalRating.label")}</p>
        <span className="flex h-[24px] items-center justify-between rounded-[8px] border border-line-subtle bg-tentacle-surface px-2 text-[10px] text-content-primary">
          {rating ?? t("userRights:values.noLimit")}
          <ChevronDown size={11} className="text-content-tertiary" aria-hidden />
        </span>
        <p className="pt-1 text-[10px] font-medium text-content-primary">{t("userRights:fields.blockUnratedItems.label")}</p>
        <span className="grid grid-cols-2 gap-y-1.5 text-[9px] text-content-secondary">
          {UNRATED.map((type) => (
            <span key={type} className="flex items-center gap-1.5">
              <span
                className={`flex h-3 w-3 items-center justify-center rounded-[3px] border ${type === "Series" && series ? "border-transparent bg-[var(--brand)]" : "border-line-strong"}`}
              >
                {type === "Series" && series && <Check size={8} className="text-white" aria-hidden />}
              </span>
              {t(`userRights:parental.unrated.${type}`)}
            </span>
          ))}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 border-t border-line-subtle px-4 py-2.5">
        <span className="rounded-lg border border-line-subtle bg-fill-soft px-3 py-1.5 text-[10px] font-semibold text-content-primary">{t("familyWeb:parental.cancel")}</span>
        <span className="rounded-lg px-3 py-1.5 text-[10px] font-semibold text-cta-brand-fg" style={BRAND}>{t("familyWeb:parental.save")}</span>
      </div>
    </Place>
  );
}
