/**
 * A family profile's rights, read-only (mobile, tablet, narrow web) — keys
 * rendered by `family/familyRightsSummary.ts`. Rights are SET on desktop or web.
 */
export default {
  title: "Their rights",
  editElsewhere: "Edit on desktop or web",
  otherTitle: "Other rights",
  moreElsewhere: "More settings on desktop or web",
  moreHint: "Unrated titles, tags and hours are set in Settings › Family, from the desktop app or your server's website.",
  editHint: "Rights are set in Settings › Family, from the desktop app or your server's website. They apply right away on all their devices.",
  loading: "Reading rights…",
  libraries: {
    all: "All libraries",
    one: "Only one library: {{names}}",
    some: "{{count}} of {{total}} libraries: {{names}}",
    none: "No library",
  },
  age: {
    none: "No age limit",
    allAudiences: "All audiences only",
    upTo: "Up to age {{age}}",
  },
  unrated: "Unrated titles blocked",
  tags: "Blocked tags: {{count}}",
  schedule: "Limited hours",
  requestTitles: {
    on: "Can request movies",
    off: "Can't request movies",
    suspended: "Requests suspended by the administrator",
  },
  createGuests: {
    on: "Can create guests",
    off: "Doesn't create guests",
  },
  parent: "Parent: manages minors' profiles",
  watchTogether: { guest: "No Watch Together" },
  offline: { guest: "No titles kept offline" },
  account: "Watch Together, offline and sharing follow their account, set by the administrator.",
} as const;
