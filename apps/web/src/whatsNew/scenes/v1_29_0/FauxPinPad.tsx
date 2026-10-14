import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Delete } from "lucide-react";
import { FAMILY_PIN_LENGTH } from "@tentacle-tv/shared";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { Place, type Animated } from "../Place";
import type { SceneProfile } from "./FauxProfilePicker";

interface FauxPinPadProps extends Animated {
  profile: SceneProfile;
  /** Les chiffres tapés se posent l'un après l'autre (au clavier : le pointeur ne bouge pas). */
  typed: boolean;
  reduced: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "erase"] as const;
const KEY = 36;
const KEY_STEP = 46;
/** Le premier chiffre arrive un peu après le pavé, les suivants à la cadence d'une frappe. */
const FIRST_DIGIT_S = 0.3;
const DIGIT_PACE_S = 0.17;

/**
 * Le pavé du code PIN de « Qui regarde ? », en faux, au balisage de
 * `ProfilePinPad` (recopié : le vrai écoute le clavier de toute la fenêtre) :
 * « Retour aux profils » en haut à gauche, le rond du profil, son nom, la
 * consigne, les quatre points — pleins l'un après l'autre —, le pavé.
 */
export function FauxPinPad({ profile, typed, reduced, ...animated }: FauxPinPadProps) {
  const { t } = useTranslation("profilePicker");
  return (
    <Place x={0} y={0} w={640} h={360} {...animated}>
      <span className="absolute left-[18px] top-[16px] inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line-subtle bg-fill-soft px-3 text-[11px] font-semibold text-content-primary">
        <ArrowLeft size={12} aria-hidden />
        {t("pin.back")}
      </span>
      <div className="absolute inset-x-0 top-[22px] flex flex-col items-center">
        <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={null} size={58} />
        <p className="mt-2 text-[18px] font-bold tracking-tight text-content-primary">{profile.name}</p>
        <p className="mt-0.5 text-[11px] text-content-tertiary">{t("pin.prompt")}</p>
        <div className="mt-3 flex">
          {Array.from({ length: FAMILY_PIN_LENGTH }, (_, i) => (
            <span key={i} className="relative mx-1.5 h-[11px] w-[11px] rounded-full border border-line-strong">
              <motion.span
                className="absolute -inset-px rounded-full bg-content-primary"
                initial={false}
                animate={{ opacity: typed ? 1 : 0 }}
                transition={reduced ? { duration: 0 } : { duration: 0.12, delay: typed ? FIRST_DIGIT_S + i * DIGIT_PACE_S : 0 }}
              />
            </span>
          ))}
        </div>
      </div>
      {KEYS.map((key, i) =>
        key === "" ? null : (
          <span
            key={key}
            className="absolute flex items-center justify-center rounded-full border border-line-subtle bg-fill-soft text-[15px] font-semibold text-content-primary"
            style={{ left: 320 - KEY_STEP - KEY / 2 + (i % 3) * KEY_STEP, top: 168 + Math.floor(i / 3) * KEY_STEP, width: KEY, height: KEY }}
          >
            {key === "erase" ? <Delete size={15} aria-hidden /> : key}
          </span>
        ),
      )}
    </Place>
  );
}
