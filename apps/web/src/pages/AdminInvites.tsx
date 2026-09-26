import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MailPlus, Plus } from "lucide-react";
import { buildInviteUrl, inviteStatus, type AdminInviteDto } from "@tentacle-tv/shared";
import { cls } from "./adminUtils";
import { PageTransition } from "../components/PageTransition";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../contexts/ToastContext";
import { useAdminInvites, useClock, useDeleteInvite, useInviteLinkBase } from "../hooks/useAdminInvites";
import { InviteCard } from "../components/admin/invites/InviteCard";
import { InviteFilters } from "../components/admin/invites/InviteFilters";
import { NewInviteDialog } from "../components/admin/invites/NewInviteDialog";
import { countByStatus, sortInvites, type InviteFilter } from "../components/admin/invites/inviteFormat";
import { canShareNatively, copyText } from "../components/admin/invites/inviteLink";

/** Autant de colonnes que la largeur en offre : la page occupe tout le panneau. */
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3";

/** Ce que la confirmation annonce : le lien qui cesse de marcher, les comptes qui restent. */
function deleteMessage(invite: AdminInviteDto | null, now: number, t: TFunction): string {
  if (!invite) return "";
  const first = t(inviteStatus(invite, now) === "active" ? "deleteActive" : "deleteInactive");
  if (invite.usages.length === 0) return first;
  const names = invite.usages.slice(0, 5).map((usage) => usage.username).join(", ");
  return `${first} ${t("deleteKeepsAccounts", { names: invite.usages.length > 5 ? `${names}, …` : names })}`;
}

/**
 * Invitations — créer un lien, l'envoyer, voir qui s'en est servi.
 *
 * Remplace la section d'origine : deux champs nombre sans garde-fou (un champ
 * vidé partait en NaN, refusé en silence), une liste repliée par défaut, un
 * lien bâti sur l'origine de l'application — mort sous Electron — et un
 * `window.confirm` que toutes les webviews n'affichent pas.
 */
export function AdminInvites() {
  const { t } = useTranslation(["adminInvites", "common"]);
  const { show: toast } = useToast();
  const reduce = useReducedMotion();
  const now = useClock();
  const query = useAdminInvites();
  const link = useInviteLinkBase();
  const remove = useDeleteInvite();
  const [filter, setFilter] = useState<InviteFilter>("all");
  const [dialog, setDialog] = useState({ open: false, key: 0 });
  // L'invitation reste en place à la fermeture : le texte ne s'efface pas pendant l'animation.
  const [confirm, setConfirm] = useState<{ open: boolean; invite: AdminInviteDto | null }>({ open: false, invite: null });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const createdId = useRef<string | null>(null);
  const canShare = useMemo(canShareNatively, []);

  const invites = query.data;
  const counts = useMemo(() => countByStatus(invites ?? [], now), [invites, now]);
  const visible = useMemo(() => {
    const sorted = sortInvites(invites ?? [], now);
    return filter === "all" ? sorted : sorted.filter((invite) => inviteStatus(invite, now) === filter);
  }, [invites, now, filter]);

  // « Copié » et le halo de la nouvelle invitation s'éteignent d'eux-mêmes.
  useEffect(() => {
    if (!copiedId) return;
    const id = setTimeout(() => setCopiedId(null), 2_000);
    return () => clearTimeout(id);
  }, [copiedId]);
  useEffect(() => {
    if (!highlightId) return;
    const id = setTimeout(() => setHighlightId(null), 2_600);
    return () => clearTimeout(id);
  }, [highlightId]);

  const { base } = link;
  const onCopy = useCallback(async (invite: AdminInviteDto) => {
    if (await copyText(buildInviteUrl(base, invite.key))) setCopiedId(invite.id);
    else toast("error", t("copyFailed"));
  }, [base, toast, t]);
  const onShare = useCallback((invite: AdminInviteDto) => {
    // Un partage annulé rejette la promesse : ce n'est pas une erreur.
    navigator.share({ title: t("shareTitle"), text: t("shareText"), url: buildInviteUrl(base, invite.key) }).catch(() => {});
  }, [base, t]);
  const onDelete = useCallback((invite: AdminInviteDto) => setConfirm({ open: true, invite }), []);

  const openDialog = () => setDialog((current) => ({ open: true, key: current.key + 1 }));
  const closeDialog = () => {
    setDialog((current) => ({ ...current, open: false }));
    // La nouvelle invitation se signale une fois la fenêtre refermée, pas derrière elle.
    if (createdId.current) {
      setFilter("all");
      setHighlightId(createdId.current);
      createdId.current = null;
    }
  };

  const confirmDelete = () => {
    if (!confirm.invite) return;
    remove.mutate(confirm.invite.id, {
      onSuccess: () => toast("success", t("deleted")),
      onError: () => toast("error", t("deleteFailed")),
      onSettled: () => setConfirm((current) => ({ ...current, open: false })),
    });
  };

  const newInviteButton = (
    <button type="button" onClick={openDialog} disabled={!link.ready} className={`${cls.bp} shrink-0 self-start`}>
      <Plus size={16} aria-hidden />
      {t("newInvite")}
    </button>
  );

  let body: ReactNode;
  if (query.isError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-line-subtle bg-fill-faint p-4 xs:flex-row xs:items-center xs:justify-between">
        <p className="text-sm text-content-tertiary">{t("loadError")}</p>
        <button type="button" onClick={() => query.refetch()} className={cls.bs}>{t("retry")}</button>
      </div>
    );
  } else if (!invites || !link.ready) {
    body = (
      <div aria-busy="true" className={GRID}>
        {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton-shimmer h-[188px] rounded-xl" />)}
      </div>
    );
  } else if (invites.length === 0) {
    body = (
      <EmptyState
        icon={<MailPlus size={28} aria-hidden />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={newInviteButton}
      />
    );
  } else {
    body = (
      <>
        <InviteFilters value={filter} counts={counts} onChange={setFilter} />
        {visible.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line-subtle p-8 text-center text-sm text-content-quaternary">
            {t(`emptyFilter_${filter}`)}
          </p>
        ) : (
          <ul className={`relative mt-4 ${GRID}`}>
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((invite) => (
                <motion.li
                  key={invite.id}
                  layout={reduce ? false : "position"}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <InviteCard
                    invite={invite}
                    now={now}
                    copied={copiedId === invite.id}
                    canShare={canShare}
                    highlighted={highlightId === invite.id}
                    onCopy={onCopy}
                    onShare={onShare}
                    onDelete={onDelete}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </>
    );
  }

  return (
    <PageTransition>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-heading-1 text-content-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-content-tertiary">{t("description")}</p>
        </div>
        {/* Liste vide : le bouton est celui de l'état vide, pas deux fois le même. */}
        {invites?.length !== 0 && newInviteButton}
      </header>

      {body}

      <NewInviteDialog
        key={dialog.key}
        open={dialog.open}
        linkBase={base}
        onClose={closeDialog}
        onCreated={(id) => { createdId.current = id; }}
      />
      <ConfirmDialog
        open={confirm.open}
        title={t("deleteTitle")}
        message={deleteMessage(confirm.invite, now, t)}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("common:cancel")}
        danger
        pending={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => { if (!remove.isPending) setConfirm((current) => ({ ...current, open: false })); }}
      />
    </PageTransition>
  );
}
