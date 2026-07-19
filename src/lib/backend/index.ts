import { app } from '../firebase'
import type { Backend } from './types'
import { FirebaseBackend } from './firebase'
import { LocalBackend } from './local'

/**
 * Backend selection happens once at module load:
 * Firebase env vars present -> FirebaseBackend, otherwise LocalBackend.
 */
export const backend: Backend = app ? new FirebaseBackend(app) : new LocalBackend()

export type { Backend } from './types'
