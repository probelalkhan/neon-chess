import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth, googleProvider } from './firebase.js'

let currentUser = null

// Sign in with Google
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider)
        currentUser = result.user
        return result.user
    } catch (error) {
        console.error('Error signing in with Google:', error)
        throw error
    }
}

// Sign out
export async function signOutUser() {
    try {
        await signOut(auth)
        currentUser = null
        localStorage.removeItem('roomCode')
    } catch (error) {
        console.error('Error signing out:', error)
        throw error
    }
}

// Listen to auth state changes
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, (user) => {
        currentUser = user
        callback(user)
    })
}

// Get current user
export function getCurrentUser() {
    return currentUser
}
