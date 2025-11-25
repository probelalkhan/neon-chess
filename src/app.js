import { onAuthChange } from './auth.js'
import { renderLoginPage, initLoginPage } from './login.js'
import { renderGameTypeSelectionPage, initGameTypeSelectionPage } from './gameTypeSelection.js'
import { renderGamePage } from './gameTemplate.js'
import { initGame } from './game.js'

let currentPage = null
let gameMode = null

// Initialize the app
function init() {
    // Listen for auth state changes
    onAuthChange((user) => {
        if (user) {
            // User is signed in, show game type selection
            showGameTypeSelectionPage()
        } else {
            // User is signed out, show login page
            showLoginPage()
        }
    })
}

function showLoginPage() {
    if (currentPage === 'login') return
    currentPage = 'login'

    const root = document.getElementById('root')
    root.innerHTML = renderLoginPage()
    initLoginPage()
}

function showGameTypeSelectionPage() {
    if (currentPage === 'selection') return
    currentPage = 'selection'

    const root = document.getElementById('root')
    root.innerHTML = renderGameTypeSelectionPage()
    initGameTypeSelectionPage(navigateToPage)
}

function showGamePage(mode) {
    if (currentPage === 'game') return
    currentPage = 'game'
    gameMode = mode

    const root = document.getElementById('root')
    root.innerHTML = renderGamePage()
    initGame(mode)
}

function navigateToPage(page, options = {}) {
    if (page === 'game') {
        showGamePage(options)
    } else if (page === 'selection') {
        showGameTypeSelectionPage()
    } else if (page === 'login') {
        showLoginPage()
    }
}

// Start the app
init()
