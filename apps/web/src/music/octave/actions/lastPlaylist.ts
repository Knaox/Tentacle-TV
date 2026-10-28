/**
 * Octave — la dernière playlist utilisée sur CET appareil (`localStorage`). La règle et la clé vivent dans
 * api-client (`lastPlaylist`), lues aussi par le mobile.
 */

import { lastPlaylistIdFrom, rememberPlaylistIn } from "@tentacle-tv/api-client";

export { quickTarget } from "@tentacle-tv/api-client";

const store = () => (typeof localStorage === "undefined" ? null : localStorage);

export const lastPlaylistId = (): string | null => lastPlaylistIdFrom(store());
export const rememberPlaylist = (playlistId: string): void => rememberPlaylistIn(store(), playlistId);
