import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDhWlhYXPh34BuOf-kPYbGgYKVFew7fZ_g",
  authDomain: "projetoeclipse-2374b.firebaseapp.com",
  databaseURL: "https://projetoeclipse-2374b-default-rtdb.firebaseio.com",
  projectId: "projetoeclipse-2374b",
  storageBucket: "projetoeclipse-2374b.firebasestorage.app",
  messagingSenderId: "460740273909",
  appId: "1:460740273909:web:fb081ae806b15802a0c7bc",
  measurementId: "G-0806KRDLS2"
}

let app = null
let auth = null
let db = null
let storage = null
let firebaseError = null

try {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getDatabase(app)
  storage = getStorage(app)
} catch (error) {
  firebaseError = error
  console.error('Firebase não pôde ser inicializado:', error)
}

export { app, auth, db, storage, firebaseError }
export default app
