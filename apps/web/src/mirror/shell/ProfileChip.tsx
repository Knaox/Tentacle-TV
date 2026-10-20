import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { AVATAR_GRADIENT_BG, getUserInfo } from "../../components/userMenu/menuItems";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { openSwitchScreen } from "../../profiles/switcher/switchScreenStore";

/**
 * La puce du profil actif, à côté du logo — le jumeau de `ProfileChip` du
 * mobile (session design, consigne de Damien du 20/10 : changer de profil
 * d'un geste). Sa photo, son prénom, un chevron ; le toucher ouvre « Qui
 * regarde ? » (`openSwitchScreen`, code PIN compris). Le profil dit est celui
 * de la session en cours, personnelle ou de profil.
 */
export const ProfileChip = memo(function ProfileChip() {
  const { t } = useTranslation("nav");
  const { name, initial } = getUserInfo();
  const { avatarSrc, onAvatarError, avatarVersion } = useAvatarUpload();
  return (
    <button
      type="button"
      onClick={(event) => openSwitchScreen(event.currentTarget)}
      aria-label={t("profileChipLabel", { name })}
      className="mirror-press flex h-8 min-w-0 items-center gap-1.5 rounded-full border border-line-strong bg-fill-subtle pl-[3px] pr-2"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {avatarSrc ? (
        <img
          key={`${avatarVersion}-${avatarSrc}`}
          src={avatarSrc}
          alt=""
          onError={onAvatarError}
          className="h-[26px] w-[26px] shrink-0 rounded-full bg-fill-subtle object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-cta-brand-fg"
          style={{ background: AVATAR_GRADIENT_BG }}
        >
          {initial}
        </span>
      )}
      <span className="max-w-[104px] truncate text-[15px] font-semibold text-content-primary">{name}</span>
      <ChevronDown size={14} aria-hidden className="shrink-0 text-content-secondary" />
    </button>
  );
});
