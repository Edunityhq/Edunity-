import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyB9KTvnJW5gGwU7JjpdJGqezO1DAqOG3QQ',
  authDomain: 'edunity-68cb4.firebaseapp.com',
  projectId: 'edunity-68cb4',
  storageBucket: 'edunity-68cb4.firebasestorage.app',
  messagingSenderId: '398002399600',
  appId: '1:398002399600:web:e5ccf179c0f76fda4b47b5',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const db = getFirestore(app)
