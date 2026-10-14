import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCursor, FauxRow, Place, SceneStage, useSceneClock } from "..";
import { AVATAR_SLOT, FauxNavBar } from "../v1_22_0/FauxNavBar";
import { ACCOUNT_GRADIENT, ACCOUNT_PHOTO, FauxAccountMenu } from "./FauxAccountMenu";
import { FauxAvatarGallery, castTileCenter } from "./FauxAvatarGallery";
import { SCENE_CHOSEN } from "./avatarSceneCast";

/**
 * Le pointeur va à l'avatar, le clic, le menu, la photo de l'en-tête, le clic,
 * la galerie s'ouvre, un personnage survolé raconte son histoire, le clic le
 * choisit — et la galerie reste à l'écran, « Choisir Huit » prêt.
 */
const STEPS = [600, 650, 300, 900, 300, 1000, 1100, 300, 1700] as const;
const TO_AVATAR = 1;
const PRESS_AVATAR = 2;
const MENU_OPEN = 3;
const PRESS_PHOTO = 4;
const GALLERY = 5;
const HOVER = 6;
const PICK = 7;

/**
 * La galerie des photos de profil : l'avatar, puis la photo de l'en-tête de
 * son menu — « Changer la photo de profil » —, et la troupe s'ouvre : 36
 * personnages, chacun avec son nom et son histoire (les vraies vignettes, les
 * vrais mots de la galerie), l'import d'une photo en tête. Un compte sans
 * photo (son initiale, le dégradé de la marque), comme au premier jour.
 */
export function AvatarsScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "reco", "common"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const name = t("whatsNew:sceneFamilyOwner");
  const menu = step >= MENU_OPEN && step < GALLERY;
  const gallery = step >= GALLERY;
  const avatar = { x: AVATAR_SLOT.x + AVATAR_SLOT.size / 2, y: AVATAR_SLOT.y + AVATAR_SLOT.size / 2 };
  const tile = castTileCenter(SCENE_CHOSEN);
  const cursor = step >= GALLERY ? tile : step >= MENU_OPEN ? ACCOUNT_PHOTO : step >= TO_AVATAR ? avatar : { x: 470, y: 330 };
  const initial = (
    <span className="flex h-full w-full items-center justify-center text-[12px] font-bold text-cta-brand-fg" style={{ background: ACCOUNT_GRADIENT }}>
      {Array.from(name)[0]?.toUpperCase() ?? "?"}
    </span>
  );

  return (
    <SceneStage cycle={cycle}>
      <FauxNavBar active="home" pinned={false} moreOpen={false} avatar={initial} />
      <FauxRow x={32} y={82} title={t("reco:rowForYou")} count={7} cardW={78} gap={12} />
      <FauxRow x={32} y={232} title={t("common:latestAdditionsShort")} count={7} cardW={78} gap={12} offset={7} />
      <FauxAccountMenu name={name} photoHover={step === MENU_OPEN || step === PRESS_PHOTO} visible={menu} scale={menu ? 1 : 0.96} />
      <Place x={0} y={0} w={640} h={360} visible={gallery} className="bg-black/55" style={{ zIndex: 14 }} />
      <FauxAvatarGallery
        hovered={step >= HOVER ? SCENE_CHOSEN : null}
        chosen={step >= PICK ? SCENE_CHOSEN : null}
        visible={gallery}
        scale={gallery ? 1 : 0.97}
      />
      <FauxCursor
        x={cursor.x} y={cursor.y} pressed={step === PRESS_AVATAR || step === PRESS_PHOTO || step === PICK} reduced={reduced}
      />
    </SceneStage>
  );
}
