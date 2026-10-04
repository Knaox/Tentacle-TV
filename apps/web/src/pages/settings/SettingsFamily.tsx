import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Shimmer } from "@tentacle-tv/ui";
import { useFamilyOverview } from "@tentacle-tv/api-client";
import type { FamilyOverviewDto } from "@tentacle-tv/shared";
import { PageTransition } from "../../components/PageTransition";
import { useFamilyAvailability } from "../../family/useFamilyAvailability";
import { useFamilyText } from "../../family/useFamilyText";
import { DissolveSection, MyPinSection } from "../../family/page/AccountSections";
import { IncomingInvitationsSection, MembershipsSection } from "../../family/page/MembershipSections";
import { OwnedFamilySection } from "../../family/page/OwnedFamilySection";
import { SECONDARY_BUTTON } from "../../family/page/familyUi";

/**
 * Réglages › Famille — le même écran au bureau (section de la coquille) et
 * dans le miroir (volet du profil). Dans l'ordre : ce qui attend une réponse
 * (invitations reçues), ma famille, celles dont je suis membre, mon code
 * PIN, puis la dissolution, à part.
 *
 * Tout vient de `GET /api/family`, relu en direct par `family:update` (monté
 * par l'hôte de l'affiche) : une réponse arrivée d'un autre appareil remplit
 * la page sans rechargement. Sans la Famille (serveur d'avant, hors ligne),
 * la page n'existe pas.
 */
export function SettingsFamily() {
  const { available, settled } = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: available });

  if ((settled && !available) || overview.data === null) return <Navigate to="/settings" replace />;

  return (
    <PageTransition>
      <div className="max-w-2xl">
        {overview.data ? (
          <FamilyContent overview={overview.data} />
        ) : overview.isError ? (
          <LoadError error={overview.error} onRetry={() => void overview.refetch()} />
        ) : (
          <FamilySkeleton />
        )}
      </div>
    </PageTransition>
  );
}

function FamilyContent({ overview }: { overview: FamilyOverviewDto }) {
  const { t } = useTranslation("familyWeb");
  const { account, switches } = overview;
  const personal = account.personalSession;
  const notices = [
    !personal && t("notice.personalOnly"),
    personal && !switches.families && t("notice.disabled"),
    personal && switches.families && !switches.guests && t("notice.guestsDisabled"),
  ].filter((notice): notice is string => typeof notice === "string");

  return (
    <>
      <p className="mb-5 text-sm leading-relaxed text-content-tertiary">{t("description")}</p>
      {notices.map((notice) => (
        <p key={notice} className="mb-4 flex gap-2 rounded-lg border border-line-subtle bg-fill-subtle px-3 py-2.5 text-sm text-content-secondary">
          <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-content-tertiary" />
          {notice}
        </p>
      ))}
      {personal && <IncomingInvitationsSection incoming={overview.incoming} />}
      <OwnedFamilySection overview={overview} />
      <MembershipsSection memberships={overview.memberships} canLeave={personal} />
      {personal && (account.canJoin || overview.owned !== null) && <MyPinSection hasPin={account.hasPin} />}
      {personal && overview.owned && <DissolveSection />}
    </>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  return (
    <div className="rounded-xl border border-line-subtle bg-surface-1 p-5">
      <p className="text-sm font-semibold text-content-primary">{t("loadError")}</p>
      <p className="mt-1 text-sm text-content-tertiary">{errorText(error)}</p>
      <button type="button" onClick={onRetry} className={`${SECONDARY_BUTTON} mt-4`}>{t("retry")}</button>
    </div>
  );
}

/** La place des sections, le temps de la première lecture : rien ne saute à l'arrivée. */
function FamilySkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <Shimmer width="75%" height="16px" />
      <Shimmer height="160px" />
      <Shimmer height="64px" />
    </div>
  );
}
