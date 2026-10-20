import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock, EyeOff, Film, Folder, Info, Monitor, Shield, Smartphone, Tag, Tv, UserPlus, Users, type LucideIcon,
} from "lucide-react";
import { useFamilyLibraries, useServerCapability } from "@tentacle-tv/api-client";
import { familyRightsSummary, type FamilyProfileDto, type RightsSummaryKind, type RightsSummaryTone } from "@tentacle-tv/shared";

/** Le repère de chaque ligne (le texte dit le sens) — les icônes du mobile, en Lucide. */
const ICONS: Readonly<Record<RightsSummaryKind, LucideIcon>> = {
  libraries: Folder,
  age: Shield,
  unrated: EyeOff,
  tags: Tag,
  schedule: Clock,
  requestTitles: Film,
  createGuests: UserPlus,
  parent: Users,
  watchTogether: Tv,
  offline: Smartphone,
  account: Info,
};

const TONES: Readonly<Record<RightsSummaryTone, string>> = {
  allowed: "text-content-secondary",
  limited: "text-status-warning-fg",
  denied: "text-content-tertiary",
  info: "text-content-tertiary",
};

/**
 * Les droits d'un profil EN LECTURE SEULE, dans la fenêtre étroite (téléphone,
 * iPad) — ceux que l'écran ne règle pas (`omit` : ce que `NarrowRightsEditor`
 * règle déjà) ; le reste se règle au bureau ou sur le web large. Le résumé est le modèle partagé du mobile
 * (`familyRightsSummary`, droits-mobile) ; les bibliothèques ne sont lues que
 * pour un profil que ce compte peut régler (le serveur rend alors son
 * contrôle parental) et face à un serveur qui les borne.
 */
export function ProfileRightsSummary({ profile, omit = [] }: {
  profile: FamilyProfileDto;
  /** Les lignes que l'écran règle déjà (`editedSummaryKinds`) : elles quittent le résumé. */
  omit?: readonly RightsSummaryKind[];
}) {
  const { t } = useTranslation("familyRightsSummary");
  const capable = useServerCapability("family.libraryLimits");
  const reads = capable && profile.parental !== undefined;
  const libraries = useFamilyLibraries(profile.userId, { enabled: reads });
  const summary = useMemo(
    () => familyRightsSummary({ profile, libraries: reads ? libraries.data ?? null : null }),
    [profile, reads, libraries.data],
  );
  const partial = omit.length > 0;
  const lines = summary.lines.filter((line) => !omit.includes(line.kind));
  if (lines.length === 0 && !(partial && summary.editElsewhere)) return null;

  return (
    <div className="mt-2 w-full">
      {lines.length > 0 && <p className="text-[11px] font-semibold uppercase tracking-[0.3px] text-content-tertiary">{t(partial ? "otherTitle" : "title")}</p>}
      <ul className="mt-1 flex flex-col gap-1">
        {lines.map((line) => {
          const Icon = ICONS[line.kind];
          return (
            <li key={`${line.kind}:${line.key}`} className={`flex items-start gap-2 text-[13px] leading-[18px] ${TONES[line.tone]}`}>
              <Icon size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>{t(line.key, line.params)}</span>
            </li>
          );
        })}
        {reads && libraries.isLoading && !omit.includes("libraries") && <li className="text-[13px] text-content-tertiary">{t("loading")}</li>}
      </ul>
      {summary.editElsewhere && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--brand-light)]">
          <Monitor size={13} aria-hidden />
          {t(partial ? "moreElsewhere" : "editElsewhere")}
        </p>
      )}
    </div>
  );
}
