import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxRightsSheet, PARENTAL_ROW, RATING_POINT, TAG_POINT, rowCenter } from "./FauxRightsSheet";

/**
 * La fiche d'Ana ouverte, le pointeur sur « Contrôle parental », le clic, la
 * note maximale posée à 12, une étiquette bloquée — et le résumé de la
 * rubrique qui le dit, fiche repliée ou non. L'image finale montre tout.
 */
const STEPS = [900, 650, 750, 650, 950, 650, 1700] as const;
const HOVER = 1;
const OPEN = 2;
const TO_RATING = 3;
const RATED = 4;
const TAGGED = 5;
/** Le nom d'une note de la table de Jellyfin : le même dans toutes les langues. */
const RATING = "12";

/**
 * Admin › Utilisateurs : TOUS les droits d'un compte dans sa fiche — compte,
 * bibliothèques, contrôle parental, lecture, hors ligne, gestion —, lus et
 * écrits dans Jellyfin. Les comptes de la scène sont ceux des autres scènes
 * de la Famille (Alex, Ana, Léa).
 */
export function UserRightsScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "admin"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const accounts = [
    { id: "alex", name: t("whatsNew:sceneFamilyOwner"), color: "violet" as const },
    { id: "ana", name: t("whatsNew:sceneFamilyMember"), color: "blue" as const },
    { id: "lea", name: t("whatsNew:sceneFamilyGuest"), color: "teal" as const },
  ];
  const open = step >= OPEN;
  const cursor = step >= TAGGED ? TAG_POINT : step >= TO_RATING ? RATING_POINT : step >= HOVER ? rowCenter(PARENTAL_ROW) : { x: 210, y: 260 };

  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={640} h={360} className="bg-surface-0" />
      <Place x={28} y={28} w={300} h={300}>
        <p className="text-[18px] font-bold tracking-tight text-content-primary">{t("admin:usersTitle")}</p>
        <div className="mt-4 space-y-2.5">
          {accounts.map((account) => (
            <span
              key={account.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                account.id === "ana" ? "border-[rgba(var(--brand-rgb),0.45)] bg-fill-soft" : "border-line-subtle bg-fill-faint"
              }`}
            >
              <FamilyAvatar userId={account.id} name={account.name} color={account.color} imageTag={null} size={30} />
              <span className="text-[12px] font-semibold text-content-primary">{account.name}</span>
            </span>
          ))}
        </div>
      </Place>
      <FauxRightsSheet name={accounts[1].name} open={open} rating={step >= RATED ? RATING : null} tag={step >= TAGGED} />
      <FauxCursor
        x={cursor.x} y={cursor.y} pressed={step === OPEN || step === RATED || step === TAGGED} hidden={step === 0} reduced={reduced}
      />
    </SceneStage>
  );
}
