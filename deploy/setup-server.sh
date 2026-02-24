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
echo "[1/7] Installation de pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
    echo "  pnpm $(pnpm -v) installé"
else
    echo "  pnpm $(pnpm -v) déjà installé"
fi

# ─── 2. Installer rsync (si absent) ───
echo ""
echo "[2/7] Vérification de rsync..."
if ! command -v rsync &> /dev/null; then
    apt-get update && apt-get install -y rsync
else
    echo "  rsync déjà installé"
fi

# ─── 3. Créer le bare repo Git ───
echo ""
echo "[3/7] Création du dépôt Git bare..."
mkdir -p /var/repo
if [ ! -d "/var/repo/tentacle.git" ]; then
    git init --bare /var/repo/tentacle.git
    echo "  Dépôt créé: /var/repo/tentacle.git"
else
    echo "  Dépôt déjà existant"
fi

# ─── 4. Créer les dossiers de déploiement ───
echo ""
echo "[4/7] Création des dossiers..."
mkdir -p /var/repo/tentacle-source
mkdir -p /var/www/tentacle
mkdir -p /opt/tentacle-backend

chown -R www-data:www-data /var/www/tentacle
chown -R www-data:www-data /opt/tentacle-backend

echo "  /var/repo/tentacle-source  (code source)"
echo "  /var/www/tentacle          (frontend Nginx)"
echo "  /opt/tentacle-backend      (backend Node.js)"

# ─── 5. Créer la base de données MariaDB ───
echo ""
echo "[5/7] Configuration de MariaDB..."
echo "  Création de la base de données et de l'utilisateur..."

# Mot de passe à changer !
DB_PASSWORD="CHANGE_MOI_MOT_DE_PASSE"

mysql -u root <<EOF || echo "  (DB peut-être déjà existante, vérifier manuellement)"
CREATE DATABASE IF NOT EXISTS tentacle CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'tentacle'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON tentacle.* TO 'tentacle'@'localhost';
FLUSH PRIVILEGES;
EOF
echo "  Base 'tentacle' prête"

# ─── 6. Créer le fichier .env de production ───
echo ""
echo "[6/7] Fichier .env de production..."
if [ ! -f "/opt/tentacle-backend/.env" ]; then
    cat > /opt/tentacle-backend/.env <<'ENVEOF'
# ══════════════════════════════════════════════════
# TENTACLE — Configuration Production
# ══════════════════════════════════════════════════

# ─── Jellyfin (Backend only) ───
JELLYFIN_URL=http://172.16.1.30:8096
JELLYFIN_ADMIN_API_KEY=4a5785698c084c6d9bf99400517596e9

# ─── MariaDB ───
DATABASE_URL=mysql://tentacle:CHANGE_MOI_MOT_DE_PASSE@localhost:3306/tentacle

# ─── Backend ───
PORT=3001
JWT_SECRET=CHANGE_MOI_UNE_LONGUE_CHAINE_ALEATOIRE
CORS_ORIGIN=https://tentacle.rouge-informatique.ch

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
    echo "  ║  - Changer CHANGE_MOI_MOT_DE_PASSE             ║"
    echo "  ║  - Changer JWT_SECRET                            ║"
    echo "  ║  - Vérifier JELLYFIN_URL et API_KEY              ║"
    echo "  ║  - Vérifier VITE_JELLYFIN_URL                    ║"
    echo "  ╚══════════════════════════════════════════════════╝"
else
    echo "  .env déjà existant (non écrasé)"
fi

# ─── 7. Installer le hook post-receive et le service systemd ───
echo ""
echo "[7/7] Installation du hook et du service..."

# Le hook sera copié manuellement ou via le premier push
echo "  Hook post-receive: à copier manuellement (voir ci-dessous)"

# Service systemd
cat > /etc/systemd/system/tentacle-backend.service <<'SVCEOF'
[Unit]
Description=Tentacle Backend API
After=network.target mariadb.service
Wants=mariadb.service

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
