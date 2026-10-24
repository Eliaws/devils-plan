# Chasseurs de l'Ombre

Adaptation numérique du jeu de cartes *Chasseurs de l'Ombre* (3 à 12 joueurs).

- Plan de développement : [docs/PLAN.md](docs/PLAN.md)
- Règles du livret : [docs/regles_chasseurs_de_lombre.pdf](docs/regles_chasseurs_de_lombre.pdf)
- Règles précises appliquées par le code : [docs/regles-numeriques.md](docs/regles-numeriques.md)

## Structure

| Paquet | Rôle |
|---|---|
| `packages/engine` | Moteur de règles en TypeScript pur : `createGame`, `apply(state, action)`, `viewFor`, `eventsFor` |
| `apps/server` | *(phase 2)* Serveur Socket.IO |
| `apps/web` | *(phases 3 et 4)* Vue Joueur et vue Table en React |

## Démarrer

Prérequis : **Node 24 (LTS)**, qui inclut npm 11.

Debian fournit une version ancienne de Node (20) : on installe plutôt celle du dépôt apt officiel de [NodeSource](https://github.com/nodesource/distributions). Le script ci-dessous ajoute ce dépôt ; il est téléchargé d'abord pour pouvoir le lire avant de le lancer.

```bash
sudo apt remove nodejs npm
curl -fsSL https://deb.nodesource.com/setup_24.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt install nodejs
node --version   # v24.x
```

Ensuite, Node se met à jour avec le reste du système (`sudo apt upgrade`).

Puis, à la racine du projet :

```bash
npm install
npm test
npm run typecheck
```

Le projet est un monorepo en **workspaces npm** : chaque dossier de `packages/` et `apps/` est un paquet, et `npm install` à la racine installe tout. Pour lancer une commande dans un seul paquet : `npm run test -w @chasseurs/engine`.
