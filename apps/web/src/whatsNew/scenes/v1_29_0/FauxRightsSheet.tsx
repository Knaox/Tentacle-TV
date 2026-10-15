import { useTranslation } from "react-i18next";
import { ChevronDown, X } from "lucide-react";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { Place, type Animated } from "../Place";

/** La fiche, à droite du canevas ; ses rangées en px logiques. */
export const SHEET_X = 344;
const SHEET_W = 296;
const LIST_X = 16;
const LIST_W = SHEET_W - 32;
export const ROW_H = 36;
const LIST_Y = 102;
/** Le contenu ouvert sous « Contrôle parental » : les rangées suivantes descendent d'autant. */
export const PANEL_H = 128;
export const PARENTAL_ROW = 2;

export const GROUPS = ["account", "libraries", "parental", "playback", "offline", "management"] as const;

/** Le centre d'une rangée, en px du canevas (pour le pointeur). */
export function rowCenter(index: number): { x: number; y: number } {
  return { x: SHEET_X + LIST_X + LIST_W - 40, y: LIST_Y + index * ROW_H + ROW_H / 2 };
}

/** La note maximale et la saisie d'une étiquette, dans le contenu ouvert. */
export const RATING_POINT = { x: SHEET_X + 200, y: LIST_Y + (PARENTAL_ROW + 1) * ROW_H + 34 };
export const TAG_POINT = { x: SHEET_X + 120, y: LIST_Y + (PARENTAL_ROW + 1) * ROW_H + 96 };

interface FauxRightsSheetProps extends Animated {
  name: string;
  open: boolean;
  /** La note choisie (« 12 ») ; null : aucune limite. */
  rating: string | null;
  tag: boolean;
}

/**
 * La fiche d'un compte (Admin › Utilisateurs) au balisage de `UserRightsPanel`,
 * recopié — le dossier de l'administration n'entre pas dans le client LG :
 * l'en-tête, « Droits », six rubriques résumées en une ligne, et « Contrôle
 * parental » qui s'ouvre sur la note maximale et les étiquettes bloquées. Le
 * résumé suit ce qui change, comme dans l'app.
 */
export function FauxRightsSheet({ name, open, rating, tag, ...animated }: FauxRightsSheetProps) {
  const { t } = useTranslation(["userRights", "whatsNew"]);
  const parentalSummary = [
    rating ? t("summary.ratingMax", { rating }) : null,
    tag ? t("summary.blockedTags", { count: 1 }) : null,
  ].filter(Boolean).join(" · ") || t("summary.noParental");
  const summaries: Record<(typeof GROUPS)[number], string> = {
    account: `${t("summary.standard")} · ${t("summary.localOnly")}`,
    libraries: t("summary.allLibraries"),
    parental: parentalSummary,
    playback: t("summary.playbackFull"),
    offline: t("summary.download"),
    management: t("summary.managementCount", { count: 2 }),
  };

  return (
    <Place x={SHEET_X} y={0} w={SHEET_W} h={360} className="border-l border-line-subtle bg-[var(--surface-sheet)]" {...animated}>
      <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-4">
        <FamilyAvatar userId="lea" name={name} color="teal" imageTag={null} size={40} />
        <span className="flex-1 text-[15px] font-semibold text-content-primary">{name}</span>
        <X size={14} className="text-content-tertiary" aria-hidden />
      </div>
      <p className="absolute left-4 top-[80px] text-[9px] font-semibold uppercase tracking-wider text-content-tertiary">{t("sectionTitle")}</p>
      <div
        className="absolute overflow-hidden rounded-xl border border-line-subtle bg-fill-faint"
        style={{ left: LIST_X, top: LIST_Y, width: LIST_W, height: 360 - LIST_Y }}
      >
        {GROUPS.map((group, index) => (
          <Place
            key={group}
            x={0}
            y={index * ROW_H}
            w={LIST_W}
            h={ROW_H}
            dy={open && index > PARENTAL_ROW ? PANEL_H : 0}
            className={`border-b border-line-subtle ${group === "parental" && open ? "bg-fill-subtle" : ""}`}
          >
            <span className="flex h-full items-center gap-2 px-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold leading-tight text-content-primary">{t(`groups.${group}`)}</span>
                <span className="block truncate text-[9px] leading-tight text-content-tertiary">{summaries[group]}</span>
              </span>
              <ChevronDown size={12} className={`text-content-tertiary ${group === "parental" && open ? "rotate-180" : ""}`} aria-hidden />
            </span>
          </Place>
        ))}
        <Place x={0} y={(PARENTAL_ROW + 1) * ROW_H} w={LIST_W} h={PANEL_H} visible={open} dy={open ? 0 : -6}>
          <div className="space-y-1 px-3 pt-2">
            <p className="text-[10px] font-medium text-content-primary">{t("fields.maxParentalRating.label")}</p>
            <span className="flex h-[24px] items-center justify-between rounded-[8px] border border-line-subtle bg-tentacle-surface px-2 text-[10px] text-content-primary">
              {rating ?? t("values.noLimit")}
              <ChevronDown size={11} className="text-content-tertiary" aria-hidden />
            </span>
            <p className="pt-1.5 text-[10px] font-medium text-content-primary">{t("fields.blockedTags.label")}</p>
            <span className="relative block h-[22px]">
              <Place x={0} y={3} visible={tag} scale={tag ? 1 : 0.9}>
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line-subtle bg-fill-soft px-2 py-0.5 text-[9px] font-medium text-content-primary">
                  {t("whatsNew:sceneRightsTag")} <X size={9} aria-hidden />
                </span>
              </Place>
            </span>
            <span className="flex h-[22px] items-center rounded-[8px] border border-line-subtle bg-tentacle-surface px-2 text-[9px] text-content-quaternary">
              {t("parental.tagPlaceholder")}
            </span>
          </div>
        </Place>
      </div>
    </Place>
  );
}
