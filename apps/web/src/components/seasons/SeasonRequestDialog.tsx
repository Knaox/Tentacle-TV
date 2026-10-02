import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { useRequestTitleSeasons, useSeasons, useTitleSeasons } from "@tentacle-tv/api-client";
import { librarySeasonNumbers, seasonPick } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { Modal } from "../ui/Modal";
import { ModalHeader } from "../ui/ModalHeader";
import { useTitleProvider } from "../cards/external/useTitleProvider";
import type { SeasonRequestTarget } from "./SeasonRequestProvider";
import { SeasonRows } from "./SeasonRows";

/**
 * La feuille des saisons à demander d'une série de la bibliothèque (bureau,
 * web) : une ligne par saison, dans l'ordre de l'extension (`titles.seasons`,
 * modèle `seasonPick`) — celles qu'on a disent « Dans la bibliothèque »,
 * celles déjà demandées leur état, les autres se cochent. « Demander N
 * saisons » au dégradé de la marque ; la réponse de l'extension se dit en
 * toast, un refus sur place.
 *
 * Le clavier entre sur la première saison à cocher, une fois les saisons
 * lues ; Échap et « Annuler » referment (`Modal`).
 */

export function SeasonRequestDialog({ target, open, onClose }: {
  target: SeasonRequestTarget;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("requests");
  const toast = useToast();
  const navigate = useNavigate();
  const titleId = useId();
  const { provider, lang } = useTitleProvider();
  const { answer, failed } = useTitleSeasons(provider, target.key, lang);
  // Ce que la bibliothèque a : attendu avant de proposer quoi que ce soit à cocher.
  const library = useSeasons(target.seriesId);
  const owned = useMemo(() => librarySeasonNumbers(library.data ?? []), [library.data]);
  const known = library.data !== undefined || library.isError;
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set());
  const pick = useMemo(
    () => seasonPick(t, known ? answer : null, failed, checked, owned),
    [t, known, answer, failed, checked, owned],
  );
  const request = useRequestTitleSeasons(provider, lang);
  const [refusal, setRefusal] = useState<string | null>(null);

  const onToggle = useCallback((number: number) => {
    setRefusal(null);
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  }, []);

  // L'entrée du clavier : la première saison à cocher, dès qu'elle paraît —
  // après l'entrée par défaut de la modale (sa croix, à 50 ms), et seulement
  // si l'on n'est pas déjà sur une case.
  const firstRef = useRef<HTMLInputElement | null>(null);
  const entered = useRef(false);
  const hasRows = pick.rows !== null && pick.requestable.length > 0;
  useEffect(() => {
    if (!open || !hasRows || entered.current) return;
    const id = setTimeout(() => {
      entered.current = true;
      if (!(document.activeElement instanceof HTMLInputElement)) firstRef.current?.focus();
    }, 80);
    return () => clearTimeout(id);
  }, [open, hasRows]);

  const submit = () => {
    if (pick.chosen.length === 0 || request.isPending) return;
    setRefusal(null);
    request.mutate({ key: target.key, seasons: pick.chosen }, {
      onSuccess: (outcome) => {
        if (outcome.kind === "open") {
          // Un choix que seule la page de l'extension sait faire.
          onClose();
          navigate(outcome.href);
          return;
        }
        if (!outcome.ok) {
          setRefusal(outcome.message ?? t("cards:requestFailed"));
          return;
        }
        toast.show("success", outcome.message ?? t("cards:requestSent"));
        onClose();
      },
      onError: () => setRefusal(t("cards:requestFailed")),
    });
  };

  const sending = request.isPending;
  const disabled = pick.chosen.length === 0 || sending;
  return (
    <Modal open={open} onClose={onClose} maxWidth={460} labelledBy={titleId}>
      <ModalHeader title={target.name} subtitle={t("seasonsSubtitle")} onClose={onClose} titleId={titleId} />
      <div className="max-h-[min(52vh,460px)] overflow-y-auto overscroll-contain px-3 py-3">
        {pick.message && (
          <p role="status" className="px-3 py-2 text-sm leading-relaxed text-content-tertiary">{pick.message}</p>
        )}
        {pick.rows && pick.rows.length > 0 && <SeasonRows rows={pick.rows} onToggle={onToggle} firstRef={firstRef} />}
      </div>
      <div className="flex flex-col gap-3 px-6 pb-5 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        {refusal && <p role="alert" className="text-sm text-[var(--status-error-fg)]">{refusal}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-full border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary transition hover:bg-fill-medium"
          >
            {t("common:cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            aria-busy={sending || undefined}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] px-5 text-sm font-bold text-cta-brand-fg shadow-[0_2px_10px_rgba(var(--brand-rgb),0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
            {pick.submitLabel ?? t("seasonsSubmitIdle")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
