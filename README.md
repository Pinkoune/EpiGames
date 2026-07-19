# 🕹️ EpiGames

Un portail multigaming entre étudiants d'Epitech — façon Steam Big Picture.
Bibliothèque des jeux du groupe, profils, forum (général + bugs/features par
jeu), amis + présence. Les jeux restent hébergés chacun de leur côté — le
portail ne fait que pointer vers eux.

## Démarrage

```bash
npm install
npm run dev          # vraie config si .env présent, sinon mode local
npm run dev:local    # FORCE le mode localStorage (ne touche jamais Firebase)
```

Sans configuration Firebase (ou avec `dev:local`), l'app tourne en **mode
local** : données dans le navigateur, connexion par simple pseudo, deux
onglets = deux utilisateurs. C'est le bac à sable — Claude et les tests
utilisent `dev:local` pour ne jamais écrire dans la vraie base.

## Brancher Firebase (une fois)

1. [console.firebase.google.com](https://console.firebase.google.com) →
   **Ajouter un projet** (Analytics inutile).
2. **Authentication → Get started** → activer **E-mail/Mot de passe** et
   **Google**.
3. **Firestore Database → Créer** (mode production, région `europe-west`).
4. **Realtime Database → Créer** (mode verrouillé) — sert à la présence.
5. **Paramètres du projet → Vos applications → Web `</>`** : enregistrer
   l'app, copier le bloc `firebaseConfig`.
6. `cp .env.example .env` et remplir chaque `VITE_FIREBASE_*` avec ces
   valeurs (`databaseURL` = l'URL de la Realtime Database).
7. Déployer les règles — **obligatoire avant d'inviter qui que ce soit**,
   la config client étant publique :
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase init            # cocher Firestore + Realtime Database, pointer
                            # vers firestore.rules et database.rules.json
   firebase deploy --only firestore:rules,database
   ```
   (ou copier-coller le contenu des deux fichiers dans l'onglet « Règles »
   de la console.)
8. Se connecter une première fois sur le portail, puis dans la console :
   **Firestore → users → ton uid → `isAdmin: true`**. C'est le seul geste
   manuel — ensuite tout se gère depuis la page Admin du portail.

## Déployer sur GitHub Pages

Le workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
build et déploie à chaque push sur `main`.

1. Repo GitHub → **Settings → Pages → Source : GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** : créer les
   7 variables `VITE_FIREBASE_*` (mêmes valeurs que ton `.env` — elles sont
   publiques par design, la sécurité vient des règles).
3. Firebase → **Authentication → Settings → Authorized domains** : ajouter
   `TON-PSEUDO.github.io`, sinon la connexion Google sera refusée en prod.
4. Push sur `main` → l'app est en ligne. (`base: './'` + HashRouter : aucune
   config de chemin à faire.)

## Build

```bash
npm run build   # tsc + vite build — la vérification de référence
```

⚠️ Design client-authoritative pour un petit groupe de confiance : les
règles Firestore/RTDB empêchent l'escalade de privilèges, pas la triche
d'un membre de confiance. Ce n'est pas un système anti-triche.

Voir `CLAUDE.md` pour l'architecture détaillée et la note d'intention
SSO (phase 2).
