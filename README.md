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
npm run dev
```

- Le site est sur http://localhost:5173 (Vite, rechargement à chaud) ; le serveur de jeu tourne sur le port 3000.
- Pour tester sur un vrai téléphone, ouvre l'adresse « Network » affichée par Vite (même Wi-Fi).
- Pour jouer seul, ajoute des joueurs automatiques à une partie : `npm run bots -w @umbra/server -- CODE 2`.
  - `--team loups` place le premier bot dans une équipe (mode Équipe) ;
  - `--start` fait lancer la partie par le bot hôte : une partie 100 % bots se joue devant l'écran principal.
- Les illustrations sont converties de `assets/` (PNG) en WebP légers avec `npm run cards -w @umbra/web`.
- Galerie des effets visuels (développement uniquement) : http://localhost:5173/dev/effets

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
