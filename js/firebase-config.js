import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_gj_o8jGsiDI1b-xRKS7BnmH2RbRXPi0",
  authDomain: "autofleet-veiculos.firebaseapp.com",
  projectId: "autofleet-veiculos",
  storageBucket: "autofleet-veiculos.firebasestorage.app",
  messagingSenderId: "574222809685",
  appId: "1:574222809685:web:0ba6ef1c000f96201872dc",
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.startsWith("SUA_") &&
    !firebaseConfig.projectId.startsWith("SEU_"),
  );
}

let db = null;

if (isFirebaseConfigured()) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { db };
