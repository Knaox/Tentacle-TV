import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "../kit";
import { UserBadges } from "./UserBadges";
import { absoluteTime, relativeTime, type AdminUser } from "./userListModel";

interface UserCardProps {
  user: AdminUser;
  isSelf: boolean;
  /** Appareils jumelés à ce compte — `null` quand la liste n'a pas pu être lue. */
  deviceCount: number | null;
  /** L'heure de référence des « il y a… » : celle de la dernière relève. */
  now: number;
  onOpen: (id: string) => void;
}

/**
 * Un compte dans la grille : sa photo d'abord — c'est par elle qu'on
 * reconnaît quelqu'un —, son nom, son rôle, et depuis quand on ne l'a pas vu.
 * La carte entière ouvre la fiche du compte.
 */
export const UserCard = memo(function UserCard({ user, isSelf, deviceCount, now, onOpen }: UserCardProps) {
  const { t, i18n } = useTranslation("admin");
  const activity = relativeTime(user.lastActivityDate, now, i18n.language);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(user.id)}
        aria-haspopup="dialog"
        className="group flex h-full w-full items-center gap-3 rounded-xl border border-line-subtle bg-fill-faint p-3 text-left transition-colors duration-150 hover:border-line-strong hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <UserAvatar
          userId={user.id}
          name={user.name}
          hasAvatar={user.hasAvatar}
          imageTag={user.imageTag}
          size={48}
          className={user.isDisabled ? "opacity-50 grayscale" : undefined}
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`truncate text-sm font-semibold ${user.isDisabled ? "text-content-secondary" : "text-content-primary"}`}>
              {user.name}
            </span>
            <UserBadges user={user} isSelf={isSelf} />
          </span>
          <span className="mt-1 block truncate text-xs text-content-tertiary">
            {activity && user.lastActivityDate ? (
              <time dateTime={user.lastActivityDate} title={absoluteTime(user.lastActivityDate, i18n.language) ?? undefined}>
                {t("userActive", { time: activity })}
              </time>
            ) : (
              t("lastActivityNever")
            )}
            {deviceCount ? ` · ${t("userDevices", { count: deviceCount })}` : null}
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-content-quaternary transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </button>
    </li>
  );
});
