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
  memoryLocalCache,
  getDocFromServer
} from 'firebase/firestore';
// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

// Diagnostic check for common setup issues
if (!firebaseConfig.authDomain) {
  console.warn("Firebase Auth Domain is missing in config. Google Sign-in may not work until provisioned.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable ultra-stable connection for mobile APKs
const dbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.trim() !== "") 
  ? firebaseConfig.firestoreDatabaseId 
  : "(default)";

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Bypass WebSocket blocks on mobile networks
  localCache: memoryLocalCache() // Avoid disk I/O hangs on mobile devices
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
  getDocFromServer,
  limit,
  Timestamp,
  deleteDoc,
  where,
  increment,
  updateDoc
};
