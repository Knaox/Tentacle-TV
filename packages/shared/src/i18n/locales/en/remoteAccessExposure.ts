/**
 * Remote access, in plain words: private or public (two small diagrams),
 * this server's address on the network, the detected public address, the
 * ports to open and security. Merged into the `remoteAccess` namespace.
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
  portOptional: "Only if Jellyfin has a public address (direct play away from home).",

  publicLinkTitle: "Tentacle's public address",
  publicLinkSuggested: "The one your family, friends and apps will use away from home:",
  publicLinkUse: "Use this address",
  publicLinkNoIp: "Once the public address is known, it will be suggested here.",
  publicLinkDynamic: "If your router's public address changes (dynamic address), you will have to update it: a domain name avoids that.",

  securityTitle: "Security",
  security_default: "Nothing is exposed by default: without a public link or a Jellyfin public address, nothing is published.",
  security_secrets: "No password or token ever appears in an address.",
  security_https: "HTTPS recommended: without a proxy, the connection from outside is not encrypted.",
};
