import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app'
import { Auth, getAuth } from 'firebase/auth'
import { Firestore, getFirestore } from 'firebase/firestore'
import { FirebaseStorage, getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null

function getFirebaseConfig() {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      'Missing Firebase config. Set NEXT_PUBLIC_FIREBASE_API_KEY and related NEXT_PUBLIC_FIREBASE_* variables.'
    )
  }

  return firebaseConfig
}

export function getFirebaseApp() {
  if (app) return app
  app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig())
  return app
}

export function getFirebaseAuth() {
  if (auth) return auth
  auth = getAuth(getFirebaseApp())
  return auth
}

export function getDb() {
  if (db) return db
  db = getFirestore(getFirebaseApp())
  return db
}

export function getFirebaseStorage() {
  if (storage) return storage
  storage = getStorage(getFirebaseApp())
  return storage
}
