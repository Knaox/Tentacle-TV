import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Shimmer } from "@tentacle-tv/ui";
import { familyErrorFromApi, useFamilyOverview } from "@tentacle-tv/api-client";
import { answerableInvitations, familyEntryShown, familyGrowth, sessionManages, type FamilyOverviewDto } from "@tentacle-tv/shared";
import { PageTransition } from "../../components/PageTransition";
import { useFamilySettingsAvailability } from "../../family/useFamilyAvailability";
import { useFamilyText } from "../../family/useFamilyText";
import { DissolveSection, MyPinSection } from "../../family/page/AccountSections";
import { FamilySection } from "../../family/page/FamilySection";
import { ManageUnlockCard } from "../../family/page/ManageUnlockCard";
import { IncomingInvitationsSection } from "../../family/page/IncomingInvitations";
import { LeaveSection } from "../../family/page/LeaveSection";
import { FamilyPinCard } from "../../family/pinSuggest/FamilyPinCard";
import { SECONDARY_BUTTON } from "../../family/page/familyUi";
import { AskAtLaunchSection } from "../../profiles/settings/AskAtLaunchSection";

/**
 * Réglages › Famille — le même écran au bureau (section de la coquille) et
 * dans le miroir (volet du profil). Dans l'ordre : ce qui attend une réponse
 * (invitations reçues, tant qu'on n'a pas de famille), LA famille — la même
 * pour son propriétaire et ses membres —, mon code PIN, puis, à part, la
 * dissolution (propriétaire) ou « Quitter la famille » (membre).
 *
 * Tout vient de `GET /api/family`, relu en direct par `family:update` (monté
 * par l'hôte de l'affiche) : une réponse arrivée d'un autre appareil remplit
 * la page sans rechargement. Sans la Famille (serveur d'avant, hors ligne),
 * la page n'existe pas.
 *
 * Bureau, session d'un PROFIL qui gère (1.30.0, `family.profileManage`) : la
 * même page, avec les droits de ce profil et sans les gestes personnels ; la
 * gestion fermée demande SON code (`ManageUnlockCard`), un profil sans code
 * apprend qu'il lui en faut un.
 *
 * Octave rend CETTE page dans sa coquille (« Gérer les profils »,
 * `/octave/profiles`) : `exitTo` est alors l'endroit où l'on retombe quand la
 * page n'a rien à montrer — jamais une page de Tentacle depuis Octave.
 */
export function SettingsFamily({ exitTo = "/settings" }: { exitTo?: string } = {}) {
  const { t } = useTranslation("familyWeb");
  const { t: tf } = useTranslation("family");
  const { available, settled } = useFamilySettingsAvailability();
  const overview = useFamilyOverview({ enabled: available });
  const refusal = overview.isError ? familyErrorFromApi(overview.error)?.code : undefined;

  // Rien à y faire (pas de famille, aucune invitation, la fonder refusé par l'administration) : la page n'existe pas.
  if ((settled && !available) || familyEntryShown(overview.data, Date.now()) === false) return <Navigate to={exitTo} replace />;

  return (
    <PageTransition>
      <div className="max-w-2xl">
        {overview.data ? (
          <FamilyContent overview={overview.data} />
        ) : refusal === "family.personal_session_required" ? (
          // « Voir en tant que » : la Famille n'est pas lisible, et c'est voulu.
          <Notice text={t("notice.personalOnly")} />
        ) : refusal === "family.manage_locked" ? (
          <ManageUnlockCard />
        ) : refusal === "family.manage_pin_required" ? (
          <Notice text={tf("errors.manage_pin_required")} />
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
  const { account, switches, family } = overview;
  const personal = account.personalSession;
  // Un profil qui gère (1.30.0) : les gestes de son rôle, jamais les gestes personnels.
  const manages = sessionManages(account);
  // Ce que l'administration refuse n'existe pas ici : sans famille ni geste permis, pas d'appel à la créer.
  const growth = familyGrowth(overview);
  const notices = [
    !manages && t("notice.personalOnly"),
    account.managing === true && t("notice.profileManage"),
    manages && !switches.families && t("notice.disabled"),
    manages && switches.families && !switches.guests && t("notice.guestsDisabled"),
  ].filter((notice): notice is string => typeof notice === "string");

  return (
    <>
      <p className="mb-5 text-sm leading-relaxed text-content-tertiary">{t("description")}</p>
      <FamilyPinCard />
      {notices.map((notice) => (
        <Notice key={notice} text={notice} />
      ))}
      {personal && !family && <IncomingInvitationsSection incoming={answerableInvitations(overview)} />}
      {(family !== null || growth.invite || growth.addGuest) && <FamilySection overview={overview} />}
      {/* Bureau : « Qui regarde ? » à l'ouverture, pour tous ses ordinateurs (famille de deux profils et plus). */}
      {personal && family !== null && <AskAtLaunchSection />}
      {personal && (account.canJoin || family !== null) && <MyPinSection hasPin={account.hasPin} />}
      {personal && family?.role === "owner" && <DissolveSection />}
      {personal && family?.role === "member" && <LeaveSection familyId={family.id} ownerName={family.owner.name} />}
    </>
  );
}

/** Un encart d'information : ce qui change ce que la page permet, et pourquoi. */
function Notice({ text }: { text: string }) {
  return (
    <p className="mb-4 flex gap-2 rounded-lg border border-line-subtle bg-fill-subtle px-3 py-2.5 text-sm text-content-secondary">
      <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-content-tertiary" />
      {text}
    </p>
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
