 // Imported Functions
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
  import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js ";

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

  // Submit Button
  const submit = document.getElementById('submit');
    submit.addEventListener('click', function(event) {
      event.preventDefault();
      // Inputs
      const email = document.getElementById('Email').value;
      const password = document.getElementById('Password').value;
      
      createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Signed up 
      const user = userCredential.user;
      //Stores current user ID in local storage
      localStorage.setItem("hf_user_id", user.uid);
      //Opens up intro page for new users
      window.location.href = "/docs/intro.html";
      // ...
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      alert(errorMessage);
      // ..
    });
  });
