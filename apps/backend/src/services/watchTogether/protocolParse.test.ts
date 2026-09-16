/**
 * La validation de forme des messages entrants, sur le protocole v2 : les
 * champs nouveaux sont FACULTATIFS (un client d'avant ne les envoie pas et
 * doit passer), et un champ mal formé est écarté sans faire tomber le message.
 */

import { describe, expect, it } from "vitest";
import { parseWtClientMessage } from "./protocolParse";

describe("parseWtClientMessage — protocole v2", () => {
  it("un client d'avant passe tel quel", () => {
    expect(parseWtClientMessage({ type: "wt:presence", inPlayback: true, itemId: "i" }))
      .toEqual({ type: "wt:presence", inPlayback: true, itemId: "i", protocolVersion: undefined, rttMs: undefined });
    expect(parseWtClientMessage({ type: "wt:buffering", buffering: false }))
      .toEqual({ type: "wt:buffering", buffering: false, positionTicks: undefined, barrierId: undefined, rttMs: undefined });
    expect(parseWtClientMessage({ type: "wt:play", positionTicks: 5 })).toEqual({ type: "wt:play", positionTicks: 5 });
  });

  it("presence : version et aller-retour notés, bornés, ou écartés", () => {
    expect(parseWtClientMessage({ type: "wt:presence", inPlayback: true, protocolVersion: 2, rttMs: 37.6 }))
      .toMatchObject({ protocolVersion: 2, rttMs: 38 });
    expect(parseWtClientMessage({ type: "wt:presence", inPlayback: true, protocolVersion: 0, rttMs: -1 }))
      .toMatchObject({ protocolVersion: undefined, rttMs: undefined });
    expect(parseWtClientMessage({ type: "wt:presence", inPlayback: true, rttMs: 1e9 }))
      .toMatchObject({ rttMs: 60_000 });
  });

  it("buffering : l'écho de barrière est un entier positif, sinon absent", () => {
    expect(parseWtClientMessage({ type: "wt:buffering", buffering: false, barrierId: 4 })).toMatchObject({ barrierId: 4 });
    expect(parseWtClientMessage({ type: "wt:buffering", buffering: false, barrierId: 0 })).toMatchObject({ barrierId: undefined });
    expect(parseWtClientMessage({ type: "wt:buffering", buffering: false, barrierId: "4" })).toMatchObject({ barrierId: undefined });
  });

  it("play : `force` n'existe que vrai", () => {
    expect(parseWtClientMessage({ type: "wt:play", positionTicks: 1, force: true })).toEqual({ type: "wt:play", positionTicks: 1, force: true });
    expect(parseWtClientMessage({ type: "wt:play", positionTicks: 1, force: "oui" })).toEqual({ type: "wt:play", positionTicks: 1 });
  });

  it("tick : position, pause et horloge obligatoires", () => {
    expect(parseWtClientMessage({ type: "wt:tick", positionTicks: 10, paused: false, atServerTime: 1234, rttMs: 20 }))
      .toEqual({ type: "wt:tick", positionTicks: 10, paused: false, atServerTime: 1234, rttMs: 20 });
    expect(parseWtClientMessage({ type: "wt:tick", positionTicks: 10, paused: false })).toBeNull();
    expect(parseWtClientMessage({ type: "wt:tick", positionTicks: "10", paused: false, atServerTime: 1 })).toBeNull();
  });

  it("skipPropose : type de passage connu, ticks bornés", () => {
    expect(parseWtClientMessage({ type: "wt:skipPropose", segmentType: "Intro", isEpisode: true, segmentStartTicks: 100, toTicks: 900 }))
      .toEqual({ type: "wt:skipPropose", segmentType: "Intro", isEpisode: true, segmentStartTicks: 100, toTicks: 900 });
    expect(parseWtClientMessage({ type: "wt:skipPropose", segmentType: "Bande-annonce", isEpisode: true, segmentStartTicks: 1, toTicks: 2 })).toBeNull();
    expect(parseWtClientMessage({ type: "wt:skipPropose", segmentType: "Outro", isEpisode: false, segmentStartTicks: -5, toTicks: 2 }))
      .toMatchObject({ segmentStartTicks: 0 });
  });
});
