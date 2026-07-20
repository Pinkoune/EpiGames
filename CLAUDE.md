# Epigames — guide de développement

Portail de jeux web façon Steam Big Picture pour un petit groupe d'amis
développeurs. Le portail n'héberge AUCUN jeu : chaque jeu vit dans son propre
repo/déploiement, Epigames est le hub central (bibliothèque, comptes, amis,
demandes/retours par jeu).

## Stack

- Vite + React 19 + TypeScript + Tailwind v4 (`@tailwindcss/vite`) + Zustand
- Firebase : Auth + Firestore (données) + Realtime Database (présence)
- Repli localStorage complet si Firebase n'est pas configuré
- Déploiement statique (GitHub Pages ou équivalent) : `base: './'` + HashRouter

## Commandes

- `npm run dev` — serveur de dev (Firebase si `.env` présent, sinon local)
- `npm run dev:local` — **serveur de dev en mode localStorage FORCÉ**
  (`VITE_BACKEND=local`). C'est ce que `.claude/launch.json` lance : le
  bac à sable de Claude ne touche JAMAIS la vraie base Firebase.
- `npm run build` — **seule vérification fiable** (tsc + vite build).
  Pas de preview live garanti (OAuth peut bloquer l'environnement de dev).
- `npm run lint` — oxlint

Warning connu au build : chunk ~900 kB (SDK Firebase). Acceptable, pas un bug.

## Architecture

### Couche backend (le point central du design)

`src/lib/backend/types.ts` définit l'interface `Backend`. Deux implémentations :

- `firebase.ts` — Firestore + RTDB (présence via `.info/connected` + `onDisconnect`)
- `local.ts` — localStorage (données partagées entre onglets via events `storage`,
  session par onglet via sessionStorage → deux onglets = deux utilisateurs, pratique
  pour tester amis/présence). Présence simulée par heartbeat (online = heartbeat < 45 s).

**Règle absolue : les stores et composants ne parlent qu'à l'interface `Backend`
(`import { backend } from lib/backend`), jamais à Firebase directement.**
La sélection se fait dans `lib/backend/index.ts` : env vars présentes → Firebase,
sinon local. Config via `.env` (voir `.env.example`).

### Modèle de données Firestore

```
users/{uid}          displayName, avatar (emoji | URL Google | data URL 128px),
                     bio, isAdmin, createdAt, seenUpdates{gameId:ts}, linkedUids
games/{gameId}       title, tagline, description (longue, page façon itch.io),
                     kind(web|download|embedded), coverUrl, screenshots[], launchUrl,
                     downloadUrl (bouton téléchargement optionnel des jeux embedded),
                     repoUrl, status(live|dev|planned|paused), tags[], ownerUids[],
                     update{version,text,publishedAt}|null,
                     approved, archived, createdBy, createdAt, updatedAt
  requests/{id}      type(bug|feature), title, description,
                     status(open|planned|in_progress|done|rejected),
                     authorUid, upvotes{uid:true}, createdAt, updatedAt
    comments/{id}    authorUid, text, createdAt
chats/{scopeId}/messages/{id}   authorUid, text, createdAt
                     scopeId = '_portal' (Général du portail) ou un gameId (Général du jeu)
friendships/{a_b}    id = paire uid triée, users[2], requestedBy, status(pending|accepted)
```

- **Forum** (page /forum) : sidebar de triage à gauche (Portail + un bloc par jeu
  visible), chaque bloc a un canal « Général » (chat plat, collection `chats`) et
  « Bugs & features » (les demandes du jeu, réutilisées telles quelles).
  Les demandes DU PORTAIL vivent sous le scope sentinel `PORTAL_SCOPE = '_portal'`
  (`games/_portal/requests/...`, doc parent inexistant — les règles gardent
  `gameId != '_portal'` avant tout `get()` du parent ; triage portail = admin).
- **Markdown** : descriptions de jeu et de demande rendues via `components/Markdown.tsx`
  (marked + DOMPurify, GFM, liens en target _blank). Chat et commentaires restent
  en texte brut.

- `kind: 'download'` = jeu installable (ex. extension Chrome) : `launchUrl` pointe
  vers la page de téléchargement (releases GitHub) ; le bouton devient
  « Télécharger » et ne poste PAS de statut « joue à » (déclaration manuelle
  depuis la page du jeu).
- `kind: 'embedded'` = jeu jouable DIRECTEMENT sur le portail (façon itch.io) :
  `launchUrl` est chargée dans une iframe sur la page du jeu (le site doit
  autoriser l'intégration). Identité VERTE (ruban « ▶ JOUABLE ICI », bouton
  Jouer vert). Le bouton ▶ Jouer poste le statut « joue à » sans ouvrir
  d'onglet. `downloadUrl` (optionnel) ajoute un bouton « Télécharger » juste
  sous le bouton Jouer. Le bouton Jouer des jeux web est aussi vert (façon
  Steam) ; seul le bouton Télécharger reste violet.
- **Workflow de publication** : un dev soumet un jeu → `approved: false`, listé
  uniquement pour ses owners + admins (filtre UI `canSeeGame`, la lecture
  Firestore reste ouverte aux membres — rien de secret, ça garde les requêtes
  simples). Un admin publie (`approved: true`, seul un admin peut toucher ce
  champ). Un admin qui crée publie directement.
- **Clôture façon GitHub** : demande « close » = statut `done` ou `rejected`
  (`isRequestClosed`). L'auteur peut clore (fait/refusé) ou rouvrir SA demande ;
  les états de triage (`planned`, `in_progress`) restent réservés aux owners.
  Fil de commentaires par demande, toujours ouvert même clos.
- **Mises à jour de jeu** : un owner publie UNE annonce courante
  (`game.update`, remplacée à chaque publication, retirable). Encart rendu
  AU-DESSUS de la description (markdown). Badge « MAJ » sur la carte tant que
  `users.seenUpdates[gameId] < update.publishedAt` ; bouton « J'ai vu » →
  `backend.setSeenUpdate`. Pas de collection dédiée : volontairement une seule
  annonce à la fois, pas un changelog.
- **Avatars** : emoji, photo Google (`photoURL` repris à la création du compte)
  ou image importée — recadrée/réduite côté client (128px JPEG, data URL
  < 40 k caractères) et stockée dans le doc user ; les règles plafonnent le
  champ à 50 000 octets. Pas de Firebase Storage.
- Champs ajoutés après coup : `normalizeGame` / `normalizeUser` (types.ts)
  appliquent les défauts aux anciens docs — docs legacy sans `approved` sont
  traités comme publiés.

RTDB : `presence/{uid}` = `{ online, lastSeen, playing: {gameId,title,since}|null }`.
Le statut « joue à » est **déclaratif** (bouton ▶ Jouer poste le statut puis ouvre l'URL).

Timestamps = `Date.now()` (nombres), pas des Timestamp Firestore — cohérent entre
les deux backends.

### Rôles

- **admin portail** : `isAdmin`. Posé UNIQUEMENT par un admin existant (page
  /admin) ou la console Firebase — jamais par l'utilisateur lui-même (verrouillé
  par les règles). Publie/dépublie les jeux soumis, gère les rôles, hard-delete.
- **propriétaire de jeu** : présent dans `ownerUids` du jeu. Édite/archive SON jeu
  et trie les demandes de SON jeu uniquement. Ne peut pas toucher `approved`.
- **membre** : TOUT membre peut soumettre un jeu — via l'encart « Publier un
  jeu » de SA page profil (pas de bouton dans la bibliothèque, pas de rôle
  dédié) ; la soumission attend la validation d'un admin. Poste
  demandes/commentaires, upvote, amis. L'auteur d'une demande peut la
  clore/rouvrir (façon GitHub).

En mode local : premier utilisateur créé = admin (pratique pour tester).

### Pages clés

- **Profil** (/profile/:uid, façon Steam) : header (en ligne / joue à, bio,
  membre depuis), stats (jeux publiés, messages, demandes, upvotes reçus,
  amis), jeux du membre, dernières demandes, et — sur son propre profil —
  l'encart pitch « Publier un jeu » qui ouvre GameFormModal. Tous les
  avatars/noms de l'app pointent vers les profils.
- **Bibliothèque** : sections par statut (Jouables maintenant / En dev /
  À venir / En pause) quand aucun filtre, grille plate en recherche ;
  segmented Tous / Web / À installer ; tags dans un menu déroulant.
- **Statut « je joue »** : déclaré depuis le menu avatar (topbar) — liste des
  jeux live, ou « Arrêter ». Le bouton ▶ Jouer d'un jeu web le pose aussi
  automatiquement. Plus de bouton dédié sur la page jeu.
- **Demandes** : fil de commentaires DÉPLOYÉ par défaut ; filtre segmented
  Tous / Bugs / Features sur la page jeu et le forum.

### Déploiement

GitHub Pages via `.github/workflows/deploy.yml` (push sur main) : config
Firebase lue depuis les Repository **Variables** `VITE_FIREBASE_*`. Ajouter le
domaine `*.github.io` aux Authorized domains de Firebase Auth. Voir README.

### Sécurité

`firestore.rules` + `database.rules.json` sont écrites AVEC le modèle de données
et doivent évoluer avec lui — toute modification du modèle passe par une mise à
jour des règles dans le même commit. La config Firebase (apiKey…) est publique
par design : les règles SONT la frontière de sécurité.

⚠️ Design client-authoritative assumé pour un petit groupe de confiance.
Les règles empêchent l'escalade de privilèges et le sabotage inter-comptes,
**pas la triche d'un membre de confiance devenu malveillant**. Ce n'est pas un
système anti-triche.

Déploiement des règles : console Firebase, ou
`firebase deploy --only firestore:rules,database`.

### Arborescence

```
src/
  lib/
    firebase.ts        init Firebase (null si pas de config → mode local)
    types.ts           types du domaine + labels FR
    hooks.ts           useRequests, useComments (subs par jeu/demande)
    backend/           interface + impl firebase + impl local + sélection
  stores/              zustand : auth, users (annuaire), games, friends, presence
  components/
    ui.tsx             Modal, badges, Avatar, SectionLabel, classes partagées
    auth/ layout/ library/ games/ requests/
  pages/               LibraryPage, GameDetailPage, ForumPage, FriendsPage, AdminPage
```

### Direction visuelle : « console sombre épurée »

Space Grotesk (display) + Inter (body, Google Fonts dans index.html), fond
quasi-noir, UN accent bleu (`--color-accent`), statuts de jeu en points colorés
(pas de pills criardes), nav soulignée, covers 16:9, page jeu façon itch.io
(hero + description + galerie + sidebar méta). Éviter le look « IA générique » :
peu d'émojis dans les boutons, coins peu arrondis, pas de dégradés partout.
Jeux téléchargeables (`kind: 'download'`) = identité VIOLETTE (ruban « À
installer », bouton Télécharger violet, panneau Installation) ; jeux web =
accent bleu. `cursor: pointer` global sur toute surface cliquable (index.css).

## Phase 2 — SSO (note d'intention, NE PAS implémenter)

Objectif : se connecter une fois sur Epigames, lancer n'importe quel jeu du
groupe déjà authentifié. Approche retenue : chaque jeu garde son propre projet
Firebase ; Epigames signe un jeton au lancement (Cloud Function côté Epigames —
seul vrai backend requis), le jeu cible le vérifie et établit sa session.

Réservations déjà en place en phase 1 :
- `users.{uid}.linkedUids: string[]` — uids externes rattachables plus tard.
  Verrouillé en écriture côté client (seul l'Admin SDK / la console y touche).
- Ne pas fusionner les projets Firebase des jeux ; pas de couplage de bases.
