import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDa-BmVx589OF0iiRDyJlWz_RBi9IHEVq8",
  authDomain: "keaktek-e506c.firebaseapp.com",
  projectId: "keaktek-e506c",
  storageBucket: "keaktek-e506c.firebasestorage.app",
  messagingSenderId: "896279203995",
  appId: "1:896279203995:web:9730a2d7acbf748dd1f63e",
  measurementId: "G-59YRVCZS0C"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
