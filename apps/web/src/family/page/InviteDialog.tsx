import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Search } from "lucide-react";
import { useFamilyCandidates, useSendFamilyInvitation } from "@tentacle-tv/api-client";
import { candidateView, type FamilyCandidateDto } from "@tentacle-tv/shared";
import { Modal } from "../../components/ui/Modal";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useToast } from "../../contexts/ToastContext";
import { useFamilyText } from "../useFamilyText";
import { FIELD, SECONDARY_BUTTON, SMALL_BUTTON } from "./familyUi";

/** La saisie se pose avant d'interroger le serveur (borné à 30 lectures par minute). */
const SEARCH_DELAY_MS = 300;

function useSettledValue(value: string, delay: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * Inviter un compte du serveur (le propriétaire seul). Les candidats viennent
 * du SERVEUR (v2) : TOUS les comptes, affichés d'emblée, la saisie affine —
 * jamais un invité, soi-même ni un compte désactivé. Un compte déjà dans une
 * famille (sans dire laquelle) ou qu'une invitation attend est grisé, avec
 * sa raison, et ne s'invite pas (`candidateView`, shared).
 */
export function InviteDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const settled = useSettledValue(query, SEARCH_DELAY_MS);
  const candidates = useFamilyCandidates(settled);
  const invite = useSendFamilyInvitation();
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const searchId = useId();
  const hintId = useId();

  const send = (candidate: FamilyCandidateDto) => {
    setError(null);
    invite.mutate(candidate.userId, {
      onSuccess: () => {
        setSent((previous) => new Set(previous).add(candidate.userId));
        toast.show("success", t("invite.sent", { name: candidate.name }));
      },
      onError: (failure) => setError(errorText(failure)),
    });
  };

  const list = candidates.data ?? [];
  const searching = candidates.isFetching || settled !== query;

  return (
    <Modal open onClose={onClose} maxWidth={480} labelledBy={titleId}>
      <div className="flex max-h-[min(640px,85vh)] flex-col p-6">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("invite.title")}</h2>
        <label htmlFor={searchId} className="sr-only">{t("invite.searchLabel")}</label>
        <div className="relative mt-4">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-quaternary" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("invite.searchPlaceholder")}
            autoComplete="off"
            aria-describedby={hintId}
            className={`${FIELD} pl-9`}
          />
        </div>
        <p id={hintId} className="mt-2 text-xs leading-relaxed text-content-tertiary">{t("candidates.hint")}</p>

        <div className="mt-4 min-h-[120px] flex-1 overflow-y-auto rounded-xl border border-line-subtle bg-surface-1" aria-busy={searching}>
          {candidates.isError ? (
            <p className="px-4 py-6 text-center text-sm text-status-error-fg">{t("invite.loadError")}</p>
          ) : list.length === 0 && !searching ? (
            <p className="px-4 py-6 text-center text-sm text-content-tertiary">
              {settled.trim() ? t("invite.noMatch", { query: settled.trim() }) : t("invite.empty")}
            </p>
          ) : (
            <ul>
              {list.map((candidate, index) => {
                const done = sent.has(candidate.userId);
                const view = candidateView(candidate);
                return (
                  <li
                    key={candidate.userId}
                    className={`flex items-center gap-3 px-4 py-2.5 ${index === list.length - 1 ? "" : "border-b border-line-subtle"}`}
                  >
                    <span className={`flex-shrink-0 ${view.invitable ? "" : "opacity-50"}`}>
                      <UserAvatar userId={candidate.userId} name={candidate.name} hasAvatar={candidate.imageTag !== null} imageTag={candidate.imageTag} size={32} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${view.invitable ? "text-content-primary" : "text-content-tertiary"}`}>
                        {candidate.name}
                      </span>
                      {view.noteKey && <span className="block text-xs text-content-quaternary">{t(view.noteKey)}</span>}
                    </span>
                    {view.invitable && (
                      <button
                        type="button"
                        onClick={() => send(candidate)}
                        disabled={done || invite.isPending}
                        aria-label={`${t("invite.send")} — ${candidate.name}`}
                        className={SMALL_BUTTON}
                      >
                        {done ? <Check size={14} aria-hidden="true" /> : null}
                        {t("invite.send")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-status-error-fg">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>{t("close")}</button>
        </div>
      </div>
    </Modal>
  );
}
