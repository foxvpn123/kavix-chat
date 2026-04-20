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
} from 'firebase/firestore';
// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

// Diagnostic check for common setup issues
if (!firebaseConfig.authDomain) {
  console.warn("Firebase Auth Domain is missing in config. Google Sign-in may not work until provisioned.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Explicitly use the project's specific database ID for absolute reliability in APKs
export const db = getFirestore(app, "ai-studio-4c336a6c-0741-4cac-948b-5450dbc65c54");

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
