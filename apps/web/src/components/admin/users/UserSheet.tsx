import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { PairedDevice } from "@tentacle-tv/api-client";
import { Sheet } from "../../ui/Sheet";
import { UserAvatar } from "../kit";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { UserBadges } from "./UserBadges";
import { UserDevicesSection } from "./UserDevicesSection";
import { UserImpersonation } from "./UserImpersonation";
import { UserRightsSection } from "./UserRightsSection";
import { SHEET_LIST, UserSheetSection } from "./UserSheetSection";
import { absoluteTime, relativeTime, type AdminUser } from "./userListModel";

interface UserSheetProps {
  /** Le compte ouvert, `null` : fiche fermée. */
  user: AdminUser | null;
  isSelf: boolean;
  devices: PairedDevice[] | undefined;
  devicesFailed: boolean;
  now: number;
  onClose: () => void;
}

/** Hauteur de la fiche sur téléphone : presque tout l'écran, comme celle d'un ticket. */
const MOBILE_HEIGHT_RATIO = 0.92;
const DESKTOP_WIDTH = 440;

/**
 * La fiche d'un compte : qui c'est, quand on l'a vu, ce qu'il a le droit de
 * télécharger, ses appareils — et « Voir en tant que », en pied de fiche.
 * Volet latéral sur ordinateur, feuille basse sur téléphone.
 */
export function UserSheet({ user, isSelf, devices, devicesFailed, now, onClose }: UserSheetProps) {
  const isMobile = useIsMobile();
  const titleId = useId();
  // Le dernier compte ouvert reste affiché pendant que la fiche se referme :
  // sans lui, son contenu disparaîtrait au premier instant du glissement.
  const [shown, setShown] = useState(user);
  if (user && user !== shown) setShown(user);
  const size = isMobile ? Math.round(window.innerHeight * MOBILE_HEIGHT_RATIO) : DESKTOP_WIDTH;

  return (
    <Sheet
      open={user !== null}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      size={size}
      labelledBy={titleId}
      trapFocus
    >
      {shown && (
        <UserSheetBody
          user={shown}
          titleId={titleId}
          isSelf={isSelf}
          devices={devices}
          devicesFailed={devicesFailed}
          now={now}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function UserSheetBody({ user, titleId, isSelf, devices, devicesFailed, now, onClose }: {
  user: AdminUser;
  titleId: string;
  isSelf: boolean;
  devices: PairedDevice[] | undefined;
  devicesFailed: boolean;
  now: number;
  onClose: () => void;
}) {
  const { t } = useTranslation(["admin", "common"]);
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-start gap-4 border-b border-line-subtle px-5 py-5">
        <UserAvatar
          userId={user.id}
          name={user.name}
          hasAvatar={user.hasAvatar}
          imageTag={user.imageTag}
          size={64}
          className={user.isDisabled ? "opacity-50 grayscale" : undefined}
        />
        <div className="min-w-0 flex-1 pt-1">
          <h2 id={titleId} className="truncate text-lg font-semibold text-content-primary">{user.name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <UserBadges user={user} isSelf={isSelf} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common:close")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-content-tertiary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-6 px-5 py-5">
        <UserActivity user={user} now={now} />
        <UserRightsSection userId={user.id} />
        <UserDevicesSection devices={devices} failed={devicesFailed} now={now} />
      </div>

      {/* Collé en bas : l'action qui engage le plus reste à portée, fiche défilée ou non. */}
      <footer className="sticky bottom-0 border-t border-line-subtle bg-[var(--surface-sheet)] px-5 py-4">
        <UserImpersonation user={user} isSelf={isSelf} />
      </footer>
    </div>
  );
}

/**
 * Dernière activité et dernière connexion — la seconde n'existe qu'avec un
 * serveur 1.20.0 ou plus : sur un plus ancien, la ligne ne s'affiche pas
 * plutôt que de dire « Jamais » à tort.
 */
function UserActivity({ user, now }: { user: AdminUser; now: number }) {
  const { t } = useTranslation("admin");
  return (
    <UserSheetSection title={t("userActivityTitle")}>
      <dl className={SHEET_LIST}>
        <ActivityRow label={t("userLastActivity")} iso={user.lastActivityDate} now={now} />
        {user.lastLoginDate !== undefined && (
          <ActivityRow label={t("userLastLogin")} iso={user.lastLoginDate} now={now} />
        )}
      </dl>
    </UserSheetSection>
  );
}

function ActivityRow({ label, iso, now }: { label: string; iso: string | null; now: number }) {
  const { t, i18n } = useTranslation("admin");
  const relative = relativeTime(iso, now, i18n.language);
  const absolute = absoluteTime(iso, i18n.language);
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-content-secondary">{label}</dt>
      <dd className="text-right">
        <span className="block text-sm font-medium text-content-primary first-letter:uppercase">
          {relative ?? t("userNever")}
        </span>
        {absolute && iso && <time dateTime={iso} className="block text-xs text-content-tertiary">{absolute}</time>}
      </dd>
    </div>
  );
}
