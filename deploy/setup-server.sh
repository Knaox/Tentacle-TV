#!/bin/bash
# ══════════════════════════════════════════════════════════════
# TENTACLE — Script de setup serveur (Debian 12)
# Exécuter en root sur le serveur: bash setup-server.sh
# ══════════════════════════════════════════════════════════════
set -e

echo "================================================="
echo "  Setup du serveur Tentacle"
echo "  Serveur: $(hostname) — $(date)"
echo "================================================="

# ─── 1. Installer pnpm ───
echo ""
echo "[1/6] Installation de pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
    echo "  pnpm $(pnpm -v) installé"
else
    echo "  pnpm $(pnpm -v) déjà installé"
fi

# ─── 2. Installer rsync (si absent) ───
echo ""
echo "[2/6] Vérification de rsync..."
if ! command -v rsync &> /dev/null; then
    apt-get update && apt-get install -y rsync
else
    echo "  rsync déjà installé"
fi

# ─── 3. Créer le bare repo Git ───
echo ""
echo "[3/6] Création du dépôt Git bare..."
mkdir -p /var/repo
if [ ! -d "/var/repo/tentacle.git" ]; then
    git init --bare /var/repo/tentacle.git
    echo "  Dépôt créé: /var/repo/tentacle.git"
else
    echo "  Dépôt déjà existant"
fi

# ─── 4. Créer les dossiers de déploiement ───
echo ""
echo "[4/6] Création des dossiers..."
mkdir -p /var/repo/tentacle-source
mkdir -p /var/www/tentacle
mkdir -p /opt/tentacle-backend

chown -R www-data:www-data /var/www/tentacle
chown -R www-data:www-data /opt/tentacle-backend

echo "  /var/repo/tentacle-source  (code source)"
echo "  /var/www/tentacle          (frontend Nginx)"
echo "  /opt/tentacle-backend      (backend Node.js)"

# ─── 5. Créer le fichier .env de production ───
echo ""
echo "[5/6] Fichier .env de production..."
if [ ! -f "/opt/tentacle-backend/.env" ]; then
    cat > /opt/tentacle-backend/.env <<'ENVEOF'
# ══════════════════════════════════════════════════
# TENTACLE — Configuration Production
# ══════════════════════════════════════════════════

# ─── Jellyfin (Backend only) ───
JELLYFIN_URL=http://changeme:8096
JELLYFIN_ADMIN_API_KEY=changeme

# ─── Base de données : rien à régler ───
# Depuis la 1.25, le serveur garde ses données dans data/tentacle.db (SQLite).
# DATABASE_URL ne sert plus qu'à MIGRER une ancienne MariaDB : ne le posez pas ici.

# ─── Backend ───
PORT=3001
CORS_ORIGIN=https://tentacle.example.com

# ─── Frontend (injecté au build) ───
VITE_JELLYFIN_URL=http://172.16.1.30:8096
VITE_BACKEND_URL=
ENVEOF

    chown www-data:www-data /opt/tentacle-backend/.env
    chmod 600 /opt/tentacle-backend/.env
    echo "  .env créé dans /opt/tentacle-backend/.env"
    echo ""
    echo "  ╔══════════════════════════════════════════════════╗"
    echo "  ║  IMPORTANT: Éditer /opt/tentacle-backend/.env   ║"
    echo "  ║  - Vérifier JELLYFIN_URL et API_KEY              ║"
    echo "  ║  - Vérifier VITE_JELLYFIN_URL                    ║"
    echo "  ╚══════════════════════════════════════════════════╝"
else
    echo "  .env déjà existant (non écrasé)"
fi

# ─── 6. Installer le hook post-receive et le service systemd ───
echo ""
echo "[6/6] Installation du hook et du service..."

# Le hook sera copié manuellement ou via le premier push
echo "  Hook post-receive: à copier manuellement (voir ci-dessous)"

# Service systemd
cat > /etc/systemd/system/tentacle-backend.service <<'SVCEOF'
[Unit]
Description=Tentacle Backend API
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/tentacle-backend
EnvironmentFile=/opt/tentacle-backend/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tentacle-backend
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/tentacle-backend

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable tentacle-backend
echo "  Service tentacle-backend installé et activé"

echo ""
echo "================================================="
echo "  Setup terminé !"
echo ""
echo "  Prochaines étapes:"
echo "  1. nano /opt/tentacle-backend/.env  (modifier les mots de passe)"
echo "  2. Copier le hook post-receive (voir README)"
echo "  3. Depuis ton PC: git push integration main"
echo "================================================="
