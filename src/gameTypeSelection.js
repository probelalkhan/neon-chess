import './gameTypeSelection.css'
import { createRoom, joinRoomByCode, joinMatchmaking, watchMatchmaking } from './db.js'
import { getCurrentUser } from './auth.js'

export function renderGameTypeSelectionPage() {
  return `
    <div class="selection-container">
      <div class="top-controls">
        <button id="back-to-login" class="back-btn">← Sign Out</button>
        <button id="fullscreen-btn" class="fullscreen-btn">⤢ Full Screen</button>
      </div>
      
      <div class="selection-header">
        <h1 class="selection-title">Choose Your Game</h1>
        <p class="selection-subtitle">Select a game mode to begin</p>
      </div>
      
      <div class="cards-container">
        <!-- Random Match Card -->
        <div class="game-mode-card card-random" id="random-match-card">
          <div class="card-icon">🎲</div>
          <h2 class="card-title">Play Random</h2>
          <p class="card-description">Get matched with a random player online and start playing immediately</p>
          <div id="random-status" class="status-text"></div>
          <button class="card-button" id="random-btn">Find Match</button>
        </div>
        
        <!-- Join Player Card -->
        <div class="game-mode-card card-join" id="join-player-card">
          <div class="card-icon">🔗</div>
          <h2 class="card-title">Join Player</h2>
          <p class="card-description">Enter a friend's room code to join their game</p>
          <div class="join-input-container">
            <input 
              type="text" 
              id="join-room-input" 
              class="join-code-input" 
              placeholder="ENTER CODE"
              maxlength="6"
            />
          </div>
          <div id="join-error" class="error-text"></div>
          <button class="card-button" id="join-room-btn">Join Room</button>
        </div>
        
        <!-- Create Room Card -->
        <div class="game-mode-card card-create" id="create-room-card">
          <div class="card-icon">➕</div>
          <h2 class="card-title">Create Room</h2>
          <p class="card-description">Create a private room and share the code with a friend</p>
          <button class="card-button" id="create-btn">Create Room</button>
        </div>
      </div>
    </div>
  `
}

export function initGameTypeSelectionPage(onNavigate) {
  let matchmakingUnsubscribe = null

  // Random Match
  const randomBtn = document.getElementById('random-btn')
  const randomStatus = document.getElementById('random-status')

  randomBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      randomBtn.disabled = true
      randomStatus.textContent = 'Searching for opponent...'
      randomStatus.style.color = 'var(--neon-blue)'

      const result = await joinMatchmaking()

      if (result.waiting) {
        // Set up listener for when match is found
        const user = getCurrentUser()
        matchmakingUnsubscribe = watchMatchmaking(user.uid, (matchData) => {
          if (matchData.matched) {
            if (matchmakingUnsubscribe) matchmakingUnsubscribe()
            onNavigate('game', {
              mode: 'random',
              roomId: matchData.roomId,
              code: matchData.code,
              color: matchData.color
            })
          }
        })
      } else if (result.matched) {
        onNavigate('game', {
          mode: 'random',
          roomId: result.roomId,
          code: result.code,
          color: result.color
        })
      }
    } catch (error) {
      console.error('Matchmaking error:', error)
      randomStatus.textContent = 'Error: ' + error.message
      randomStatus.style.color = '#ff0064'
      randomBtn.disabled = false
    }
  })

  // Join Player
  const joinInput = document.getElementById('join-room-input')
  const joinBtn = document.getElementById('join-room-btn')
  const joinError = document.getElementById('join-error')

  joinBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    const code = joinInput.value.trim().toUpperCase()

    if (!code || code.length !== 6) {
      joinError.textContent = 'Please enter a valid 6-character code'
      joinError.style.display = 'block'
      joinInput.style.borderColor = '#ff0064'
      return
    }

    try {
      joinBtn.disabled = true
      joinError.textContent = ''
      joinError.style.display = 'none'

      const result = await joinRoomByCode(code)
      onNavigate('game', {
        mode: 'join',
        roomId: result.roomId,
        code: result.code,
        color: result.color
      })
    } catch (error) {
      console.error('Join error:', error)
      joinError.textContent = 'Error: ' + error.message
      joinError.style.display = 'block'
      joinInput.style.borderColor = '#ff0064'
      joinBtn.disabled = false
    }
  })

  // Allow enter key to join
  joinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      joinBtn.click()
    }
  })

  joinInput.addEventListener('input', () => {
    joinError.style.display = 'none'
    joinInput.style.borderColor = ''
  })

  // Create Room
  const createBtn = document.getElementById('create-btn')

  createBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      createBtn.disabled = true
      const result = await createRoom('create')
      onNavigate('game', {
        mode: 'create',
        roomId: result.roomId,
        code: result.code,
        color: result.color
      })
    } catch (error) {
      console.error('Create room error:', error)
      alert('Error creating room: ' + error.message)
      createBtn.disabled = false
    }
  })

  // Back to login (sign out)
  const backBtn = document.getElementById('back-to-login')
  backBtn.addEventListener('click', async () => {
    if (matchmakingUnsubscribe) matchmakingUnsubscribe()
    const { signOutUser } = await import('./auth.js')
    await signOutUser()
  })

  // Full Screen Toggle
  const fullscreenBtn = document.getElementById('fullscreen-btn')
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
      fullscreenBtn.textContent = '↙ Exit Full Screen'
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        fullscreenBtn.textContent = '⤢ Full Screen'
      }
    }
  })

  // Listen for fullscreen change events to update button text if exited via Escape key
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      fullscreenBtn.textContent = '⤢ Full Screen'
    } else {
      fullscreenBtn.textContent = '↙ Exit Full Screen'
    }
  })
}
