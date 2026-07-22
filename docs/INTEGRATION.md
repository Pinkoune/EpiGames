# Relier un jeu au portail Epigames

Ce document s'adresse aux **devs de jeux du groupe**. Il explique comment un
jeu, hébergé dans son propre repo et son propre déploiement, peut :

- débloquer ses **succès** sur le portail ;
- recevoir les **notifications** du portail (ami en ligne, message, invitation)
  pour les afficher dans sa propre UI ;
- connaître le **joueur connecté** (pseudo, avatar) sans page de login.

Le tout **sans SSO, sans partager de base Firebase, sans backend**.

---

## 1. Le principe en une phrase

> Le jeu n'écrit jamais dans la base du portail. Il **envoie un message** à la
> fenêtre du portail, et c'est le **portail** qui écrit, avec le compte du
> joueur déjà connecté chez lui.

C'est du `postMessage` navigateur, rien d'autre. Conséquences directes :

- pas de jeton à signer, pas de Cloud Function, pas de projet Firebase couplé
  (c'est justement ce que la note « Phase 2 — SSO » du portail demande de ne
  pas construire pour l'instant) ;
- ton jeu garde **son** Firebase, ou n'en a aucun ;
- un même build fonctionne **sur le portail et en standalone** : hors portail,
  toutes les fonctions du SDK deviennent des no-ops.

### Ce que ça ne fait pas

Ce pont n'authentifie pas ton jeu auprès d'un backend. Si ton jeu a besoin
d'écrire dans **sa propre** base au nom du joueur Epigames, c'est le SSO de la
phase 2 qu'il faut, pas ce pont.

**Ce n'est pas un anti-triche.** Comme tout le portail, le modèle est
client-authoritative : un joueur qui ouvre la console peut forger un déblocage
d'un succès d'un jeu auquel il a déjà accès. C'est assumé pour un petit groupe
de confiance.

---

## 2. Mise en place (3 étapes)

### Étape 1 — Ajouter le SDK

```html
<script src="https://pinkoune.github.io/EpiGames/epigames-sdk.js"></script>
```

Une seule balise, aucune dépendance, aucun build. Elle expose `window.Epigames`.

### Étape 2 — Cocher « Pont Epigames » sur la fiche du jeu

Page du jeu → **Modifier** → case **Pont Epigames**.

Nécessaire : le portail ne dialogue qu'avec les jeux qui l'ont déclaré, et pour
un jeu `web` (ouvert dans un onglet) c'est cette case qui fait garder le canal
retour vivant.

### Étape 3 — Donner un `code` à chaque succès

Page du jeu → **Proposer un succès** (ou modifier un succès existant) → champ
**Code**, par exemple `speedrun_10min`.

Ce code est l'identifiant stable que ton jeu utilise. Un succès sans code reste
un succès « portail », débloqué à la main.

> Rappel : un succès proposé doit être **approuvé par un admin** avant de
> pouvoir être débloqué. Un `unlock()` sur un succès encore en validation est
> ignoré (sans erreur).

---

## 3. L'API

```js
// Le jeu tourne-t-il dans le portail ?
Epigames.available // true / false

// Joueur + succès, une fois la poignée de main faite.
Epigames.onReady((session) => {
  session.user // { uid, displayName, avatar }
  session.achievements // [{ code, title, description, unlocked }]
})

// Débloquer un succès (idempotent : rappeler ne fait rien de plus).
Epigames.unlock('speedrun_10min')

// Déjà débloqué ? (après onReady)
Epigames.hasUnlocked('speedrun_10min') // true / false

// Notifications du portail, à afficher dans TA propre UI.
Epigames.onNotification(({ title, body, icon }) => {
  monHud.afficherBulle(title, body)
})

// Demander au portail d'afficher une de SES bulles.
Epigames.toast('Boss vaincu !', 'Le Roi Gobelin est tombé')
```

`unlock()` peut être appelé **avant** `onReady` : les codes sont mis en file et
envoyés dès que la session arrive.

---

## 4. Template minimal

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Mon jeu</title>
    <script src="https://pinkoune.github.io/EpiGames/epigames-sdk.js"></script>
  </head>
  <body>
    <div id="hud"></div>
    <div id="notifs"></div>

    <script>
      // 1. Qui joue ?
      Epigames.onReady((session) => {
        document.getElementById('hud').textContent =
          'Salut ' + session.user.displayName
      })

      // 2. Notifications du portail dans notre propre HUD
      //    (indispensable si le jeu tourne en plein écran : les bulles du
      //     portail sont alors cachées derrière nous).
      Epigames.onNotification((n) => {
        const el = document.createElement('div')
        el.className = 'ma-bulle'
        el.textContent = n.title + (n.body ? ' — ' + n.body : '')
        document.getElementById('notifs').append(el)
        setTimeout(() => el.remove(), 6000)
      })

      // 3. Débloquer un succès au bon moment
      function onBossVaincu() {
        Epigames.unlock('boss_final')
        Epigames.toast('Boss vaincu !')
      }

      // Hors portail, tout ce qui précède est inoffensif :
      if (!Epigames.available) console.log('Mode standalone')
    </script>
  </body>
</html>
```

---

## 5. Cas concret : RPText (jeu `web`, déjà intégré)

RPText reste en **`kind: 'web'`** : il s'ouvre dans son propre onglet et
communique avec le portail via `window.opener`. L'intégration est faite, elle
sert de référence.

Ce qui a été ajouté côté RPText — trois points, rien de plus :

| Fichier | Rôle |
| --- | --- |
| `index.html` | la balise `<script>` du SDK |
| `src/hooks/useEpigames.ts` | wrapper typé + logique de synchro |
| `src/App.tsx` | un appel `useEpigames()` |

**Le point clé : RPText avait déjà ses propres succès** (`game/achievements.ts`,
avec des `id` stables comme `lvl_10`, `kills_1000`, `biomes_all`). On ne les a
donc pas réécrits — l'`id` RPText **est** le `code` côté portail, et le hook
miroite simplement l'état :

```ts
for (const def of ACHIEVEMENTS) {
  if (isUnlocked(player, def)) Epigames.unlock(def.id)
}
```

On miroite l'état **atteint** (`value >= goal`), pas le « réclamé » : le joueur
n'a pas à passer chercher sa récompense pour que le portail reflète l'exploit.
Un `Set` local évite de renvoyer les mêmes codes à chaque mutation du joueur.

Les notifications du portail passent dans le système de toasts existant de
RPText — **obligatoire pour un jeu `web`** : le jeu est dans un autre onglet,
les bulles du portail y sont invisibles.

### Deux limites propres au mode `web`

1. **Le pont ne marche que si le joueur lance le jeu depuis le portail**
   (bouton ▶ Jouer). Ouvert par favori ou URL directe, il n'y a pas d'`opener`,
   donc pas de pont — le jeu tourne normalement, sans succès portail.
2. Il faut **cocher « Pont Epigames »** sur la fiche du jeu : c'est cette case
   qui fait lâcher `noopener` à l'ouverture, sans quoi le canal retour est
   coupé par le navigateur.

Reste à faire côté portail : créer les succès correspondants (page du jeu →
Proposer un succès) en renseignant le **même code** que l'id RPText, puis les
faire approuver. Un code sans succès approuvé en face est simplement ignoré,
donc tu peux les ajouter au fur et à mesure.

### Et pour un futur jeu en `embedded` ?

Le pont y est plus confortable : pas d'onglet séparé, statut « joue à »
précis, et les bulles du portail sont **déjà visibles** par-dessus l'iframe
(`onNotification` ne devient utile qu'en plein écran). Condition :
l'hébergement doit autoriser le framing — GitHub Pages / Netlify OK,
⚠️ **pas itch.io** (challenge Cloudflare en 403 dans l'iframe).

---

## 6. Détails de sécurité (pour info)

- Le portail n'accepte que les messages dont l'`origin` correspond à
  l'`launchUrl` enregistrée du jeu. Un autre site ne peut pas piloter le pont.
- Le SDK n'accepte que les messages venant de la fenêtre portail qu'il connaît.
- Rien de secret ne circule : jamais de jeton, jamais de credential.
- Le déblocage repose sur la règle Firestore existante « un membre ne peut
  basculer que **sa propre** clé `unlockedBy` sur un succès **approuvé** » — le
  pont n'a donc besoin d'aucune permission nouvelle.

---

## 7. Idées pour aller plus loin

Non implémenté à ce jour, par ordre d'intérêt :

1. **Reprise de partie** — le jeu stocke un petit blob de sauvegarde côté
   portail, pour retrouver sa partie sur un autre appareil.
2. **Scores / classements** — un `Epigames.score(n)` alimentant un leaderboard
   entre amis sur la page du jeu.
3. **Rejoindre un ami** — le portail transmet au jeu l'ami visé par une
   invitation, pour un lobby direct.
4. **Rich presence** — au lieu de « joue à RPText », « RPText — Chapitre 3 »,
   via un `Epigames.status('Chapitre 3')`.

Tous passeraient par le même pont, sans SSO.
