import { describe, expect, it } from "vitest";
import { guessTextLanguage, isForeignMessage } from "./messageLanguage";

describe("guessTextLanguage — la langue d'un message de ticket", () => {
  it("reconnaît un message en anglais et un message en français", () => {
    expect(guessTextLanguage("Hello, the movie doesn't play on my TV and I can't find what is wrong with it.")).toBe("en");
    expect(guessTextLanguage("Bonjour, le film ne se lance pas sur ma télé et je ne vois pas ce qui cloche.")).toBe("fr");
  });

  it("reconnaît l'espagnol et l'allemand", () => {
    expect(guessTextLanguage("Hola, la película no funciona en mi televisor, gracias por la ayuda.")).toBe("es");
    expect(guessTextLanguage("Hallo, der Film geht nicht und ich weiß nicht, was mit dem Server ist. Danke!")).toBe("de");
  });

  it("ne conclut rien d'un message trop court ou ambigu", () => {
    expect(guessTextLanguage("OK")).toBeNull();
    expect(guessTextLanguage("Merci !")).toBeNull();
    expect(guessTextLanguage("Breaking Bad S02E04")).toBeNull();
    expect(guessTextLanguage("")).toBeNull();
  });

  it("une suggestion seulement pour une AUTRE langue que celle de l'interface", () => {
    const en = "Hi, the subtitles are not showing on this episode, can you check it please?";
    expect(isForeignMessage(en, "fr")).toBe(true);
    expect(isForeignMessage(en, "en")).toBe(false);
    expect(isForeignMessage(en, "en-US")).toBe(false);
    expect(isForeignMessage("Les sous-titres ne s'affichent pas sur cet épisode, pouvez-vous regarder ?", "fr")).toBe(false);
  });
});
