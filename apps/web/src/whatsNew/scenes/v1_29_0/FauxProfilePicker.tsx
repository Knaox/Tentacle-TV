import { useTranslation } from "react-i18next";
import { Lock, UserCog } from "lucide-react";
import { profileColorStops, type FamilyProfileColor } from "@tentacle-tv/shared";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { Place, type Animated } from "../Place";

/** Un profil de la scène : un nom de scène (`whatsNew:sceneFamily*`), sa couleur, son cadenas. */
export interface SceneProfile {
  id: string;
  name: string;
  color: FamilyProfileColor;
  pin: boolean;
  guest: boolean;
}

/** La rangée, centrée : trois tuiles de 112 px, rond de 78. */
const TILE_W = 112;
const TILE_STEP = 138;
const AVATAR = 78;
const ROW_Y = 112;

/** Le centre du rond de la tuile `index` (la cible du pointeur). */
export function tileCenter(index: number, count: number): { x: number; y: number } {
  const first = 320 - ((count - 1) * TILE_STEP) / 2;
  return { x: first + index * TILE_STEP, y: ROW_Y + AVATAR / 2 };
}

/** Le fond de l'écran, peint une fois : les deux halos de `WhoIsWatchingView`. */
export const PICKER_BACKGROUND =
  "radial-gradient(70% 55% at 50% 0%, rgba(var(--brand-rgb), 0.20) 0%, rgba(var(--brand-rgb), 0.04) 50%, transparent 75%)," +
  "radial-gradient(55% 50% at 50% 100%, rgba(var(--brand-accent-rgb), 0.12) 0%, transparent 70%)";

interface FauxProfilePickerProps extends Animated {
  profiles: readonly SceneProfile[];
  /** La tuile sous le pointeur : son rond s'élève, son halo s'allume. */
  hoveredId: string | null;
}

/**
 * « Qui regarde ? » du bureau, en faux, au balisage de `WhoIsWatchingView` et
 * `ProfileTile` (recopié : le client LG ne compile pas `profiles/`) : le
 * titre, les ronds des profils — le cadenas d'un code PIN, « Invité » —, puis
 * « Gérer les profils ». Les vrais avatars de la Famille (`FamilyAvatar`).
 */
export function FauxProfilePicker({ profiles, hoveredId, ...animated }: FauxProfilePickerProps) {
  const { t } = useTranslation(["profilePicker", "family"]);
  return (
    <Place x={0} y={0} w={640} h={360} {...animated}>
      <p className="absolute inset-x-0 top-[50px] text-center text-[30px] font-extrabold tracking-tight text-content-primary">
        {t("profilePicker:whoIsWatching")}
      </p>
      {profiles.map((profile, i) => {
        const center = tileCenter(i, profiles.length);
        const hovered = profile.id === hoveredId;
        const [glow] = profileColorStops(profile.color);
        return (
          <div key={profile.id} className="absolute flex flex-col items-center" style={{ left: center.x - TILE_W / 2, top: ROW_Y, width: TILE_W }}>
            <Place x={(TILE_W - AVATAR) / 2} y={0} w={AVATAR} h={AVATAR} dy={hovered ? -5 : 0}>
              <Place
                x={-26} y={-26} w={AVATAR + 52} h={AVATAR + 52} visible={hovered} className="rounded-full"
                style={{ background: `radial-gradient(circle, ${glow}8c 0%, ${glow}26 45%, transparent 70%)` }}
              />
              <span className="relative block rounded-full">
                <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={null} size={AVATAR} />
              </span>
              {profile.pin && (
                <span className="absolute bottom-0 right-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line-subtle bg-surface-2 text-content-primary">
                  <Lock size={11} strokeWidth={2.4} aria-hidden />
                </span>
              )}
            </Place>
            <span className={`mt-[88px] w-full truncate text-center text-[13px] font-semibold ${hovered ? "text-content-primary" : "text-content-secondary"}`}>
              {profile.name}
            </span>
            <span className="mt-0.5 h-3 text-[10px] text-content-tertiary">{profile.guest ? t("family:kindGuest") : ""}</span>
          </div>
        );
      })}
      <span className="absolute left-1/2 top-[262px] inline-flex h-[30px] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-subtle bg-fill-soft px-3.5 text-[11px] font-semibold text-content-primary">
        <UserCog size={12} aria-hidden />
        {t("profilePicker:manageProfiles")}
      </span>
    </Place>
  );
}
