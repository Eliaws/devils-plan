# Chasseurs de l'Ombre — Plan de développement

## 1. Vision

Adaptation numérique du jeu de cartes **Chasseurs de l'Ombre**, jouable de 3 à 12 joueurs.

- **Chaque joueur sur son appareil** (téléphone ou PC) : il voit sa main, ses pièces et fait ses choix en secret (mises, cartes jouées, cibles).
- **Un écran partagé optionnel (« vue Table »)** : une TV ou un PC affiche le plateau (monstres, ordre de passage, scores, animations de combat). On peut aussi jouer à distance sans lui, chaque joueur voyant alors le plateau sur son propre écran.
- **Le serveur est le Maître de Jeu** : il gère les pioches, applique les règles, résout les combats et annonce les résultats. Tout le monde joue.
- Pas de bots, pas de comptes utilisateurs : on crée une partie, on partage un code (ou un QR code), on joue.

## 2. Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript** partout | Un seul langage pour le client, le serveur et les règles ; les types sont partagés. |
| Organisation | **Monorepo, workspaces npm** | Trois paquets qui partagent du code sans publication, avec npm, déjà inclus dans Node. |
| Moteur de règles | **TS pur, sans dépendance** | Testable seul, réutilisable côté serveur et client, aucune dépendance réseau ou UI. |
| Tests | **Vitest 4** | Rapide, natif TS, même config que Vite. (Vitest 5 exige Node 22+ : à mettre à jour une fois Node 24 installé.) |
| Serveur temps réel | **Node.js + Socket.IO** | Rooms intégrées (une room = une partie), reconnexion automatique, solide. Le serveur fait autorité. |
| Validation des messages | **Zod** | Le serveur ne fait jamais confiance au client ; les schémas servent aussi de types. |
| Front | **React + Vite** | Écosystème le plus large, démarrage instantané. |
| Style | **Tailwind CSS** | Mise en page rapide, mobile-first. |
| Animations | **Motion** (ex-Framer Motion) | Retournement de cartes, dégâts, mort d'un monstre, avec très peu de code. |
| QR code pour rejoindre | **qrcode.react** | La vue Table affiche un QR code, les joueurs scannent pour rejoindre. |
| Stockage des parties | **En mémoire** (V1) | Parties éphémères, aucune base de données. Redis plus tard si besoin de plusieurs instances. |
| Hébergement | **Fly.io**, Render ou Railway | Un seul process Node qui sert le front compilé et les WebSockets. Éviter Vercel/Netlify (pas de WebSocket persistant). |

**Alternative écartée — boardgame.io** : conçu pour ce type de jeu, mais peu maintenu depuis 2023.
**Alternative possible — Colyseus** : rooms, reconnexion et matchmaking prêts à l'emploi, mais son système de synchronisation d'état fait doublon avec un moteur de règles pur. À reconsidérer seulement si la gestion des rooms devient pénible.

## 3. Architecture

```
jeuKenhy/
├── packages/
│   └── engine/          # Règles du jeu : TS pur, 100 % testé
│       ├── cards.ts     # Données des cartes (monstres, équipements, spéciales)
│       ├── state.ts     # Types de l'état de partie
│       ├── reducer.ts   # (état, action) -> { état, événements }
│       ├── view.ts      # Projection de l'état selon qui regarde (infos cachées)
│       └── rng.ts       # Aléatoire avec graine (parties rejouables, tests)
├── apps/
│   ├── server/          # Socket.IO : lobby, rooms, relais vers le moteur
│   └── web/             # React : écrans Accueil, Joueur, Table
├── assets/              # Illustrations des cartes
└── docs/
```

### Principes clés

1. **Le moteur est une fonction pure** : `apply(state, action) → { state, events }`. Aucune I/O. On peut jouer une partie entière dans un test unitaire.
2. **Le serveur fait autorité** : le client envoie une intention (`PLACE_BID`, `PLAY_CARDS`…), le serveur la valide via le moteur, puis envoie à chacun **sa propre vue** de l'état.
3. **Les informations secrètes ne quittent jamais le serveur** : `view(state, viewer)` retire les mains adverses, les mises pas encore révélées, les PV restants des monstres (révélés par L'Éclaireur), la pioche. La vue Table est un « viewer » sans main.
4. **Les événements pilotent les animations** : le moteur émet `MONSTER_DAMAGED`, `MONSTER_KILLED`, `ATTACK_REDIRECTED`, `SPECIAL_CARD_WON`… La vue Table les rejoue un par un, avec des animations.
5. **Cartes pilotées par les données** : chaque carte est une entrée dans `cards.ts` (nom, type, valeurs, effet). Équilibrer le jeu = modifier des chiffres, pas du code.
6. **Graine aléatoire** : chaque partie a une graine ; on peut rejouer exactement une partie pour reproduire un bug.

### Machine à états d'une partie

```
LOBBY ──(start)──> ROUND_START (+1 pièce à chacun)
                        │
                        ▼
                    BIDDING (mises secrètes, simultanées)
                        │  révélation, ordre de passage (égalité : tirage au sort)
                        ▼
                    PLANNING (chacun choisit ses cartes, sa cible et ses pièces de boost, en secret)
                        │
                        ▼
                    RESOLUTION (attaques résolues une par une dans l'ordre de passage)
                        │  coups fatals : PV + équipements ; attaque sur monstre mort : redirection
                        ▼
                    ROUND_END (carte Spéciale au meilleur attaquant, remplissage du plateau)
                        │
          ┌─────────────┴─────────────┐
   monstres restants             Faucheuse vaincue
          │                           │
     ROUND_START                  GAME_OVER (classement)
```

Précisions (voir `regles-numeriques.md`) :
- ROUND_START applique aussi les dégâts de Poison en cours.
- En PLANNING, L'Éclaireur se résout immédiatement pour son seul utilisateur.
- En RESOLUTION, un monstre mort est remplacé tout de suite ; une attaque sur son emplacement frappe le remplaçant.
- Option « Sceau en réaction » : une courte fenêtre de réaction s'ouvre avant chaque action résolue.

### Écrans

| Route | Écran | Contenu |
|---|---|---|
| `/` | Accueil | Créer une partie / rejoindre avec un code |
| `/table/:code` | Vue Table (écran partagé) | QR code d'accès, plateau, 3 monstres, ordre de passage, scores, animations de combat |
| `/play/:code` | Vue Joueur (mobile-first) | Pseudo, main, pièces, mise, choix des cartes et de la cible, résumé du plateau |

Reconnexion : un jeton joueur est stocké dans `localStorage`. Un rafraîchissement de page ou une coupure réseau ramène le joueur à sa place.

## 4. Feuille de route

### Phase 0 — Figer les règles numériques ✅
Fait : voir `docs/regles-numeriques.md`.

### Phase 1 — Moteur de règles (le cœur) ✅
Fait : `packages/engine`, 58 tests dont 120 parties complètes simulées.

- Données de toutes les cartes.
- Mise en place : pioche monstres, Faucheuse au fond, 3 monstres révélés, Lame du Chasseur à chacun.
- Pièces, mises, ordre de passage, boost.
- Résolution des attaques : dégâts excédentaires perdus, coup fatal, récompenses (max 2 équipements), redirection.
- Défausse des équipements, retour de la Lame du Chasseur en main.
- Carte Spéciale au meilleur attaquant de la manche (rien si la pioche est vide).
- Effets des 7 cartes Spéciales (Sceau d'annulation en mode « planifié »).
- Fin de partie et classement.
- **Livrable** : une partie complète simulée en test unitaire.

### Phase 2 — Serveur et lobby
- Créer une room (code de 4 lettres), rejoindre, choisir un pseudo, lancer la partie (3 joueurs minimum).
- Relais des actions vers le moteur, envoi des vues filtrées.
- Reconnexion, départ d'un joueur, nettoyage des parties abandonnées.
- **Livrable** : une partie jouable avec des clients de test minimalistes.

### Phase 3 — Vue Joueur (mobile)
- Rejoindre, attendre dans le lobby, miser, choisir cartes, cible et boost, voir les résultats.
- **Livrable** : une partie jouable de bout en bout, chacun sur son téléphone.

### Phase 4 — Vue Table (écran partagé)
- Plateau, QR code, ordre de passage, scores.
- File d'événements animée : attaques, dégâts, mort d'un monstre, gain de carte.
- **Livrable** : l'expérience « soirée jeu » complète.

### Phase 5 — Mode Équipes (6 à 12 joueurs)
- Formation des équipes dans le lobby (3 joueurs maximum).
- Canal de planification privé par équipe (actions proposées et validées en commun).
- Attribution des PV et de la carte Spéciale à l'équipe.

### Phase 6 — Finitions
- Illustrations des monstres et équipements (manquantes), dos de cartes, sons.
- Écran de fin et récapitulatif de la partie.
- Déploiement.
- Option de partie « Sceau d'annulation en réaction ».
- Module optionnel des Rôles (une fois les rôles définis).

## 5. Règles numériques

Les 16 questions laissées ouvertes par le livret ont été tranchées. Les réponses sont dans [regles-numeriques.md](regles-numeriques.md), qui fait foi pour le code. Les points marqués 🔧 sont des décisions de détail à relire.

## 6. Risques et points d'attention

- **Règles** : désormais figées dans `regles-numeriques.md`. Toute nouvelle ambiguïté découverte en codant s'y ajoute avant d'être implémentée.
- **Équilibrage** : les valeurs des Équipements sont une première proposition. Les cartes pilotées par les données et les parties simulées dans les tests aideront à équilibrer.
- **PV restants « cachés »** : les cartes jouées étant révélées, un joueur attentif peut recalculer les PV restants. C'est voulu (comme à la table), mais la vue Table n'affiche pas les montants de dégâts.
- **Infos secrètes** : tout filtrage oublié dans `view()` révèle des secrets (visibles dans l'onglet réseau du navigateur). Il faut des tests dédiés : « le joueur A ne voit jamais la main de B ».
- **Réseau mobile** : les téléphones se mettent en veille, d'où l'importance de la reconnexion et d'un état toujours renvoyé en entier.
- **Assets** : les 13 monstres et les 7 cartes Spéciales sont illustrés (`assets/`). Il manque les 8 Équipements et les dos de cartes. On peut avancer avec des cartes en texte.
