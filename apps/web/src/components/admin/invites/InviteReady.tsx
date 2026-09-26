import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check, Copy, Share2 } from "lucide-react";
import { buildInviteUrl, type CreatedInviteDto } from "@tentacle-tv/shared";
import { cls } from "../../../pages/adminUtils";
import { useToast } from "../../../contexts/ToastContext";
import { ModalHeader } from "../../ui/ModalHeader";
import { AdminNotice } from "../kit";
import { canShareNatively, copyText, isLocalOnlyUrl } from "./inviteLink";
import { formatDeadline } from "./inviteFormat";

interface InviteReadyProps {
  invite: CreatedInviteDto;
  /** L'origine publique des liens (`useInviteLinkBase`). */
  linkBase: string;
  titleId: string;
  onDone: () => void;
}

/**
 * L'invitation est créée : son lien, à copier ou à partager sans quitter la
 * fenêtre — c'est la seule chose qu'on vient chercher. Un lien qui ne sortira
 * pas du réseau local est signalé avant d'être envoyé.
 */
export function InviteReady({ invite, linkBase, titleId, onDone }: InviteReadyProps) {
  const { t, i18n } = useTranslation("adminInvites");
  const toast = useToast();
  const fieldId = useId();
  const [copied, setCopied] = useState(false);
  const url = buildInviteUrl(linkBase, invite.key);
  const localOnly = isLocalOnlyUrl(url);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    if (await copyText(url)) setCopied(true);
    else toast.show("error", t("copyFailed"));
  };
  const share = () => {
    // Un partage annulé rejette la promesse : ce n'est pas une erreur.
    navigator.share({ title: t("shareTitle"), text: t("shareText"), url }).catch(() => {});
  };

  return (
    <>
      <ModalHeader title={t("readyTitle")} subtitle={t("readySubtitle")} onClose={onDone} titleId={titleId} />
      <div className="space-y-4 px-6 pb-6 pt-5">
        <div>
          <label htmlFor={fieldId} className={cls.lbl}>{t("linkLabel")}</label>
          <div className="flex flex-col gap-2 xs:flex-row">
            <input
              id={fieldId}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className={`${cls.inp} min-w-0 flex-1 font-mono text-[13px]`}
            />
            <button type="button" autoFocus onClick={copy} className={`${cls.bp} shrink-0`}>
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              <span aria-live="polite">{copied ? t("copied") : t("copyLink")}</span>
            </button>
          </div>
        </div>

        {invite.expiresAt && (
          <p className="text-sm text-content-tertiary">
            {t("summary", {
              people: t("people", { count: invite.maxUses }),
              date: formatDeadline(Date.parse(invite.expiresAt), i18n.language),
            })}
          </p>
        )}

        {localOnly && (
          <AdminNotice
            tone="warning"
            action={
              <Link
                to="/admin/services#publicurl"
                onClick={onDone}
                className="font-semibold text-status-warning-fg underline-offset-2 hover:underline"
              >
                {t("localLinkAction")}
              </Link>
            }
          >
            {t("localLinkWarning")}
          </AdminNotice>
        )}

        <div className="flex flex-col-reverse gap-2 xs:flex-row xs:justify-end">
          {canShareNatively() && (
            <button type="button" onClick={share} className={cls.bs}>
              <Share2 size={16} aria-hidden />
              {t("share")}
            </button>
          )}
          <button type="button" onClick={onDone} className={cls.bs}>{t("done")}</button>
        </div>
      </div>
    </>
  );
}
