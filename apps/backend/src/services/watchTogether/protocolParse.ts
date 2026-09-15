import { isSegmentType } from "../../playback/segmentTypes";
import { clampTicks, WT_CHAT_MAX_LENGTH, WT_GIF_URL_MAX_LENGTH, WT_REACTION_MAX_LENGTH } from "./protocol";
import type { WtClientMessage, WtSetItemReason } from "./protocolMessages";

/**
 * Watch Together — validation de forme des messages entrants (payloads non
 * fiables). Les règles métier vivent dans sync.ts ; ici, seulement « est-ce
 * un message bien formé, et lequel ».
 */

const SET_ITEM_REASONS: readonly string[] = ["manual", "nextEp", "prevEp", "autonext"];

/** Hôte autorisé pour les GIFs : le CDN Klipy uniquement (anti-injection
 *  d'URL — l'URL broadcastée est chargée en <img> par TOUS les membres).
 *  Suffixe strict `.klipy.com` : couvre les sous-domaines média variables
 *  (media./static./cdn.…) sans accepter `evilklipy.com`. */
function isAllowedGifHost(hostname: string): boolean {
  return hostname === "klipy.com" || hostname.endsWith(".klipy.com");
}

/** URL de GIF sûre : https, hôte Klipy, longueur bornée. `new URL` neutralise
 *  les contournements (`static.klipy.com@evil.com` → hostname evil.com,
 *  `static.klipy.com.evil.com` → suffixe non satisfait, data:/javascript:). */
export function isAllowedGifUrl(raw: string): boolean {
  if (raw.length > WT_GIF_URL_MAX_LENGTH) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && isAllowedGifHost(u.hostname);
  } catch {
    return false;
  }
}

/** Dimension décorative (aspect-ratio UI) : nombre fini positif clampé, sinon absente. */
function gifDim(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0
    ? Math.min(Math.round(v), 1024)
    : undefined;
}

/** Validation de forme des messages entrants (payloads non fiables). */
export function parseWtClientMessage(msg: { type: string } & Record<string, unknown>): WtClientMessage | null {
  switch (msg.type) {
    case "wt:play":
    case "wt:pause":
    case "wt:seek":
      if (typeof msg.positionTicks !== "number" || !Number.isFinite(msg.positionTicks)) return null;
      return { type: msg.type, positionTicks: clampTicks(msg.positionTicks) };
    case "wt:setItem": {
      if (typeof msg.itemId !== "string" || !msg.itemId) return null;
      const from = msg.fromItemId;
      if (from !== null && typeof from !== "string") return null;
      const reason = typeof msg.reason === "string" && SET_ITEM_REASONS.includes(msg.reason)
        ? (msg.reason as WtSetItemReason) : "manual";
      return {
        type: "wt:setItem",
        itemId: msg.itemId,
        fromItemId: from ?? null,
        reason,
        startPositionTicks: typeof msg.startPositionTicks === "number" && Number.isFinite(msg.startPositionTicks)
          ? clampTicks(msg.startPositionTicks) : undefined,
      };
    }
    case "wt:buffering":
      if (typeof msg.buffering !== "boolean") return null;
      return {
        type: "wt:buffering",
        buffering: msg.buffering,
        positionTicks: typeof msg.positionTicks === "number" && Number.isFinite(msg.positionTicks)
          ? clampTicks(msg.positionTicks) : undefined,
      };
    case "wt:presence":
      if (typeof msg.inPlayback !== "boolean") return null;
      return {
        type: "wt:presence",
        inPlayback: msg.inPlayback,
        itemId: typeof msg.itemId === "string" ? msg.itemId : undefined,
      };
    case "wt:playbackError":
      if (typeof msg.itemId !== "string" || !msg.itemId) return null;
      return { type: "wt:playbackError", itemId: msg.itemId };
    case "wt:autonextDismiss":
      return { type: "wt:autonextDismiss" };
    case "wt:skipIntroDismiss":
      // Compat ascendante : un client d'avant la refonte n'envoie pas de type,
      // et un type inconnu vaut son absence — le refus reste transmis, c'est
      // lui qui compte. Le client retombe alors sur « Intro ».
      return {
        type: "wt:skipIntroDismiss",
        segmentType: isSegmentType(msg.segmentType) ? msg.segmentType : undefined,
      };
    case "wt:goodbye":
      return { type: "wt:goodbye" };
    case "wt:syncRequest":
      return { type: "wt:syncRequest" };
    case "wt:chat": {
      if (typeof msg.text !== "string") return null;
      const text = msg.text.trim().slice(0, WT_CHAT_MAX_LENGTH);
      if (!text) return null;
      return { type: "wt:chat", text };
    }
    case "wt:reaction": {
      if (typeof msg.emoji !== "string") return null;
      const emoji = msg.emoji.trim();
      if (!emoji || emoji.length > WT_REACTION_MAX_LENGTH) return null;
      return { type: "wt:reaction", emoji };
    }
    case "wt:gif": {
      if (typeof msg.url !== "string") return null;
      const url = msg.url.trim();
      if (!isAllowedGifUrl(url)) return null;
      return { type: "wt:gif", url, w: gifDim(msg.w), h: gifDim(msg.h) };
    }
    default:
      return null;
  }
}
