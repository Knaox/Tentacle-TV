import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { AvatarCharacter } from "@tentacle-tv/shared";
import { avatarThumbUrl } from "./avatarImages";

const PORTRAIT = 64;

interface AvatarStoryPanelProps {
  /** Le personnage survolé, désigné au clavier ou choisi ; null : la photo actuelle. */
  character: AvatarCharacter | null;
  /** La photo du compte (adresse servie par `useAvatarUpload`), s'il en a une. */
  currentSrc: string | null;
  /** L'initiale du compte, sans photo. */
  initial: string;
}

/**
 * Le pied de la galerie : on y fait connaissance. Le personnage survolé (ou
 * choisi) s'y présente — son portrait, son nom, son histoire ; sans personnage,
 * la photo actuelle du compte. Annoncé poliment aux lecteurs d'écran.
 */
export const AvatarStoryPanel = memo(function AvatarStoryPanel({ character, currentSrc, initial }: AvatarStoryPanelProps) {
  const { t } = useTranslation("avatars");
  return (
    <div className="flex min-w-0 flex-1 items-center gap-4" aria-live="polite">
      <span
        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold text-cta-brand-fg"
        style={{
          width: PORTRAIT,
          height: PORTRAIT,
          background: character ? character.tone : "linear-gradient(135deg, var(--brand-dark), var(--brand))",
        }}
      >
        {character ? (
          <img key={character.id} src={avatarThumbUrl(character.id)} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : currentSrc ? (
          <img src={currentSrc} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          initial
        )}
      </span>
      <div className="min-w-0 flex-1">
        {character ? (
          <>
            <p className="truncate text-base font-semibold text-content-primary">
              {t(`characters.${character.id}.name`)}
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-content-tertiary">
              {t(`characters.${character.id}.story`)}
            </p>
          </>
        ) : (
          <>
            <p className="truncate text-base font-semibold text-content-primary">
              {currentSrc ? t("current") : t("noPhoto")}
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-content-tertiary">{t("pickHint")}</p>
          </>
        )}
      </div>
    </div>
  );
});
