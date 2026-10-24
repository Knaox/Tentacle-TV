import { describe, expect, it } from "vitest";
import { splitQueryAuth } from "./relayQueryAuth";

describe("jeton en paramètre du relais", () => {
  it("prend api_key ou apikey (toute casse), le retire, garde le reste dans l'ordre", () => {
    expect(splitQueryAuth("/stream/a?x=1&api_key=t%2B1&y=2")).toEqual({ token: "t+1", present: true, target: "/stream/a?x=1&y=2" });
    expect(splitQueryAuth("/s?ApiKey=abc")).toEqual({ token: "abc", present: true, target: "/s" });
    expect(splitQueryAuth("/s?API_KEY=a&api_key=b")).toEqual({ token: "a", present: true, target: "/s" });
  });

  it("un paramètre vide est retiré et compte comme présent ; sans paramètre, rien ne change", () => {
    expect(splitQueryAuth("/s?api_key=&q=x")).toEqual({ token: null, present: true, target: "/s?q=x" });
    expect(splitQueryAuth("/s?q=api_key")).toEqual({ token: null, present: false, target: "/s?q=api_key" });
    expect(splitQueryAuth("/s")).toEqual({ token: null, present: false, target: "/s" });
  });
});
