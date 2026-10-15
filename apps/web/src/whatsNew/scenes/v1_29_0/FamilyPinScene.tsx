import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { FauxCursor, FauxRow, Place, SceneStage, useSceneClock } from "..";
import { AVATAR_SLOT, FauxNavBar } from "../v1_22_0/FauxNavBar";
import { FauxOwnPinDialog, OWN_PIN_SAVE } from "./FauxOwnPinDialog";
import { FauxPinSuggest, SUGGEST_SET_FROM_BOTTOM } from "./FauxPinSuggest";

/**
 * L'accueil, « Action recommandée » qui paraît, le pointeur sur « Poser un
 * code PIN », le clic, « Mon code PIN » À SA PLACE, les deux saisies, le clic
 * sur « Enregistrer », et la confirmation de l'app — l'image finale.
 */
const STEPS = [900, 1600, 750, 300, 1300, 1100, 700, 300, 2800] as const;
const SUGGEST = 1;
const AIM_SET = 2;
const CLICK_SET = 3;
const TYPE = 4;
const CONFIRM = 5;
const AIM_SAVE = 6;
const SAVE = 7;
const DONE = 8;
const SUGGEST_BOX = { x: 140, w: 360, bottom: 344 };
const PIN_BOX = { x: 170, w: 300, bottom: 282 };
const SET_TARGET = { x: 320, y: SUGGEST_BOX.bottom - SUGGEST_SET_FROM_BOTTOM };
const SAVE_TARGET = { x: PIN_BOX.x + PIN_BOX.w - OWN_PIN_SAVE.right, y: PIN_BOX.bottom - OWN_PIN_SAVE.bottom };

/**
 * Le code PIN conseillé : au démarrage, tant que son profil n'en a pas, la
 * fenêtre « Action recommandée » dit pourquoi en poser un ; « Poser un code
 * PIN » ouvre la saisie à sa place, deux fois quatre chiffres, et l'app
 * confirme « Code PIN enregistré. ». Derrière, le vrai accueil — de vraies
 * affiches — et le rond du compte dans la barre.
 */
export function FamilyPinScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "reco", "common", "familyWeb"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const name = t("whatsNew:sceneFamilyMember");
  const suggest = step >= SUGGEST && step < TYPE;
  const pin = step >= TYPE && step < DONE;
  const done = step >= DONE;
  const cursor = step >= AIM_SAVE ? SAVE_TARGET : step >= AIM_SET ? SET_TARGET : { x: 520, y: 318 };

  return (
    <SceneStage cycle={cycle}>
      <FauxNavBar
        active="home"
        pinned={false}
        moreOpen={false}
        avatar={<FamilyAvatar userId="ana" name={name} color="blue" imageTag={null} size={AVATAR_SLOT.size} />}
      />
      <FauxRow x={32} y={82} title={t("reco:rowForYou")} count={7} cardW={78} gap={12} />
      <FauxRow x={32} y={232} title={t("common:latestAdditionsShort")} count={7} cardW={78} gap={12} offset={7} />
      {/* Le voile de la fenêtre, sans flou : sa couleur seule (`--glass-backdrop`). */}
      <Place x={0} y={0} w={640} h={360} visible={suggest || pin} style={{ background: "var(--glass-backdrop)" }} />
      <FauxPinSuggest {...SUGGEST_BOX} visible={suggest} scale={suggest ? 1 : 0.96} />
      <FauxOwnPinDialog
        {...PIN_BOX} typed={step >= TYPE} confirmed={step >= CONFIRM} reduced={reduced} visible={pin} scale={pin ? 1 : 0.96}
      />
      {/* Le toast de réussite de l'app (`Toast`, `success`) : le bas-droit, l'entrée par la droite. */}
      <Place x={444} y={310} w={180} visible={done} dx={done ? 0 : 30}>
        <div
          className="relative overflow-hidden rounded-lg px-3 py-2.5 text-[11px] text-content-primary shadow-lg"
          style={{ background: "var(--status-success-bg)", border: "1px solid rgba(16,185,129,0.32)" }}
        >
          {t("familyWeb:pin.saved")}
          <span className="absolute bottom-0 left-0 block h-0.5 w-3/4" style={{ background: "var(--status-success-fg)" }} />
        </div>
      </Place>
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === CLICK_SET || step === SAVE} reduced={reduced} />
    </SceneStage>
  );
}
