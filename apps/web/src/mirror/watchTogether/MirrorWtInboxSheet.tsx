import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WtInviteDto } from "@tentacle-tv/shared";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { PrimaryCta, SecondaryCta } from "../screens/misc/shared/PrimaryCta";

/**
 * Les invitations REÇUES du web étroit — `WtInviteInboxSheet` du mobile :
 * « X vous invite à regarder Y », « Refuser » / « Accepter », et « Plus
 * tard » qui referme sans répondre. La dernière honorée referme la feuille.
 */
export function MirrorWtInboxSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("watchTogether");
  const { invites, actions } = useWatchTogether();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const respond = (inviteId: string, accept: boolean) => {
    setBusy(inviteId);
    setFailed(false);
    actions.respond(inviteId, accept).then(
      () => { setBusy(null); if (invites.length <= 1) onClose(); },
      () => { setBusy(null); setFailed(true); },
    );
  };

  return (
    <div className="flex flex-col gap-3 px-5 pb-6">
      <h2 className="mb-1 text-[22px] font-extrabold text-content-primary">{t("invitations")}</h2>
      {invites.map((invite) => <InviteCard key={invite.inviteId} invite={invite} busy={busy === invite.inviteId} onRespond={respond} />)}
      {failed && <p role="status" className="text-center text-[13px] text-[var(--status-error)]">{t("errorGeneric")}</p>}
      <button type="button" onClick={onClose} className="min-h-11 text-[15px] font-semibold text-content-secondary">{t("later")}</button>
    </div>
  );
}

const InviteCard = memo(function InviteCard({ invite, busy, onRespond }: {
  invite: WtInviteDto;
  busy: boolean;
  onRespond: (inviteId: string, accept: boolean) => void;
}) {
  const { t } = useTranslation("watchTogether");
  const text = invite.itemName
    ? t("invitedByWithItem", { name: invite.fromUsername, title: invite.itemName })
    : t("invitedBy", { name: invite.fromUsername });
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-fill-subtle p-4">
      <p className="text-[16px] font-medium leading-[22px] text-content-primary">{text}</p>
      <div className="flex gap-2.5">
        <SecondaryCta onPress={() => onRespond(invite.inviteId, false)} disabled={busy}>{t("decline")}</SecondaryCta>
        <PrimaryCta onPress={() => onRespond(invite.inviteId, true)} disabled={busy} loading={busy}>{t("accept")}</PrimaryCta>
      </div>
    </div>
  );
});
