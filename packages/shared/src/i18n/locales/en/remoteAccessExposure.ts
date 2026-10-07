/**
 * Remote access, in plain words: private or public (two small diagrams),
 * this server's address on the network, the “Access from outside” switch,
 * the detected public address, the two ports to open, direct play away from
 * home (optional) and security. Merged into the `remoteAccess` namespace.
 */
export default {
  modesTitle: "Who can reach Tentacle?",
  modePrivateTitle: "Private",
  modePrivateBody: "Only the devices at home can reach it: your phone, your TV, your computer, on the same network.",
  modePublicTitle: "Public",
  modePublicBody: "Your family and friends can also reach it from their place, through your address {{ip}}.",
  modePublicBodyUnknown: "Your family and friends can also reach it from their place, through your router's public address.",
  modeCurrent: "Current setting",
  diagramHome: "Home",
  diagramBox: "Router",
  diagramServer: "Server",
  diagramInternet: "Internet",
  diagramFriend: "A friend",
  diagramPrivateAlt: "Diagram: the devices at home reach the server through the router; nothing comes in from the Internet.",
  diagramPublicAlt: "Diagram: a friend, on the Internet, reaches your router at {{ip}}; the router passes it on to the server.",

  lanExample: "The one you type at home to open Tentacle, for example {{example}}. Suggested from this page's address: change it if it is wrong.",
  lanUsedFor: "Your devices at home use it, and the router needs it to know where to send visits from the Internet.",

  exposureOff: "Off: nothing is published. Tentacle and Jellyfin only answer at home, through their private address. Everything else works as usual.",
  exposureOn: "On: the public address set below is given to your apps. You also need to open the ports on your router.",
  exposureSaveFailed: "The setting was not saved. Try again.",

  publicIpTitle: "Your public address",
  publicIpDetected: "Detected automatically.",
  publicIpFromCheck: "Seen by the last port test.",
  publicIpLoading: "Detecting…",
  publicIpUnavailable: "It cannot be detected right now. Your router shows it in its interface (“WAN IP address” or “public IPv4”).",
  publicIpDisabled: "Detection is turned off on this server (REMOTE_CHECK_URL=off).",
  reach_open: "Reachable from the Internet: the port test succeeded.",
  reach_closed: "Not reachable from the Internet yet: the ports are not open, or the router does not pass them to this server.",
  reach_unknown: "Not checked yet: run the test below once the ports are open.",
  reach_no_service: "The automatic port test is not online yet. To check yourself: on a phone on 4G or 5G (Wi-Fi off), open {{url}}.",
  reach_no_service_generic: "The automatic port test is not online yet. To check yourself: open your public address on a phone on 4G or 5G (Wi-Fi off).",
  reach_disabled: "The port test is turned off on this server.",

  proxyWhat: "A reverse proxy is a small program that receives visits from the Internet and passes them to Tentacle, adding HTTPS — the browser's padlock.",
  proxyNotIncluded: "Caddy, Traefik and Nginx are NOT included NOR installed by Tentacle: only pick one if you ALREADY have it. Otherwise, keep “No proxy”.",
  defaultChoice: "Default",

  portsIntro: "On your router, create one forwarding rule per line: visits from the Internet on that port are sent to this server.",
  portOptional: "Only if you turn on direct play away from home, below.",

  publicLinkTitle: "Tentacle's public address",
  publicLinkSuggested: "The one your family, friends and apps will use away from home:",
  publicLinkUse: "Use this address",
  publicLinkNoIp: "Once the public address is known, it will be suggested here.",
  publicLinkDynamic: "If your router's public address changes (dynamic address), you will have to update it: a domain name avoids that.",

  directTitle: "Direct play away from home (optional)",
  directDescription: "Optional: at home, your devices already play directly; away from home, Jellyfin must be opened to the Internet.",
  directSwitch: "Direct play from outside",
  directOff: "Off: away from home, videos go through Tentacle. Nothing more to open.",
  directOn: "On: your apps play straight from Jellyfin, through its public address. Often smoother, but Jellyfin can then be reached from the Internet.",
  directUrl: "Jellyfin's public address",
  directUrlHint: "For example {{example}}.",
  directUrlMissing: "Give Jellyfin's public address, or turn off direct play from outside.",
  directHome: "At home, your devices already play directly through {{url}}.",
  directHomeOff: "Direct play at home is turned off (Administration › Services).",
  directSaved: "Direct play saved.",

  securityTitle: "Security",
  security_default: "Nothing is exposed by default: as long as access from outside is off, nothing is published.",
  security_secrets: "No password or token ever appears in an address.",
  security_https: "HTTPS recommended: without a proxy, the connection from outside is not encrypted.",
};
