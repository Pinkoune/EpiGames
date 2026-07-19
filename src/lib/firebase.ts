import { initializeApp, type FirebaseApp } from 'firebase/app'

/**
 * Firebase config is read from Vite env vars (see .env.example).
 * The apiKey is public by design (public repo, client-side app):
 * ALL security lives in firestore.rules / database.rules.json.
 *
 * If no config is present, `app` is null and the app runs in
 * localStorage mode (see lib/backend/local.ts).
 *
 * VITE_BACKEND=local forces localStorage mode EVEN IF a Firebase config
 * exists — `npm run dev:local` uses it so local tinkering (Claude included)
 * can never touch the real database.
 */
const forceLocal = import.meta.env.VITE_BACKEND === 'local'
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined

export const firebaseConfig = apiKey && !forceLocal
  ? {
      apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
      appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
    }
  : null

export const app: FirebaseApp | null = firebaseConfig ? initializeApp(firebaseConfig) : null

export const isFirebaseConfigured = app !== null
