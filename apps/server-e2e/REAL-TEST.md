# Test réel de l'accès à distance (depuis la 4G) — procédure pour Damien

Ce que le banc ne peut pas prouver : un vrai passage par Internet. Il faut le service de test déployé
(`docs/server/port-check.md`) et une redirection sur ta box. Compte : Knaoxtest.

## Préparer (une fois)

1. Déployer `apps/port-check` sous `check.tentacletv.app` (A **et** AAAA, HTTPS devant, `TRUSTED_PROXIES` réglé).
2. Une machine de test avec une pile `tentacle-full` neuve (`TENTACLE_VERSION` = l'image à éprouver), et un
   mandataire HTTPS à toi à côté (Caddy, Nginx Proxy Manager… — la pile n'en embarque aucun).
3. Un domaine de test qui pointe vers ton adresse publique (A, et AAAA si IPv6) — `DNS only` chez Cloudflare.

## Les quatre cas

| Cas | Montage | Attendu dans Administration › Accès à distance › Lancer le test |
|---|---|---|
| 1. Port fermé | aucune redirection sur la box | Tentacle « Injoignable », cause « port non redirigé » |
| 2. HTTP ouvert | box : port de Tentacle (3000) → la machine ; mandataire « Sans » | « Exposé en HTTP », en rouge |
| 3. HTTPS valide | box : 80 et 443 → la machine du mandataire ; dans l'étape 1, le mandataire que tu as (« Caddy », « Nginx ou Nginx Proxy Manager »…) et le domaine ; l'extrait affiché posé tel quel dans le mandataire ; lien public = `https://<domaine>` | « Joignable en HTTPS », date de fin du certificat |
| 4. HTTPS invalide | comme 3, mais un domaine qui ne pointe PAS vers toi (ou un certificat auto-signé) | « À vérifier », cause « certificat » ou « le domaine désigne une autre adresse » |

## Contre-épreuve depuis le téléphone (4G, Wi-Fi coupé)

Pour chaque cas, ouvrir `https://<domaine>` (ou `http://<ip-publique>:3000`) dans le navigateur du téléphone :
le verdict du test doit dire la même chose que ce que voit le téléphone.

## CGNAT

Sur une ligne en adresse partagée (Sunrise DS-Lite, Salt sans option…) : le cas 3 échoue même bien réglé ;
saisir l'adresse WAN de la box dans « Vérifier le partage d'adresse » doit annoncer le CGNAT.
