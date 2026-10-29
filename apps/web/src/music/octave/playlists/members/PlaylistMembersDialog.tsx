/**
 * Octave — la feuille des PERSONNES d'une playlist partagée entre comptes (capacité `music.playlistMembers`).
 * Le propriétaire y donne la playlist à un compte du serveur avec un droit (Lire · Lire et ajouter · Lire,
 * ajouter et retirer), le change, le retire ; un membre y voit qui y a accès et peut la QUITTER. Le serveur
 * décide de tout : la feuille ne montre que ce qu'il rend.
 */

import { useId, useState } from "react";
import { LogOut, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMusicPlaylistMembers, useMusicShareCandidates } from "@tentacle-tv/api-client";
import type { MusicPlaylist, MusicPlaylistMemberRight } from "@tentacle-tv/shared/music";
import { Modal } from "../../../../components/ui/Modal";
import { GlassButton } from "../../../../components/ui/glass/GlassButton";
import { requestPlaylistManage } from "../playlistManageStore";
import { MemberRow, PersonRow, RightSelect } from "./MemberRows";

export function PlaylistMembersDialog({ playlist, onClose }: { playlist: MusicPlaylist; onClose: () => void }) {
  const { t } = useTranslation("musicPlaylistMembers");
  const titleId = useId();
  const members = useMusicPlaylistMembers(playlist.jellyfinId);
  const sharing = members.sharing;
  const owner = sharing?.role === "owner";
  const candidates = useMusicShareCandidates(owner);
  const [newRight, setNewRight] = useState<MusicPlaylistMemberRight>("add");
  const taken = new Set(sharing?.members.map((m) => m.userId) ?? []);
  const free = (candidates.candidates ?? []).filter((c) => !taken.has(c.userId));
  const busy = members.busy !== null;

  return (
    <Modal open onClose={onClose} maxWidth={520} labelledBy={titleId}>
      <div className="flex max-h-[80vh] flex-col p-6">
        <div className="flex items-center gap-3">
          <span className="octave-brand-fill flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <Users className="h-5 w-5" />
          </span>
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
            {owner ? t("title", { name: playlist.name }) : t("peopleTitle", { name: playlist.name })}
          </h2>
        </div>
        {owner && <p className="mt-3 text-sm leading-relaxed text-content-secondary">{t("intro")}</p>}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {members.loading && <p className="py-4 text-sm text-content-tertiary">{t("loading")}</p>}
          {members.unreadable && <p className="py-4 text-sm text-content-tertiary">{t("unavailable")}</p>}
          {sharing && (
            <>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-content-tertiary">{t("members")}</h3>
              <ul className="divide-y divide-line-subtle">
                {!owner && <PersonRow person={sharing.owner} caption={t("owner")} />}
                {sharing.members.map((m) =>
                  owner ? (
                    <MemberRow key={m.userId} member={m} disabled={busy} onRight={(r) => void members.setRight(m.userId, r)} onRemove={() => void members.remove(m.userId)} />
                  ) : (
                    <PersonRow key={m.userId} person={m} caption={t(`rights.${m.right}`)} />
                  ),
                )}
              </ul>
              {owner && sharing.members.length === 0 && <p className="py-3 text-sm text-content-tertiary">{t("empty")}</p>}
            </>
          )}

          {owner && (
            <section className="mt-5" aria-labelledby={`${titleId}-add`}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 id={`${titleId}-add`} className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{t("addTitle")}</h3>
                <RightSelect value={newRight} onChange={setNewRight} label={t("addAs")} disabled={busy} />
              </div>
              {candidates.loading && <p className="py-3 text-sm text-content-tertiary">{t("loading")}</p>}
              {candidates.candidates && free.length === 0 && <p className="py-3 text-sm text-content-tertiary">{t("noCandidates")}</p>}
              <ul className="divide-y divide-line-subtle">
                {free.map((person) => (
                  <PersonRow key={person.userId} person={person} action={{ label: t("addPerson", { name: person.name }), disabled: busy, onPress: () => void members.add(person.userId, newRight) }} />
                ))}
              </ul>
            </section>
          )}
        </div>

        {members.failed && <p role="alert" className="mt-3 text-[13px] text-status-error-fg">{t("failed")}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {sharing?.role === "member" && (
            <GlassButton
              inSurface
              onClick={() => requestPlaylistManage({ kind: "leave", playlist })}
              appearance={{ level: "regular", shape: "capsule" }}
              className="mr-auto inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-semibold text-status-error-fg"
              fallbackClassName="rounded-lg border border-line-subtle bg-fill-soft transition hover:bg-fill-medium"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t("leave")}
            </GlassButton>
          )}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="octave-brand-fill inline-flex h-11 cursor-pointer items-center justify-center rounded-full px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
