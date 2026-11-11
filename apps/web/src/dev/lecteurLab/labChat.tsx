import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMotionValue } from "framer-motion";
import type { WtChatApi, WtChatState } from "@tentacle-tv/api-client";
import type { WtChatMessageDto } from "@tentacle-tv/shared";
import { ChatOverlay } from "../../watchTogether/chat/ChatOverlay";
import { MessageToastLayer } from "../../watchTogether/chat/MessageToastLayer";
import { ReactionLayer } from "../../watchTogether/chat/ReactionLayer";
import { LAB_USER_ID, labParam } from "./labFixtures";

/**
 * Le chat de Watch Together, VIVANT, pour le labo (`/dev/lecteur?vue=wt&etat=chat-vif` sur le
 * lecteur, `etat=chat-page` sur une page) : un faux fil qu'on peut nourrir — écrire envoie
 * vraiment dans le fil, et un banc (CDP) fait arriver des messages, des frappes et des
 * réactions par `window.__labChat`. `?donnees=pire` charge le pire cas (noms et messages
 * extrêmes, long fil, non-lus) : le bouton « Données » de l'en-tête bascule entre les deux.
 *
 * Rien d'ici ne parle au serveur : la séance réelle s'éprouve à deux comptes.
 */

const now = Date.now();
const msg = (id: string, userId: string, username: string, text: string, secondsAgo: number): WtChatMessageDto => ({
  id, userId, username, text, at: now - secondsAgo * 1000,
});

const DEMO: WtChatMessageDto[] = [
  msg("d1", "lab-lea", "Léa", "Prête ! On lance quand vous voulez.", 400),
  msg("d2", LAB_USER_ID, "Knaoxtest", "C'est parti. Marc, tu charges encore ?", 340),
  msg("d3", "lab-marc", "Marc", "Deux secondes, ma connexion fait des siennes…", 300),
  msg("d4", "lab-marc", "Marc", "Voilà, c'est bon.", 290),
  msg("d5", "lab-lea", "Léa", "Le lama est incroyable 😂", 60),
  msg("d6", "lab-lea", "Léa", "😂", 55),
];

const LONG_NAME = "Maximilien-Alexandre de la Rochefoucauld-Montmorency";
const URL_TEXT = `https://exemple.test/${"segment-sans-espace-".repeat(14)}fin?x=1`;
const WORST: WtChatMessageDto[] = [
  ...Array.from({ length: 40 }, (_, i) => msg(`w${i}`, i % 3 === 0 ? LAB_USER_ID : i % 3 === 1 ? "lab-long" : "lab-jp", i % 3 === 0 ? "Knaoxtest" : i % 3 === 1 ? LONG_NAME : "山田 太郎", `Message ${i + 1} du long fil.`, 4000 - i * 45)),
  msg("x1", "lab-long", LONG_NAME, URL_TEXT, 600),
  msg("x2", "lab-one", "Ω", ".", 580),
  msg("x3", "lab-ar", "محمد الأمين", "مرحبا بالجميع، هل نبدأ الفيلم الآن؟", 560),
  msg("x4", "lab-emoji", "🦑Poulpy🦑", "🔥🔥🔥", 540),
  msg("x5", "lab-emoji", "🦑Poulpy🦑", "👨‍👩‍👧‍👦", 538),
  msg("x6", "lab-emoji", "🦑Poulpy🦑", "🎬🍿🥤😴", 536),
  msg("x7", LAB_USER_ID, "Knaoxtest", "Plusieurs lignes :\n— la première ;\n— la deuxième, nettement plus longue que la première pour forcer un retour à la ligne ;\n\n— et une dernière après un blanc.", 500),
  msg("x8", "lab-jp", "山田 太郎", "x".repeat(500), 480),
  ...Array.from({ length: 6 }, (_, i) => msg(`r${i}`, "lab-lea", "Léa", ["Une suite", "de six messages", "du même auteur", "pour juger", "les coins", "des bulles."][i]!, 120 - i * 4)),
];

interface LabChatControls {
  receive: (username: string, text: string, userId?: string) => void;
  typing: (names: string[]) => void;
  react: (emoji: string, username?: string) => void;
  refuseNext: (count?: number) => void;
  state: () => WtChatState;
}

function useLabChat(seed: WtChatMessageDto[], startOpen: boolean, startUnread: number): WtChatApi {
  const [state, setState] = useState<WtChatState>(() => ({
    groupId: "lab-group", messages: seed, unread: startOpen ? 0 : startUnread, open: startOpen, reactions: [], toasts: [], typing: [],
  }));
  const serial = useRef(0);
  const refuse = useRef(0);
  const live = useRef(state);
  live.current = state;

  const api = useMemo<WtChatApi>(() => {
    const allowed = (): boolean => {
      if (refuse.current <= 0) return true;
      refuse.current -= 1;
      return false;
    };
    const push = (message: WtChatMessageDto, fromSelf: boolean) => setState((s) => {
      const quiet = s.open || fromSelf;
      return { ...s, messages: [...s.messages, message], unread: quiet ? s.unread : s.unread + 1, toasts: quiet ? s.toasts : [...s.toasts, message].slice(-4), typing: s.typing.filter((m) => m.userId !== message.userId) };
    });
    const controls: LabChatControls = {
      receive: (username, text, userId = `lab-${username}`) => push({ id: `in-${serial.current++}`, userId, username, text, at: Date.now() }, false),
      typing: (names) => setState((s) => ({ ...s, typing: names.map((name) => ({ userId: `lab-${name}`, username: name, expiresAt: Date.now() + 60_000 })) })),
      // Une réaction du labo s'efface seule, comme celle d'une vraie séance.
      react: (emoji, username = "Léa") => {
        const key = `re-${serial.current++}`;
        setState((s) => ({ ...s, reactions: [...s.reactions, { key, userId: `lab-${username}`, username, emoji }] }));
        setTimeout(() => setState((s) => ({ ...s, reactions: s.reactions.filter((r) => r.key !== key) })), 2600);
      },
      refuseNext: (count = 1) => { refuse.current = count; },
      state: () => live.current,
    };
    (window as unknown as { __labChat?: LabChatControls }).__labChat = controls;
    return {
      state: live.current,
      sendChat: (text) => {
        if (!allowed()) return false;
        push({ id: `out-${serial.current++}`, userId: LAB_USER_ID, username: "Knaoxtest", text, at: Date.now() }, true);
        return true;
      },
      sendReaction: (emoji) => {
        if (!allowed()) return false;
        controls.react(emoji, "Knaoxtest");
        return true;
      },
      sendGif: () => allowed(),
      setOpen: (open) => setState((s) => ({ ...s, open, unread: open ? 0 : s.unread, toasts: open ? [] : s.toasts })),
      notifyTyping: () => undefined,
    };
  }, []);

  return useMemo(() => ({ ...api, state }), [api, state]);
}

/** Le chat vivant, posé sur ce qu'on lui donne (le lecteur du labo, ou une page). */
export function LabLiveChat({ children }: { children?: ReactNode }) {
  const worst = labParam("donnees") === "pire";
  const closed = labParam("ferme") === "1";
  const chat = useLabChat(worst ? WORST : DEMO, !closed, worst ? 12 : 2);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const toggle = () => {
    const url = new URL(window.location.href);
    if (worst) url.searchParams.delete("donnees");
    else url.searchParams.set("donnees", "pire");
    window.location.assign(url.toString());
  };

  return (
    <>
      {children}
      <button type="button" onClick={toggle} className="btn btn-soft btn-sm fixed left-4 top-14 z-[60]" data-lab-data-toggle>
        Données : {worst ? "pire cas" : "démo"}
      </button>
      <ReactionLayer reactions={chat.state.reactions} />
      <MessageToastLayer toasts={chat.state.toasts} />
      <ChatOverlay chat={chat} dragX={dragX} dragY={dragY} />
    </>
  );
}
