import { describe, expect, it } from "vitest";
import { describeProblem } from "./describeProblem";
import { problemDetails } from "./problemDetails";
import { buildProblemDiagnostic, scrubDiagnosticText, screenOf } from "./problemDiagnostics";
import { createProblemJournal, parseProblemJournal } from "./problemJournal";

const env = { platform: "ios", osVersion: "26.3", formFactor: "tablet", appVersion: "1.10.3", serverVersion: "1.31.0" };

function diagnostic(code = "transcodeFailed" as const, now = 1_000_000) {
  const model = describeProblem({
    cause: code,
    context: "playbackStart",
    details: problemDetails({
      status: 500,
      request: "GET https://media.example.org/Videos/1/master.m3u8?api_key=SECRET123&PlaySessionId=abc",
      message: "Authorization: Bearer eyJhbGciOi.secret token=hunter2",
    }),
  });
  return buildProblemDiagnostic({
    model,
    environment: env,
    screen: "/watch/123?token=SECRET123",
    playback: { engine: "mpv", playMethod: "Transcode", transcodeReasons: ["VideoCodecNotSupported"], playSessionId: "ps-42", itemId: "123" },
    now,
  });
}

describe("contexte de diagnostic", () => {
  it("jamais un jeton, un mot de passe, une adresse signée ni l'hôte du serveur", () => {
    const text = JSON.stringify(diagnostic());
    for (const secret of ["SECRET123", "eyJhbGciOi", "hunter2", "media.example.org", "api_key="]) {
      expect(text).not.toContain(secret);
    }
  });

  it("garde ce qui aide : code, écran, versions, moteur, décision, session de lecture, heure", () => {
    const entry = diagnostic();
    expect(entry.code).toBe("playbackStart/transcodeFailed");
    expect(entry.severity).toBe("error");
    expect(entry.screen).toBe("/watch/123");
    expect(entry.environment).toEqual(env);
    expect(entry.playback).toEqual({
      engine: "mpv", playMethod: "Transcode", transcodeReasons: ["VideoCodecNotSupported"], playSessionId: "ps-42", itemId: "123",
    });
    expect(entry.at).toBe(new Date(1_000_000).toISOString());
    expect(entry.details.length).toBeGreaterThan(0);
  });

  it("une adresse perd son hôte et sa requête", () => {
    expect(scrubDiagnosticText("GET https://a.b.c/x/y?api_key=1#f done")).toBe("GET https://…/x/y done");
    expect(screenOf("/media/[id]?x=1")).toBe("/media/[id]");
  });
});

describe("journal local tournant", () => {
  it("garde les plus récentes devant et oublie les plus anciennes", () => {
    const journal = createProblemJournal({ capacity: 3 });
    for (let i = 0; i < 5; i++) journal.record({ ...diagnostic("transcodeFailed", i * 10_000), code: `page/c${i}` });
    expect(journal.entries().map((e) => e.code)).toEqual(["page/c4", "page/c3", "page/c2"]);
  });

  it("la même erreur répétée à la chaîne se compte, sans chasser les autres", () => {
    const journal = createProblemJournal();
    journal.record(diagnostic("transcodeFailed", 0));
    journal.record(diagnostic("transcodeFailed", 1_000));
    journal.record(diagnostic("transcodeFailed", 2_000));
    expect(journal.entries()).toHaveLength(1);
    expect(journal.entries()[0].repeated).toBe(3);
  });

  it("se relit du stockage et prépare le rapport à joindre", async () => {
    let stored: string | null = null;
    const storage = { load: () => stored, save: (s: string) => { stored = s; } };
    const first = createProblemJournal({ storage });
    first.record(diagnostic());
    const second = createProblemJournal({ storage, now: () => 5_000 });
    await second.hydrate();
    const report = second.attach(env);
    expect(report.version).toBe(1);
    expect(report.generatedAt).toBe(new Date(5_000).toISOString());
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0].code).toBe("playbackStart/transcodeFailed");
  });

  it("un stockage illisible donne un journal vide, jamais une exception", () => {
    expect(parseProblemJournal("{pas du json")).toEqual([]);
    expect(parseProblemJournal(JSON.stringify([{ nope: 1 }]))).toEqual([]);
    expect(parseProblemJournal(null)).toEqual([]);
  });
});
