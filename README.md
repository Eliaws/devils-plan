# Umbra

*Umbra* (anciennement « Chasseurs de l'Ombre ») est un jeu de cartes : de 3 à 12 joueurs, chacun sur son téléphone, avec un écran partagé optionnel (TV ou ordinateur) qui affiche le plateau.

- Plan de développement : [docs/PLAN.md](docs/PLAN.md)
- Règles du livret : [docs/regles_chasseurs_de_lombre.pdf](docs/regles_chasseurs_de_lombre.pdf)
- Règles précises appliquées par le code : [docs/regles-numeriques.md](docs/regles-numeriques.md)
- Héberger le jeu sur son serveur : [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)

## Structure

| Paquet | Rôle |
|---|---|
| `packages/engine` | Moteur de règles en TypeScript pur : `createGame`, `apply(state, action)`, `viewFor`, `eventsFor` |
| `packages/protocol` | Contrat client/serveur : événements Socket.IO typés et schémas Zod |
| `apps/server` | Serveur Node + Socket.IO : salons, reconnexion, sert le site compilé |
| `apps/web` | Site React (Vite, Tailwind) : accueil, lobby, écran Joueur (mobile), écran Table (TV) |

## Prérequis

**Node 24 (LTS)**, qui inclut npm 11. Debian fournit une version ancienne de Node (20). Deux façons d'installer la bonne :

- avec [nvm](https://github.com/nvm-sh/nvm) : `nvm install 24` ;
- avec le dépôt apt officiel de [NodeSource](https://github.com/nodesource/distributions) :

```bash
sudo apt remove nodejs npm
curl -fsSL https://deb.nodesource.com/setup_24.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt install nodejs
```

## Développer

```bash
npm install
cp apps/server/.env.example apps/server/.env   # puis renseigner GIPHY_API_KEY (facultatif)
npm run dev
```

- Le site est sur http://localhost:5173 (Vite, rechargement à chaud) ; le serveur de jeu tourne sur le port 3000.
- Pour tester sur un vrai téléphone, ouvre l'adresse « Network » affichée par Vite (même Wi-Fi).
- Pour jouer seul, ajoute des joueurs automatiques à une partie : `npm run bots -w @umbra/server -- CODE 2`.
  - `--team loups` place le premier bot dans une équipe (mode Équipe) ;
  - `--start` fait lancer la partie par le bot hôte : une partie 100 % bots se joue devant l'écran principal.
- Les illustrations sont converties de `assets/` (PNG) en WebP légers avec `npm run cards -w @umbra/web`.
- Galerie des effets visuels (développement uniquement) : http://localhost:5173/dev/effets
- Les icônes de l'application installable sont générées avec `npm run icons -w @umbra/web`.

### Portraits et GIF

- Chaque joueur choisit son **portrait de chasseur** dans le lobby, parmi 10 dessins SVG (de « La Traqueuse » à « Sire Poulet ») ; il s'affiche sur les jetons de l'écran principal et dans l'ordre de passage. Le portrait est un simple identifiant (`AVATARS` dans `packages/protocol`), ce qui laisse la place à une photo importée plus tard.
- Les joueurs peuvent envoyer des **GIF** (bouton « GIF » à côté des émojis) qui s'affichent au-dessus de leur jeton sur l'écran principal. La recherche passe par le serveur : la clé GIPHY se met dans `apps/server/.env` (`GIPHY_API_KEY=…`), **jamais dans le code ni dans git** ; les téléphones ne la voient pas. Sans clé, le bouton GIF n'apparaît pas.

### Application installable (PWA)

Le jeu s'installe comme une application, sans store : bouton « Installer l'application » sur l'accueil.
- **Android (Chrome, Edge, Samsung Internet)** : le bouton ouvre la fenêtre d'installation du navigateur.
- **iPhone / iPad** : Apple n'autorise pas cette fenêtre ; le bouton affiche l'aide « Partager → Sur l'écran d'accueil ».
- Le bouton n'apparaît pas si le jeu est déjà installé, ni sur les navigateurs qui ne savent pas installer d'application.

Le service worker (généré au build par `vite-plugin-pwa`, absent en développement) met en cache le code et les illustrations ; la page elle-même vient toujours du réseau, donc une mise à jour du jeu est prise en compte au rechargement suivant. Au démarrage et à chaque retour sur l'application, le site compare sa version à celle du serveur (`/version`) et se recharge une fois s'il est resté sur une ancienne version.

Vérifications :

```bash
npm test
npm run typecheck
npm run lint
```

`npm run format` corrige le formatage et les imports (Biome).

## Production

```bash
npm run build
npm start
```

Un seul processus sert le site et le temps réel sur le port 3000 (`PORT` pour le changer). Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).
