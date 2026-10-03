import { useCallback, useMemo, useRef, useState } from "react";
import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import type { MyTitle } from "@tentacle-tv/shared";
import { REQUESTS_CLOSE_GUARDED, requestsPanelBackLayers, requestsRowsFocusable } from "@tentacle-tv/tv-core";
import { FocusBindingProvider, type FocusBinder } from "../../redesign/focus/focusBinding";
import { requestRowKey } from "../../redesign/requests/RequestRow";
import { REQUESTS_CLOSE_KEY, RequestsPanelView } from "../../redesign/requests/RequestsPanelView";
import { withMenuIntent } from "../../platform/tvos/input";
import { useBackLayers } from "../back/BackScope";
import { setFocusLocked } from "../../platform/tvos/focus/focusLocks";
import { useFocusStore, type FocusStore } from "../../platform/tvos/focus/focusStore";
import { STILL_READING, type ArrivalReading } from "./arrivalModels";
import { requestItemModel, requestsCountText } from "./requestModels";

/**
 * La fenêtre « Mes demandes » (Apple TV) : `RequestsPanelView` dans une
 * `Modal`, comme le grand panneau d'une carte.
 *
 * - La `Modal` PIÈGE le focus ; la croix en est la seule action : elle prend
 *   l'entrée (l'élément du haut, que tvOS choisit dans une Modal), sous la
 *   garde anti-clic fantôme — la fenêtre s'ouvre sous un OK encore enfoncé.
 * - LECTURE SEULE : les lignes ne sont focalisables que pour faire défiler une
 *   liste qui dépasse (`requestsRowsFocusable`, tv-core) ; OK n'y fait rien.
 * - EN DIRECT : chaque affiche se colore au fil de son avancement, qui bouge
 *   d'une seconde à l'autre (`reading` : l'heure de la lecture, et si on la
 *   voit) ; une demande arrivée prend toute sa couleur, puis sort.
 * - Menu ferme : la fenêtre est une couche « menu » de la pile du Retour
 *   (`requestsPanelBackLayers`, tv-core), et sa `Modal`, qui reçoit Menu dans son propre
 *   contrôleur, ferme par la même fonction (`onRequestClose`, par l'entrée
 *   unique : `withMenuIntent`) ; la croix
 *   aussi. La sortie se joue (`closing`) avant que la Modal ne se retire, et
 *   tvOS rend le focus à l'aperçu du rail.
 */

export function RequestsPanel({
  titles,
  reading = STILL_READING,
  onClose,
}: {
  titles: MyTitle[] | null;
  reading?: ArrivalReading;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => setClosing(true), []);
  useBackLayers(requestsPanelBackLayers(closing), { close: requestClose });
  const focus = useFocusStore();
  const items = useMemo(() => titles?.map((title) => requestItemModel(title, t, reading)) ?? null, [titles, t, reading]);
  useRowLocks(focus, items ? items.map((item) => requestRowKey(item.key)) : []);
  const bind = useCallback<FocusBinder>(
    (key, form) => {
      const binding = focus.binder(key, form);
      return key === REQUESTS_CLOSE_KEY ? { ...binding, phantomPressGuard: REQUESTS_CLOSE_GUARDED } : binding;
    },
    [focus],
  );
  return (
    <Modal visible transparent animationType="none" onRequestClose={withMenuIntent(requestClose)}>
      <FocusBindingProvider bind={bind}>
        <RequestsPanelView
          title={t("requests:dockLabel")}
          subtitle={requestsCountText(titles, t)}
          items={items}
          emptyText={t("requests:empty")}
          loadingText={t("requests:loading")}
          onClose={requestClose}
          closing={closing}
          onClosed={onClose}
        />
      </FocusBindingProvider>
    </Modal>
  );
}

/**
 * Une liste qui tient se lit sans focus : ses lignes restent infocalisables,
 * verrouillées AVANT leur rendu ; dès qu'elle dépasse, le focus peut y
 * descendre pour la faire défiler.
 */
function useRowLocks(focus: FocusStore, keys: readonly string[]): void {
  const locked = useRef(new Set<string>());
  const wanted = new Set(requestsRowsFocusable(keys.length) ? [] : keys);
  for (const key of [...locked.current]) {
    if (wanted.has(key)) continue;
    setFocusLocked(focus, key, false);
    locked.current.delete(key);
  }
  for (const key of wanted) {
    if (locked.current.has(key)) continue;
    setFocusLocked(focus, key, true);
    locked.current.add(key);
  }
}
