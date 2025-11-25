import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getAnalytics } from 'firebase/analytics'
import { getDatabase } from 'firebase/database'

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCWa1xoI4uSqTQ5WhV8keO2JD5u-025Y8E",
    authDomain: "neon-chess-6758e.firebaseapp.com",
    projectId: "neon-chess-6758e",
    storageBucket: "neon-chess-6758e.firebasestorage.app",
    messagingSenderId: "60933654358",
    appId: "1:60933654358:web:fef8bab8da50e27a2878f7",
    measurementId: "G-68BZCSBRB4",
    databaseURL: "https://neon-chess-6758e-default-rtdb.asia-southeast1.firebasedatabase.app"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const analytics = getAnalytics(app)
const database = getDatabase(app)
const googleProvider = new GoogleAuthProvider()

export { auth, analytics, database, googleProvider }
