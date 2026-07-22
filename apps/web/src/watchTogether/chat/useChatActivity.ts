import { useMemo } from "react";
import { markChatActivity, wakePlayerControls } from "./chatUiStore";

/**
 * Impulsions d'activité du chat vers le lecteur (chatUiStore). Le chat vit
 * dans un portail HORS du conteneur vidéo (document.body en fenêtré) : ses
 * événements ne réarment jamais le timer d'inactivité du lecteur — chaque
 * interaction est donc publiée en impulsion horodatée qui expire seule
 * (CHAT_ACTIVITY_MS). AUCUN état collant : historiquement, focusWithin /
 * inputFocused restaient vrais après l'envoi d'un message (l'input garde le
 * focus, submit ne blur pas) et l'overlay ne se masquait plus jamais.
 */
export interface ChatActivity {
  /** À étaler sur le(s) conteneur(s) racine de l'overlay (panneau ET bulle). */
  handlers: {
    onPointerEnter: () => void;
    onPointerMove: () => void;
    onPointerDownCapture: () => void;
    onWheelCapture: () => void;
    onFocusCapture: () => void;
    onKeyDownCapture: () => void;
  };
}

export function useChatActivity(): ChatActivity {
  return useMemo(() => ({
    handlers: {
      onPointerEnter: markChatActivity,
      onPointerMove: markChatActivity,
      onPointerDownCapture: markChatActivity,
      onWheelCapture: markChatActivity,
      onFocusCapture: markChatActivity,
      // Frappe : impulsion + réveil — l'overlay a pu se cacher pendant que le
      // focus restait dans l'input ; taper doit tout re-afficher.
      onKeyDownCapture: () => {
        markChatActivity();
        wakePlayerControls();
      },
    },
  }), []);
}
