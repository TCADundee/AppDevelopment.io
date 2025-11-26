// firebase.js — Firebase Authentication Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDutgzxX5T6flgVGlFnDRWbQlHwJwcvCaQ",
  authDomain: "appdevelopment-cb848.firebaseapp.com",
  projectId: "appdevelopment-cb848",
  storageBucket: "appdevelopment-cb848.firebasestorage.app",
  messagingSenderId: "347594524052",
  appId: "1:347594524052:web:6714ab36eeddbbb0a9fb81",
  measurementId: "G-9SKBMJ22Q8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Check if user is signed in
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Redirect to index.html if user is signed in
    window.location.href = "index.html";
  } else {
    console.log("No user is signed in");
  }
});
