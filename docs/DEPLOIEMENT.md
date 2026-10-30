# Héberger Umbra sur son serveur

Le jeu tourne dans **un seul processus Node**. Il sert le site compilé et gère les connexions temps réel (WebSocket), sur un seul port (3000 par défaut). Aucune base de données : les parties vivent en mémoire.

Il faut donc un serveur capable de faire tourner Node en continu : un VPS ou une machine à toi. Un hébergement mutualisé « PHP + FTP » ne convient pas.

## 1. Installer et compiler

Sur le serveur, avec **Node 24** (via NodeSource ou nvm, voir le README) :

```bash
git clone https://github.com/Eliaws/devils-plan.git umbra
cd umbra
npm ci
npm run build
```

Test rapide :

```bash
npm start
```

Le site répond alors sur `http://IP-DU-SERVEUR:3000`, et `http://IP-DU-SERVEUR:3000/health` renvoie `ok`.

Variables d'environnement :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute |
| `HOST` | `0.0.0.0` | Interface d'écoute (`127.0.0.1` si seul le proxy doit y accéder) |
| `DATA_FILE` | `apps/server/data/rooms.json` | Sauvegarde des parties en cours |
| `GIPHY_API_KEY` | *(aucune)* | Clé GIPHY pour les réactions en GIF ; sans elle, les GIF sont désactivés |

Les variables peuvent aussi être placées dans `apps/server/.env` (lu au démarrage par `npm start`, modèle dans `apps/server/.env.example`). C'est l'endroit conseillé pour la clé GIPHY : ce fichier est ignoré par git, ne le commite jamais, et protège-le (`chmod 600 apps/server/.env`). Sur Infomaniak, crée ce fichier sur le serveur (SSH ou gestionnaire de fichiers), ou déclare la variable dans les variables d'environnement du site Node.js. Au démarrage, le journal indique « GIF activés » ou « GIF désactivés ».

**Vérifier ce qui est en ligne** : `https://ton-site/version` renvoie le commit qui tourne et l'état des GIF (`{"version":"abc1234","gifs":true}`), et le bas de l'accueil affiche le commit du site compilé. Les deux doivent correspondre au dernier commit de `main` ; sinon, le build n'a pas été relancé après le `git pull`.

Les parties en cours sont **sauvegardées sur disque** (au plus une écriture par seconde) et rechargées au démarrage : un redémarrage ou une mise à jour ne les efface plus, les joueurs retrouvent leur place en rechargeant la page. Le dossier de sauvegarde doit rester en place d'un déploiement à l'autre (il est ignoré par git).

## 2. Le lancer en service (systemd)

`/etc/systemd/system/umbra.service` :

```ini
[Unit]
Description=Umbra
After=network.target

[Service]
Type=simple
User=umbra
WorkingDirectory=/home/umbra/umbra
Environment=NODE_ENV=production PORT=3000 HOST=127.0.0.1
EnvironmentFile=-/home/umbra/umbra/apps/server/.env
ExecStart=/usr/bin/node apps/server/src/index.ts
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Adapte `User`, `WorkingDirectory` et le chemin de `node` (`which node`). Puis :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now umbra
```

## 3. Nom de domaine et HTTPS

### Avec Caddy (le plus simple : HTTPS automatique)

`/etc/caddy/Caddyfile` :

```
jeu.mon-site.fr {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy gère tout seul les certificats et les WebSockets.

### Avec nginx

```nginx
server {
    server_name jeu.mon-site.fr;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 1h;
    }
}
```

Les en-têtes `Upgrade` et `Connection` sont indispensables pour les WebSockets. Le certificat HTTPS s'ajoute avec certbot (`sudo certbot --nginx`).

### Application installable

L'installation sur téléphone exige le **HTTPS** (fourni par Caddy, certbot ou Infomaniak). Si un proxy ajoute ses propres en-têtes de cache, il ne doit pas mettre en cache longtemps `/sw.js` ni `/index.html` : c'est par eux que les téléphones découvrent une nouvelle version.

## 4. Mettre à jour

```bash
git pull
npm ci
npm run build
sudo systemctl restart umbra
```

Les parties en cours sont sauvegardées et reprennent après le redémarrage ; pendant les quelques secondes de coupure, les téléphones se reconnectent tout seuls.
