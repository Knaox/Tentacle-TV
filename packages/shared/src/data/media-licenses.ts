export interface LicenseInfo {
  /** SPDX identifier or custom */
  type: string;
  /** Full display name */
  fullName: string;
  /** URL to the legal text */
  url: string;
  /** URL of the badge/icon */
  badgeUrl?: string;
}

export interface LicenseCreator {
  name: string;
  role: string;
  url?: string;
}

export interface LicenseAttribution {
  /** Full copyright notice */
  copyrightNotice: string;
  /** Primary creator(s) */
  creators: LicenseCreator[];
  /** Link to the official source */
  sourceUrl: string;
  /** Source name (e.g. "Blender Studio") */
  sourceName: string;
}

export interface MediaLicense {
  /** Patterns for matching: exact title, title + year, or provider ID */
  match: {
    title?: string;
    year?: number;
    imdbId?: string;
    tmdbId?: string;
  };
  license: LicenseInfo;
  attribution: LicenseAttribution;
  /** Description of modifications if the content was altered */
  modifications?: string;
}

/** Resolved license data ready for display (from local DB or built dynamically) */
export interface ResolvedLicense {
  license: LicenseInfo;
  attribution: LicenseAttribution;
  modifications?: string;
}

/** Map of CC tag patterns to their full license metadata */
export const CC_LICENSE_MAP: Record<string, LicenseInfo> = {
  "CC-BY-4.0": {
    type: "CC-BY-4.0",
    fullName: "Creative Commons Attribution 4.0 International",
    url: "https://creativecommons.org/licenses/by/4.0/",
    badgeUrl: "https://licensebuttons.net/l/by/4.0/88x31.png",
  },
  "CC-BY-SA-4.0": {
    type: "CC-BY-SA-4.0",
    fullName: "Creative Commons Attribution-ShareAlike 4.0 International",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
    badgeUrl: "https://licensebuttons.net/l/by-sa/4.0/88x31.png",
  },
  "CC-BY-NC-4.0": {
    type: "CC-BY-NC-4.0",
    fullName: "Creative Commons Attribution-NonCommercial 4.0 International",
    url: "https://creativecommons.org/licenses/by-nc/4.0/",
    badgeUrl: "https://licensebuttons.net/l/by-nc/4.0/88x31.png",
  },
  "CC-BY-NC-SA-4.0": {
    type: "CC-BY-NC-SA-4.0",
    fullName: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    badgeUrl: "https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png",
  },
  "CC-BY-ND-4.0": {
    type: "CC-BY-ND-4.0",
    fullName: "Creative Commons Attribution-NoDerivatives 4.0 International",
    url: "https://creativecommons.org/licenses/by-nd/4.0/",
    badgeUrl: "https://licensebuttons.net/l/by-nd/4.0/88x31.png",
  },
  "CC-BY-NC-ND-4.0": {
    type: "CC-BY-NC-ND-4.0",
    fullName: "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International",
    url: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    badgeUrl: "https://licensebuttons.net/l/by-nc-nd/4.0/88x31.png",
  },
  "CC0-1.0": {
    type: "CC0-1.0",
    fullName: "CC0 1.0 Universal (Public Domain Dedication)",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    badgeUrl: "https://licensebuttons.net/p/zero/1.0/88x31.png",
  },
};

export const KNOWN_OPEN_SOURCE_MEDIA: MediaLicense[] = [
  {
    match: { title: "Spring", year: 2019 },
    license: {
      type: "CC-BY-4.0",
      fullName: "Creative Commons Attribution 4.0 International",
      url: "https://creativecommons.org/licenses/by/4.0/",
      badgeUrl: "https://licensebuttons.net/l/by/4.0/88x31.png",
    },
    attribution: {
      copyrightNotice: "\u00a9 Blender Foundation | studio.blender.org",
      creators: [
        { name: "Andreas Goralczyk", role: "Director" },
        { name: "Francesco Siddi", role: "Producer" },
        { name: "Ton Roosendaal", role: "Executive Producer" },
        { name: "David Revoy", role: "Concept Art" },
      ],
      sourceUrl: "https://studio.blender.org/projects/spring/",
      sourceName: "Blender Studio",
    },
  },
  {
    match: { title: "Big Buck Bunny", year: 2008 },
    license: {
      type: "CC-BY-4.0",
      fullName: "Creative Commons Attribution 4.0 International",
      url: "https://creativecommons.org/licenses/by/4.0/",
      badgeUrl: "https://licensebuttons.net/l/by/4.0/88x31.png",
    },
    attribution: {
      copyrightNotice: "\u00a9 Blender Foundation | www.bigbuckbunny.org",
      creators: [{ name: "Sacha Goedegebure", role: "Director" }],
      sourceUrl: "https://www.bigbuckbunny.org/",
      sourceName: "Blender Foundation",
    },
  },
  {
    match: { title: "Sintel", year: 2010 },
    license: {
      type: "CC-BY-4.0",
      fullName: "Creative Commons Attribution 4.0 International",
      url: "https://creativecommons.org/licenses/by/4.0/",
      badgeUrl: "https://licensebuttons.net/l/by/4.0/88x31.png",
    },
    attribution: {
      copyrightNotice: "\u00a9 Blender Foundation | durian.blender.org",
      creators: [{ name: "Colin Levy", role: "Director" }],
      sourceUrl: "https://durian.blender.org/",
      sourceName: "Blender Foundation",
    },
  },
  {
    match: { title: "Elephants Dream", year: 2006 },
    license: {
      type: "CC-BY-4.0",
      fullName: "Creative Commons Attribution 4.0 International",
      url: "https://creativecommons.org/licenses/by/4.0/",
      badgeUrl: "https://licensebuttons.net/l/by/4.0/88x31.png",
    },
    attribution: {
      copyrightNotice: "\u00a9 Blender Foundation | orange.blender.org",
      creators: [{ name: "Bassam Kurdali", role: "Director" }],
      sourceUrl: "https://orange.blender.org/",
      sourceName: "Blender Foundation",
    },
  },
  {
    match: { title: "Tears of Steel", year: 2012 },
    license: {
      type: "CC-BY-4.0",
      fullName: "Creative Commons Attribution 4.0 International",
      url: "https://creativecommons.org/licenses/by/4.0/",
      badgeUrl: "https://licensebuttons.net/l/by/4.0/88x31.png",
    },
    attribution: {
      copyrightNotice: "\u00a9 Blender Foundation | mango.blender.org",
      creators: [{ name: "Ian Hubert", role: "Director" }],
      sourceUrl: "https://mango.blender.org/",
      sourceName: "Blender Foundation",
    },
  },
  {
    match: { title: "Cosmos Laundromat", year: 2015 },
    license: {
      type: "CC-BY-4.0",
      fullName: "Creative Commons Attribution 4.0 International",
      url: "https://creativecommons.org/licenses/by/4.0/",
      badgeUrl: "https://licensebuttons.net/l/by/4.0/88x31.png",
    },
    attribution: {
      copyrightNotice: "\u00a9 Blender Foundation | gooseberry.blender.org",
      creators: [{ name: "Mathieu Auvray", role: "Director" }],
      sourceUrl: "https://gooseberry.blender.org/",
      sourceName: "Blender Foundation",
    },
  },
  {
    match: { title: "Agent 327: Operation Barbershop", year: 2017 },
    license: {
      type: "CC-BY-4.0",
      fullName: "Creative Commons Attribution 4.0 International",
      url: "https://creativecommons.org/licenses/by/4.0/",
      badgeUrl: "https://licensebuttons.net/l/by/4.0/88x31.png",
    },
    attribution: {
      copyrightNotice: "\u00a9 Blender Foundation | agent327.com",
      creators: [
        { name: "Hjalti Hjalmarsson", role: "Director" },
        { name: "Colin Levy", role: "Director" },
      ],
      sourceUrl: "https://agent327.com/",
      sourceName: "Blender Foundation",
    },
  },
];
