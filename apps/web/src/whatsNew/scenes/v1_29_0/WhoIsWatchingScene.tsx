import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { FauxCursor, FauxRow, Place, SceneStage, useSceneClock } from "..";
import { AVATAR_SLOT, FauxNavBar } from "../v1_22_0/FauxNavBar";
import { FauxAvatarMenu, SWITCH_ROW } from "./FauxAvatarMenu";
import { FauxPinPad } from "./FauxPinPad";
import { FauxProfilePicker, PICKER_BACKGROUND, tileCenter, type SceneProfile } from "./FauxProfilePicker";

/**
 * « Qui regarde ? », le pointeur sur Ana, le clic, son code PIN tapé, l'app
 * dans SON profil, le clic sur l'avatar, son menu, « Changer de profil », et
 * l'écran des profils revient — l'image finale, qui est aussi celle du départ.
 */
const STEPS = [800, 550, 300, 1150, 900, 300, 800, 300, 1500] as const;
const HOVER = 1;
const PICK = 2;
const PIN = 3;
const HOME = 4;
const OPEN_MENU = 5;
const MENU = 6;
const SWITCH = 7;
const BACK = 8;
const CHOSEN = 1;

/**
 * « Qui regarde ? » sur l'ordinateur : chacun ouvre son profil — derrière son
 * code PIN s'il en a un —, l'app s'ouvre dans ce profil (son rond, sa
 * couleur), et « Changer de profil », dans le menu de l'avatar, ramène aux
 * profils à tout moment. Des profils de scène (Alex, Ana, Léa l'invitée), les
 * vrais avatars de la Famille, de vraies affiches derrière.
 */
export function WhoIsWatchingScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "reco", "common"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const profiles: SceneProfile[] = [
    { id: "alex", name: t("whatsNew:sceneFamilyOwner"), color: "violet", pin: false, guest: false },
    { id: "ana", name: t("whatsNew:sceneFamilyMember"), color: "blue", pin: true, guest: false },
    { id: "lea", name: t("whatsNew:sceneFamilyGuest"), color: "teal", pin: false, guest: true },
  ];
  const chosen = profiles[CHOSEN];
  const tile = tileCenter(CHOSEN, profiles.length);
  const picker = step < PIN || step >= BACK;
  const pad = step === PIN;
  const home = step >= HOME && step < BACK;
  const menu = step >= MENU && step < BACK;
  const avatar = { x: AVATAR_SLOT.x + AVATAR_SLOT.size / 2, y: AVATAR_SLOT.y + AVATAR_SLOT.size / 2 };
  const cursor = step >= MENU ? SWITCH_ROW : step >= HOME ? avatar : step >= HOVER ? tile : { x: 470, y: 330 };

  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={640} h={360} className="bg-surface-0" visible={!home} style={{ backgroundImage: PICKER_BACKGROUND }} />
      <FauxProfilePicker profiles={profiles} hoveredId={step === HOVER || step === PICK ? chosen.id : null} visible={picker} dy={picker ? 0 : 6} />
      <FauxPinPad profile={chosen} typed={pad} reduced={reduced} visible={pad} dy={pad ? 0 : 6} />
      <Place x={0} y={0} w={640} h={360} visible={home}>
        <FauxNavBar
          active="home"
          pinned={false}
          moreOpen={false}
          avatar={<FamilyAvatar userId={chosen.id} name={chosen.name} color={chosen.color} imageTag={null} size={AVATAR_SLOT.size} />}
        />
        <FauxRow x={32} y={82} title={t("reco:rowForYou")} count={7} cardW={78} gap={12} />
        <FauxRow x={32} y={232} title={t("common:latestAdditionsShort")} count={7} cardW={78} gap={12} offset={7} />
      </Place>
      <FauxAvatarMenu profile={chosen} hoverSwitch={step >= MENU} visible={menu} scale={menu ? 1 : 0.96} />
      <FauxCursor
        x={cursor.x} y={cursor.y} pressed={step === PICK || step === OPEN_MENU || step === SWITCH} hidden={pad || step >= BACK} reduced={reduced}
      />
    </SceneStage>
  );
}
