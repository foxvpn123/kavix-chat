import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  setDoc, 
  getDoc,
  limit,
  Timestamp,
  deleteDoc,
  where,
  increment,
  updateDoc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

// Diagnostic check for common setup issues
if (!firebaseConfig.authDomain) {
  console.warn("Firebase Auth Domain is missing in config. Google Sign-in may not work until provisioned.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable offline persistence for better mobile APK performance
const dbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.trim() !== "") 
  ? firebaseConfig.firestoreDatabaseId 
  : "(default)";

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({}) 
}, dbId);

export { 
  signInAnonymously, 
  onAuthStateChanged, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  limit,
  Timestamp,
  deleteDoc,
  where,
  increment,
  updateDoc
};
