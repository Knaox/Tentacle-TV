import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import type { FamilyProfileColor } from "@tentacle-tv/shared";
import type { SceneProps } from "../../types";
import { useSceneMedia } from "../../sceneMedia";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { RightToggle } from "../../../family/page/RightToggle";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";

/** La page, le droit d'Ana allumé, son invitée qui paraît, le droit de Léa allumé. */
const STEPS = [1500, 1500, 1600, 1900] as const;
const PANEL_W = 440;
const PANEL_X = (640 - PANEL_W) / 2;
const PANEL_Y = 22;
/** La page aux tailles de l'app, réduite pour tenir dans le canevas (aide des droits comprise). */
const PANEL_SCALE = 0.74;
/** Les interrupteurs, en px de la scène (pour le curseur) — mesurés au banc. */
const ANA_SWITCH = { x: 448, y: 134 };
const LEA_SWITCH = { x: 448, y: 236 };

/**
 * La Famille, telle que Réglages › Famille la montre au propriétaire : la
 * famille PARTAGÉE (propriétaire, membre, invitée), les droits qu'il règle —
 * « Peut créer des invités » pour Ana, puis Léa, l'invitée qu'Ana vient de
 * créer (« Ajouté par Ana »), et « Peut demander des films » pour Léa, qui
 * demande à son propre nom. Les vrais composants de la page (avatar de
 * profil, interrupteur de droit), posés sur le vrai fond du titre du bandeau.
 */
export function FamilyScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "familyWeb", "family"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const { backdrop } = useSceneMedia();
  const owner = t("whatsNew:sceneFamilyOwner");
  const ana = t("whatsNew:sceneFamilyMember");
  const lea = t("whatsNew:sceneFamilyGuest");
  const cursor = step === 1 ? ANA_SWITCH : LEA_SWITCH;

  return (
    <SceneStage cycle={cycle}>
      {backdrop && (
        <Place x={0} y={0} w={640} h={360}>
          <img src={backdrop.url} alt="" draggable={false} className="h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
        </Place>
      )}
      <Place x={PANEL_X} y={PANEL_Y} w={PANEL_W} style={{ transformOrigin: "top center" }} scale={PANEL_SCALE}>
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">{t("familyWeb:shared.titleOwner")}</p>
        <ul className="overflow-hidden rounded-xl border border-line-subtle bg-surface-1 shadow-xl">
          <Row name={owner} color="violet" kind={t("family:kindOwner")} meta={`· ${t("familyWeb:owned.you")}`} />
          <Row name={ana} color="blue" kind={t("family:kindMember")}>
            <RightToggle
              label={t("family:rights.createGuests")}
              hint={t("family:rights.createGuestsHint")}
              checked={step >= 1}
              editable
            />
          </Row>
          <Row name={lea} color="teal" kind={t("family:kindGuest")} guest last
            meta={t("family:addedBy", { name: ana })} pin={step >= 3} hidden={step < 2}>
            <RightToggle
              label={t("family:rights.requestTitles")}
              hint={t("family:rights.requestTitlesHint")}
              checked={step >= 3}
              editable
            />
          </Row>
        </ul>
      </Place>
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 1 || step === 3} hidden={step === 0 || step === 2} reduced={reduced} />
    </SceneStage>
  );
}

interface RowProps {
  name: string;
  color: FamilyProfileColor;
  kind: string;
  meta?: string;
  guest?: boolean;
  pin?: boolean;
  last?: boolean;
  /** Pas encore créée : la ligne n'existe pas, elle ne réserve pas sa place. */
  hidden?: boolean;
  children?: ReactNode;
}

/** Une ligne de `ProfileRow`, aux tailles des scènes. */
function Row({ name, color, kind, meta, guest, pin, last, hidden, children }: RowProps) {
  const { t } = useTranslation("familyWeb");
  const pinLabel = t("owned.pinOn");
  if (hidden) return null;
  return (
    <li className={`flex items-start gap-2.5 px-3 py-2.5 ${last ? "" : "border-b border-line-subtle"}`}>
      <FamilyAvatar userId={name} name={name} color={color} imageTag={null} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-content-primary">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-content-tertiary">
          <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${guest ? "bg-[rgba(var(--brand-rgb),0.14)] text-[var(--brand-light)]" : "bg-fill-soft text-content-secondary"}`}>
            {kind}
          </span>
          {meta && <span>{meta}</span>}
          {pin && (
            <span className="inline-flex items-center gap-0.5">
              <Lock size={9} aria-hidden="true" />
              {pinLabel}
            </span>
          )}
        </p>
        {children}
      </div>
    </li>
  );
}
