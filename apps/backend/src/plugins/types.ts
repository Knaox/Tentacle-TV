/**
 * Generic interface for media request plugins.
 * Any request management service (Overseerr, Jellyseerr, etc.) can implement this.
 */

export interface SearchResult {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  mediaInfo?: { status: number };
}

export interface PagedResults {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SearchResult[];
}

export interface RequestResult {
  id: number;
  status: number;
  mediaId?: number;
}

export interface RequestPlugin {
  name: string;

  /** Check if the service is reachable. */
  isAvailable(): Promise<boolean>;

  /** Search for movies/TV shows. */
  search(query: string, page?: number, language?: string): Promise<PagedResults>;

  /** Discover content by category. */
  discover(type: "movies" | "tv" | "anime" | "trending", page?: number, language?: string): Promise<PagedResults>;

  /** Submit a media request. */
  request(body: unknown): Promise<RequestResult>;

  /** Delete a request by ID. */
  deleteRequest(requestId: number): Promise<void>;

  /** List all requests with pagination. */
  listRequests(params: Record<string, string>): Promise<unknown>;

  /** Get request counts. */
  getRequestCount(): Promise<Record<string, number>>;

  /** Get movie details. */
  getMovie(id: number): Promise<unknown>;

  /** Get TV show details. */
  getTv(id: number): Promise<unknown>;
}
