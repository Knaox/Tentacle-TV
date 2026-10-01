import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { loadTitleState, tentacleApiFetch, titleStateQueryKey, useMyTitles } from "@tentacle-tv/api-client";
import type { TitleState } from "@tentacle-tv/shared";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { ActionSheetView, type SheetActionKind, type SheetActionModel } from "../../redesign/screens/sheet/ActionSheetView";
import { tvPosterUri } from "../cards/absentCards";
import { useFocusStore } from "../focus/focusStore";
import { sheetEntryOf, useSheetFocus } from "../sheet/sheetFocus";
import { absentOf } from "./absentStates";
import type { AbsentTitle } from "./absentTitle";
import type { VigieGate } from "./useVigieGate";

/**
 * Le grand panneau d'un titre ABSENT (appui maintenu, garde Vigie ouverte) :
 * le panneau des cartes (`ActionSheetView`), sans investissement de plus —
 * l'affiche, le titre, l'année et où il en est, puis « Demander » quand
 * l'extension l'offre et que le compte ne l'a pas déjà fait. Pas de note : un
 * titre absent n'a pas de fiche à noter ici.
 *
 * Il ne se présente qu'une fois l'état du titre SU (le plus souvent déjà là :
 * la carte l'a lu pour son badge) — dans une `Modal`, rien ne déplace plus le
 * focus après coup ; un filet le présente quand même. Menu ou la croix
 * ferment ; « Demander » referme et fait le geste d'OK (`onRequest`).
 */

const ENTRY_WAIT_MS = 900;
const fetcher = (url: string) => tentacleApiFetch(url);

interface Props {
  gate: VigieGate;
  title: AbsentTitle;
  onRequest: (title: AbsentTitle) => void;
  onClose: () => void;
}

export function AbsentSheetRedesign({ gate, title, onRequest, onClose }: Props) {
  const { t } = useTranslation();
  const { provider, lang } = gate;
  const { titles: mine } = useMyTitles(provider, lang);
  const query = useQuery({
    queryKey: titleStateQueryKey(provider, lang, title.key),
    queryFn: () => loadTitleState(provider, title.key, lang, fetcher),
    staleTime: 60_000,
    retry: 1,
  });
  const state = (query.data ?? null) as TitleState | null;
  const own = mine?.find((m) => m.key === title.key);

  const header = useMemo(() => {
    const status = absentOf(t, own, state).label;
    return {
      shape: "poster" as const,
      title: title.title,
      subtitle: [title.year ? String(title.year) : null, status].filter(Boolean).join(" · "),
      imageUri: tvPosterUri(title.imageUrl),
    };
  }, [t, own, state, title]);

  const offer = own ? null : state?.request ?? null;
  const actions = useMemo<SheetActionModel[]>(
    () => (offer ? [{ kind: "request", label: offer.label }] : []),
    [offer],
  );

  // Fermer, c'est d'abord jouer la sortie ; `onClose` ne part qu'à sa fin.
  const [closing, setClosing] = useState(false);
  const after = useRef<(() => void) | null>(null);
  const requestClose = useCallback(() => setClosing(true), []);
  const closed = useCallback(() => {
    onClose();
    after.current?.();
  }, [onClose]);
  const onAction = useCallback((kind: SheetActionKind) => {
    if (kind !== "request") return;
    after.current = () => onRequest(title);
    setClosing(true);
  }, [onRequest, title]);

  const focus = useFocusStore();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), ENTRY_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const known = query.isFetched || query.isError;
  const entry = useRef<string | null>(null);
  if (entry.current === null && (known || waited)) entry.current = sheetEntryOf(null, actions);
  const bind = useSheetFocus(focus, { rating: null, actions, entry: entry.current });

  return (
    <Modal visible={entry.current !== null} transparent animationType="none" onRequestClose={requestClose}>
      <FocusBindingProvider bind={bind}>
        <ActionSheetView header={header} actions={actions} rating={null} onAction={onAction} onClose={requestClose} closing={closing} onClosed={closed} />
      </FocusBindingProvider>
    </Modal>
  );
}
