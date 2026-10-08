# Qui peut ouvrir l'assistant d'installation

*English version: [../setup-security.md](../setup-security.md).*

Un serveur Tentacle neuf n'appartient à personne tant que son assistant n'est pas fini — et qui le finit
devient administrateur de Tentacle **et** de Jellyfin. Cette page dit qui peut ouvrir cet assistant, et
pourquoi.

## La règle

| Qui | Ce qu'il obtient |
|---|---|
| Le **premier** navigateur qui joint Tentacle **directement depuis le réseau de la maison** | l'assistant, **sans code** |
| La même adresse ensuite (onglet fermé, session expirée) | l'assistant, toujours sans code |
| Toute **autre** adresse du réseau, une fois l'assistant réclamé | le code |
| Quiconque passe par Internet, par un mandataire qui transmet une adresse publique, ou dont l'adresse réelle est inconnue | le code |
| Quiconque, une fois l'installation finie | rien : l'assistant est fermé pour toujours (`tentacle setup reset`, sur la machine, le rouvre) |

Le code s'écrit dans le journal du conteneur et dans `data/setup-token.txt` : le lire prouve qu'on a la
main sur la machine.

## « Directement depuis la maison », c'est tout cela à la fois

1. **Une adresse privée** : RFC 1918 (10/8, 172.16/12, 192.168/16), ULA IPv6 (fc00::/7), lien local, boucle
   locale. Pas le CGNAT (100.64/10) : il est partagé entre abonnés d'un opérateur, et Tailscale l'emprunte.
2. **Vue sans mandataire**, ou transmise par un **mandataire voisin de confiance** (la machine, le réseau
   local, les réseaux Docker, plus `TRUSTED_PROXIES`). Un en-tête `X-Forwarded-For` venu d'ailleurs est
   ignoré, et le code demandé.
3. **Pas par la passerelle du conteneur.** Docker Desktop, colima et le relais IPv6 de Docker font paraître
   *toutes* les connexions — Internet compris — comme venant de la passerelle, une adresse privée. Tentacle
   ne peut pas savoir qui est derrière : il demande le code. De même avec **Podman sans root** sur un réseau
   de pont (les piles Compose) : son relais de ports, rootlessport, fait venir toute connexion de l'adresse
   *propre* du conteneur. Un navigateur de la machine du serveur peut arriver ainsi lui aussi (pasta, réseau
   de l'hôte) : il reçoit aussi le code — de l'intérieur du conteneur, on ne sait pas les distinguer.
4. **L'adresse tapée dans le navigateur est locale elle aussi** : une IP privée, un nom sans point, ou
   `.local`, `.lan`, `.home`, `.home.arpa`, `.internal`… Un nom de domaine public veut dire qu'on passe par
   Internet ou par un mandataire — même un mandataire qui oublierait de transmettre l'adresse ne fait pas
   passer Internet pour la maison.

## Ce qui arrête un intrus

| Menace | Garde |
|---|---|
| Quelqu'un sur Internet trouve l'assistant ouvert (port redirigé trop tôt) | adresse publique → code |
| Il forge `X-Forwarded-For: 192.168.1.5` | seuls les mandataires voisins sont crus |
| Il passe par la passerelle de Docker Desktop | passerelle = adresse inconnue → code |
| Il passe par le relais de ports de Podman sans root (et forge `Host` ou `X-Forwarded-For`) | adresse propre du conteneur = inconnue → code |
| Un mandataire mal réglé ne transmet aucune adresse | le domaine public tapé dans le navigateur → code |
| Un second appareil du réseau veut prendre la place d'une installation en cours | l'adresse du réclamant est gardée (volume de données, survit à un redémarrage) → code |
| Une session de l'assistant fuit (capture, journal) | chaque session est liée à l'adresse qui l'a ouverte |
| Un invité du Wi-Fi arrive le premier | il le verrait ; vous le remarqueriez aussitôt (l'assistant vous demanderait le code). Finissez l'installation juste après le démarrage, ou `tentacle setup reset` et recommencez |
| Quelqu'un devine le code | 60 bits, 5 essais par minute et par adresse, un code neuf après 10 faux |
| L'assistant utilisé après l'installation | fermé pour toujours : toutes ses routes répondent 404 |
| Un navigateur trafiqué (ou un appel direct à l'API) saute une étape : crée un compte ou une bibliothèque sur un Jellyfin déjà configuré, saute le choix du Jellyfin | le **serveur** tient le parcours (`setupFlowContract.ts`) : le Jellyfin choisi, sondé par le serveur, le décide ; tout geste hors parcours est refusé (`step_refused`) |
| L'assistant tourné contre votre réseau (SSRF) | Jellyfin n'est cherché qu'aux adresses privées ou à celle que le navigateur a tapée, installation ouverte, avec une session ; lien local et métadonnées des clouds refusés à la connexion. Une exception : `host.docker.internal` / `host.containers.internal` tapé **par son nom** et menant à l'adresse de lien local que le moteur de conteneurs a écrite dans `/etc/hosts` (Podman sans root : 169.254.1.2) — jamais une adresse tapée telle quelle, jamais 169.254.169.0/24 ni 169.254.170.0/24 |

## Le compromis assumé

Comme Jellyfin et Plex, le réseau de la maison est cru pour la première prise. Quelqu'un déjà sur votre
réseau dans les minutes qui suivent le démarrage pourrait réclamer le serveur avant vous. Vous le sauriez
aussitôt : votre propre navigateur se verrait demander le code. Alors `tentacle setup reset` dans la console
du conteneur, un redémarrage, et l'on recommence. Sur un réseau dont vous doutez (colocation, Wi-Fi ouvert),
le code reste là : ouvrez l'assistant par un nom de domaine public ou un mandataire, il est toujours demandé.
