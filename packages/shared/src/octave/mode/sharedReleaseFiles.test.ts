import { describe, expect, it } from "vitest";
import { releaseFileImportPath, sharedAudioFiles } from "./sharedReleaseFiles";

describe("fichiers audio partagés vers Tentacle TV", () => {
  it("lit les paramètres répétés, nom et type à leur rang", () => {
    expect(sharedAudioFiles({ file: ["content://media/1", "content://media/2"], fileName: ["01 Intro.flac", ""], fileType: ["audio/flac"] })).toEqual([
      { uri: "content://media/1", name: "01 Intro.flac", type: "audio/flac" },
      { uri: "content://media/2", name: "2", type: "" },
    ]);
  });
  it("un seul fichier (paramètre simple) ; jamais une adresse d'un autre schéma", () => {
    expect(sharedAudioFiles({ file: "file:///Inbox/Titre%20un.mp3" })).toEqual([{ uri: "file:///Inbox/Titre%20un.mp3", name: "Titre un.mp3", type: "" }]);
    expect(sharedAudioFiles({ file: ["https://evil/x.mp3", "javascript:alert(1)"] })).toEqual([]);
    expect(sharedAudioFiles({})).toEqual([]);
  });
  it("iOS : un document remis devient la route de l'import ; le reste passe", () => {
    expect(releaseFileImportPath("file:///private/var/Inbox/Bastien%20Becker%20-%2001.m4a")).toBe(
      "/octave/import?file=file%3A%2F%2F%2Fprivate%2Fvar%2FInbox%2FBastien%2520Becker%2520-%252001.m4a&fileName=Bastien%20Becker%20-%2001.m4a",
    );
    expect(releaseFileImportPath("tentacle://octave/import?shared=x")).toBeNull();
  });
});
