// src/firebase-config.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
const firebaseConfig = {
  apiKey: "AIzaSyCGBrOC7ZCJ0y_MWM7EPxQRTw79BrXN5LA",
  authDomain: "findesktickets.firebaseapp.com",
  projectId: "findesktickets",
  storageBucket: "findesktickets.firebasestorage.app",
  messagingSenderId: "652399228669",
  appId: "1:652399228669:web:40871604bbb86ca5163094"
};

const app = initializeApp(firebaseConfig);

// Exporta o Firestore e o Auth para uso em outros arquivos
export const db = getFirestore(app);
export const auth = getAuth(app);
