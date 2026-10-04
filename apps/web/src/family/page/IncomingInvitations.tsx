import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { SettingsSection } from "@tentacle-tv/ui";
import type { IncomingInvitationDto } from "@tentacle-tv/shared";
import { requestFamilyPoster } from "../familyPosterStore";
import { useFamilyText } from "../useFamilyText";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE } from "./familyUi";

/** Les invitations reçues : « Répondre » rouvre l'AFFICHE (même remise à plus
 *  tard) — une seule façon de répondre, qui dit ce qu'accepter implique. */
export function IncomingInvitationsSection({ incoming }: { incoming: IncomingInvitationDto[] }) {
  const { t } = useTranslation("familyWeb");
  const { formatDate } = useFamilyText();
  if (incoming.length === 0) return null;
  return (
    <SettingsSection title={t("incoming.title")}>
      <ul>
        {incoming.map((invitation, index) => (
          <li
            key={invitation.id}
            className={`flex flex-wrap items-center gap-3 px-4 py-3 ${index === incoming.length - 1 ? "" : "border-b border-line-subtle"}`}
          >
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(var(--brand-rgb),0.14)] text-[var(--brand-light)]">
              <Mail size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-content-primary">{t("incoming.row", { owner: invitation.ownerName })}</p>
              <p className="mt-0.5 text-xs text-content-tertiary">{t("incoming.expires", { date: formatDate(invitation.expiresAt) })}</p>
            </div>
            <button type="button" onClick={() => requestFamilyPoster(invitation.id)} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>
              {t("incoming.open")}
            </button>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
