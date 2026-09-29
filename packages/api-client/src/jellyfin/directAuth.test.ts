import { describe, expect, it } from "vitest";
import { directJellyfinHeaders, withDirectApiKey } from "./directAuth";
import { DirectStreamingControl } from "./directStreaming";

describe("withDirectApiKey", () => {
  it("pose le jeton sous ApiKey, la seule forme que Jellyfin 12 garde en query", () => {
    expect(withDirectApiKey("http://jf:8096/Videos/1/stream?Static=true", "t0k")).toBe("http://jf:8096/Videos/1/stream?Static=true&ApiKey=t0k");
    expect(withDirectApiKey("http://jf:8096/Videos/1/stream", "t0k")).toBe("http://jf:8096/Videos/1/stream?ApiKey=t0k");
  });

  it("remplace api_key et ApiKey existants, toute casse, sans en laisser un second", () => {
    const url = withDirectApiKey("http://jf/Videos/1/master.m3u8?api_key=admin&MediaSourceId=m&APIKEY=x&apikey=y", "user");
    expect(url).toBe("http://jf/Videos/1/master.m3u8?MediaSourceId=m&ApiKey=user");
  });

  it("garde l'encodage d'origine des autres paramètres (TranscodingUrl recopiée)", () => {
    const url = withDirectApiKey("http://jf/v.m3u8?TranscodeReasons=ContainerNotSupported%2CAudioCodecNotSupported&ApiKey=k", "u/+");
    expect(url).toBe("http://jf/v.m3u8?TranscodeReasons=ContainerNotSupported%2CAudioCodecNotSupported&ApiKey=u%2F%2B");
  });

  it("les en-têtes directs : Authorization seul, jamais X-Emby-*", () => {
    expect(directJellyfinHeaders('MediaBrowser Token="t"')).toEqual({ Authorization: 'MediaBrowser Token="t"' });
  });
});

describe("DirectStreamingControl.resolve", () => {
  const ds = new DirectStreamingControl();
  ds.set({ enabled: true, mediaBaseUrl: "http://jf:8096", jellyfinToken: "user-token" });

  it("réécrit un flux proxifié en URL directe, jeton de l'utilisateur en ApiKey", () => {
    expect(ds.resolve("https://tentacle/api/jellyfin/Videos/1/stream?Static=true&api_key=proxy", "https://tentacle/api/jellyfin"))
      .toBe("http://jf:8096/Videos/1/stream?Static=true&ApiKey=user-token");
  });

  it("laisse les images au proxy (CORS)", () => {
    const img = "https://tentacle/api/jellyfin/Items/1/Images/Primary?maxWidth=300";
    expect(ds.resolve(img, "https://tentacle/api/jellyfin")).toBe(img);
  });

  it("sans direct, rend l'URL du proxy", () => {
    expect(new DirectStreamingControl().resolve("https://tentacle/api/jellyfin/Videos/1/stream", "https://tentacle/api/jellyfin"))
      .toBe("https://tentacle/api/jellyfin/Videos/1/stream");
  });
});
