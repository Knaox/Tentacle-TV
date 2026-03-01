/* ------------------------------------------------------------------ */
/*  Seer API endpoints (proxied through Tentacle backend)              */
/* ------------------------------------------------------------------ */

let _backendBase = "";

export function setSeerBackendUrl(url: string) {
  _backendBase = url.replace(/\/$/, "");
}

export function getSeerBackendUrl(): string {
  return _backendBase;
}

export const SEER_ENDPOINTS = {
  search: (query: string, page = 1) =>
    `${_backendBase}/api/seerr/search?query=${encodeURIComponent(query)}&page=${page}`,
  discoverMovies: (page = 1) =>
    `${_backendBase}/api/seerr/discover/movies?page=${page}`,
  discoverTv: (page = 1) =>
    `${_backendBase}/api/seerr/discover/tv?page=${page}`,
  discoverAnime: (page = 1) =>
    `${_backendBase}/api/seerr/discover/anime?page=${page}`,
  discoverTrending: (page = 1) =>
    `${_backendBase}/api/seerr/discover/trending?page=${page}`,
  movie: (id: number) =>
    `${_backendBase}/api/seerr/movie/${id}`,
  tv: (id: number) =>
    `${_backendBase}/api/seerr/tv/${id}`,
  request: () =>
    `${_backendBase}/api/plugins/seer/requests`,
  requests: (page = 1, limit = 20) =>
    `${_backendBase}/api/plugins/seer/requests?page=${page}&limit=${limit}`,
  requestById: (id: string) =>
    `${_backendBase}/api/plugins/seer/requests/${id}`,
  retryRequest: (id: string) =>
    `${_backendBase}/api/plugins/seer/requests/${id}/retry`,
  queueStatus: () =>
    `${_backendBase}/api/plugins/seer/queue/status`,
  config: () =>
    `${_backendBase}/api/admin/plugins/seer/config`,
  testConnection: () =>
    `${_backendBase}/api/admin/test-seerr`,
} as const;
