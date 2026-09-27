import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity, MonitorSmartphone, Users } from "lucide-react";
import type { SceneProps } from "../../types";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxStatTile } from "./FauxStatTile";
import { FauxUserCard, readSelfAccount, type SceneAccount } from "./FauxUserCard";
import { FauxUserSheet } from "./FauxUserSheet";

const STEPS = [900, 1000, 400, 1900] as const;
const CARD = { w: 292, h: 50 } as const;
const COLS = [24, 324] as const;
const ROWS = [146, 202, 258] as const;
/** La carte ouverte : la deuxième, un compte ordinaire. */
const TARGET = { x: COLS[1] + 200, y: ROWS[0] + 28 } as const;
const SHEET = { x: 380, y: 16, w: 244, h: 328 } as const;

/** Des prénoms, pas des comptes : la scène ne lit pas la liste réelle. */
const OTHERS: ReadonlyArray<Omit<SceneAccount, "id" | "hasAvatar">> = [
  { name: "Camille", minutesAgo: 12, devices: 2 },
  { name: "Léo", minutesAgo: 180, devices: 1 },
  { name: "Inès", minutesAgo: 60 * 26, devices: 1 },
  { name: "Hugo", minutesAgo: 60 * 24 * 3, devices: 1 },
  { name: "Manon", minutesAgo: 60 * 24 * 6, devices: 1 },
];

/**
 * La page Utilisateurs : un résumé, puis chaque compte avec sa photo. Le
 * curseur ouvre un compte : sa fiche glisse, avec son activité, ses appareils
 * jumelés à révoquer et « Voir en tant que ».
 */
export function AdminUsersScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("admin");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const accounts = useMemo<SceneAccount[]>(() => {
    const self = readSelfAccount();
    return [
      { id: self?.id ?? "self", name: self?.name || t("userYou"), hasAvatar: self?.hasAvatar ?? false, imageTag: self?.imageTag, isAdmin: true, isSelf: true, minutesAgo: 1, devices: 2 },
      ...OTHERS.map((other, index) => ({ ...other, id: `scene-${index}`, hasAvatar: false })),
    ];
  }, [t]);
  const aiming = step >= 1;
  const open = step >= 3;
  return (
    <SceneStage cycle={cycle}>
      <Place x={24} y={16} w={400}>
        <span className="block text-[15px] font-bold text-content-primary">{t("navUsers")}</span>
      </Place>
      <FauxStatTile x={24} y={46} w={192} h={90} icon={<Users />} label={t("usersStatAccounts")} value={accounts.length}
        hint={t("usersStatAdmins", { count: 1 })} />
      <FauxStatTile x={224} y={46} w={192} h={90} icon={<Activity />} tone="brand" label={t("usersStatActive")} value={5} />
      <FauxStatTile x={424} y={46} w={192} h={90} icon={<MonitorSmartphone />} label={t("pairedDevices")} value={8} />
      {accounts.map((account, index) => (
        <FauxUserCard
          key={account.id}
          account={account}
          x={COLS[index % 2]}
          y={ROWS[Math.floor(index / 2)]}
          w={CARD.w}
          h={CARD.h}
          hovered={index === 1 && aiming}
        />
      ))}
      <FauxUserSheet account={accounts[1]} {...SHEET} visible={open} dx={open ? 0 : 60} />
      <FauxCursor x={aiming ? TARGET.x : 560} y={aiming ? TARGET.y : 340} pressed={step === 2} hidden={open} reduced={reduced} />
    </SceneStage>
  );
}
