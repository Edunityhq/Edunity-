import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app'
import { Firestore, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let db: Firestore | null = null

export function getFirebaseApp() {
  if (app) return app
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_* configuration.')
  }
  app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  return app
}

export function getDb() {
  if (db) return db
  db = getFirestore(getFirebaseApp())
  return db
}
