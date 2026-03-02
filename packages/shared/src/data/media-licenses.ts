export interface MediaLicense {
  /** Patterns for matching: exact title, title + year, or provider ID */
  match: {
    title?: string;
    year?: number;
    imdbId?: string;
    tmdbId?: string;
  };
  license: {
    /** SPDX identifier or custom */
    type: string;
    /** Full display name */
    fullName: string;
    /** URL to the legal text */
    url: string;
    /** URL of the badge/icon */
    badgeUrl?: string;
  };
  attribution: {
    /** Full copyright notice */
    copyrightNotice: string;
    /** Primary creator(s) */
    creators: Array<{
      name: string;
      role: string;
      url?: string;
    }>;
    /** Link to the official source */
    sourceUrl: string;
    /** Source name (e.g. "Blender Studio") */
    sourceName: string;
  };
  /** Description of modifications if the content was altered */
  modifications?: string;
}

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
