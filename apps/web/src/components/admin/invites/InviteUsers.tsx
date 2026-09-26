import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { AdminInviteUsageDto } from "@tentacle-tv/shared";
import { LeaderboardAvatar } from "../../easterEggs/LeaderboardAvatar";
import { formatDateTime } from "./inviteFormat";

/** Au-delà, un « +N » qui nomme les autres en infobulle : la carte ne s'allonge pas sans fin. */
const SHOWN = 6;

/**
 * Les comptes ouverts avec une invitation : l'avatar et le nom de chacun, la
 * date d'inscription au survol. Un serveur antérieur à 1.20.0 ne donne pas
 * l'identifiant du compte : l'initiale remplace alors la photo.
 */
export const InviteUsers = memo(function InviteUsers({ usages }: { usages: AdminInviteUsageDto[] }) {
  const { t, i18n } = useTranslation("adminInvites");
  if (usages.length === 0) return null;
  const shown = usages.slice(0, SHOWN);
  const rest = usages.slice(SHOWN);

  return (
    <ul aria-label={t("usedByLabel")} className="flex flex-wrap gap-1.5">
      {shown.map((usage) => (
        <li
          key={`${usage.jellyfinUserId ?? usage.username}-${usage.usedAt}`}
          title={t("usedOn", {
            name: usage.username,
            date: formatDateTime(Date.parse(usage.usedAt), i18n.language),
          })}
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-fill-subtle py-0.5 pl-0.5 pr-2.5 text-xs text-content-secondary"
        >
          <LeaderboardAvatar
            userId={usage.jellyfinUserId ?? ""}
            name={usage.username}
            hasAvatar={Boolean(usage.jellyfinUserId)}
            size={22}
          />
          <span className="truncate">{usage.username}</span>
        </li>
      ))}
      {rest.length > 0 && (
        <li
          title={rest.map((usage) => usage.username).join(", ")}
          className="inline-flex items-center rounded-full bg-fill-subtle px-2.5 py-0.5 text-xs font-semibold tabular-nums text-content-tertiary"
        >
          {t("moreUsers", { count: rest.length })}
        </li>
      )}
    </ul>
  );
});
