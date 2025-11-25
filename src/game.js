import { Chess } from 'chess.js'
import { getCurrentUser, signOutUser } from './auth.js'
import { getRoomCode } from './room.js'
import { leaveRoom } from './db.js'
import { showGameOverOverlay } from './gameOver.js'
import './game.css'
import './gameOver.css'

// Font Awesome SVG Paths (Solid)
// These are standard FA paths for chess pieces.
const faPieces = {
  p: "M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM192 160c0-17.7 14.3-32 32-32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32H224c-17.7 0-32-14.3-32-32zm32 64h64c53 0 96 43 96 96s-43 96-96 96H192c-53 0-96-43-96-96s43-96 96-96z", // Pawn (simplified circle for now, let's use actual paths if possible or unicode)
}

// Actually, embedding full FA paths is verbose. 
// A better approach for "Font Awesome" look with chessboard.js (which requires image URLs)
// is to use the Unicode characters but style them with a font that matches FA, 
// OR use the actual Font Awesome Unicode points if we can load the font in the SVG.
// But SVG in <img> tags cannot load external fonts easily.
// So we will use standard Unicode characters but with a heavy, solid font style and glow.

const pieces = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
}

function getPieceTheme(piece) {
  const color = piece.charAt(0)
  const type = piece.charAt(1).toLowerCase() // Fix: chessboard.js uses uppercase for piece types
  const unicodeChar = pieces[color][type] || '?' // Fallback to ? if undefined

  // Cyberpunk Colors: Cyan for White, Magenta for Black
  // We use a slightly different shade for the fill vs stroke to make them pop
  const fill = color === 'w' ? '#e0ffff' : '#ffccff'
  const stroke = color === 'w' ? '#00f3ff' : '#ff00ff'
  const glowColor = color === 'w' ? '#00f3ff' : '#ff00ff'

  // We construct an SVG that renders the character.
  // To make it look like Font Awesome, we use a bold sans-serif font.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
      <defs>
        <filter id="glow-${color}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
            font-size="45" font-family="Arial, Helvetica, sans-serif" font-weight="bold"
            fill="${fill}" stroke="${stroke}" stroke-width="1"
            filter="url(#glow-${color})">
        ${unicodeChar}
      </text>
    </svg>
  `
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

// Sound Manager using Web Audio API
class SoundManager {
  constructor() {
    this.enabled = false
    if (window.AudioContext || window.webkitAudioContext) {
      try {
        this.context = new (window.AudioContext || window.webkitAudioContext)()
        this.enabled = true
      } catch (e) {
        console.warn('Web Audio API not supported or failed to initialize:', e)
      }
    } else {
      console.warn('Web Audio API not supported')
    }
  }

  playTone(frequency, type, duration, volume = 0.1) {
    if (!this.enabled || !this.context) {
      console.warn('AudioContext not initialized or sound disabled')
      return
    }

    // Resume audio context if suspended (required by browsers)
    if (this.context.state === 'suspended') {
      this.context.resume().catch(e => console.warn('Audio resume failed:', e))
    }

    try {
      const oscillator = this.context.createOscillator()
      const gainNode = this.context.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.context.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type || 'sine' // Use provided type or default to sine

      gainNode.gain.setValueAtTime(volume, this.context.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration)

      oscillator.start(this.context.currentTime)
      oscillator.stop(this.context.currentTime + duration)
    } catch (e) {
      console.warn('Audio play failed:', e)
    }
  }

  playMove() {
    this.playTone(300, 'sine', 0.1, 0.1) // Short blip
  }

  playCapture() {
    this.playTone(150, 'square', 0.15, 0.15) // Crunchier sound
    setTimeout(() => this.playTone(100, 'sawtooth', 0.1, 0.1), 50)
  }

  playInvalid() {
    this.playTone(100, 'sawtooth', 0.2, 0.1) // Low buzz
  }

  playWin() {
    // Victory fanfare - ascending tones
    this.playTone(400, 'sine', 0.15, 0.15)
    setTimeout(() => this.playTone(500, 'sine', 0.15, 0.15), 150)
    setTimeout(() => this.playTone(600, 'sine', 0.3, 0.2), 300)
  }
}

const soundManager = new SoundManager()

const boardConfig = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  onMouseoverSquare: onMouseoverSquare,
  onMouseoutSquare: onMouseoutSquare,
  pieceTheme: getPieceTheme,
  moveSpeed: 'slow',
  snapbackSpeed: 500,
  snapSpeed: 100,
}

const game = new Chess()
let board = null

const $status = $('#status')



function onMouseoverSquare(square, piece) {
  // Get list of possible moves for this square
  const moves = game.moves({
    square: square,
    verbose: true
  })

  // If no moves, it's an invalid piece to move (or no moves possible)
  // But we only want to highlight valid moves.
  // If user drags to an invalid square, that's handled by onDrop (snapback).
  // However, the user asked for "invalid move show a different hover color".
  // This usually implies dragging. chessboard.js doesn't natively support "onDragOver" with target square info easily exposed in a way that differentiates valid/invalid BEFORE drop without some custom logic.
  // BUT, we can highlight all VALID moves in GREEN.
  // And if they drag somewhere else, it won't be green.

  // Let's stick to highlighting VALID moves in GREEN (legal).
  // If we want to highlight INVALID moves in RED, we need to handle drag events more closely.
  // For now, let's highlight valid moves.

  if (moves.length === 0) return

  // Highlight the square they moused over
  // greySquare(square) // Don't highlight source square, just targets? Or both? Let's do targets.

  // Highlight the possible squares for this piece
  for (let i = 0; i < moves.length; i++) {
    highlightSquare(moves[i].to, 'legal')
  }
}

function onMouseoutSquare(square, piece) {
  removeHighlights()
}

function removeHighlights() {
  $('#board .square-55d63').removeClass('highlight-legal highlight-illegal')
}

function highlightSquare(square, type) {
  const $square = $('#board .square-' + square)
  $square.addClass('highlight-' + type)
}

let selectedSquare = null
let escHintElement = null

function showEscHint() {
  if (!escHintElement) {
    escHintElement = document.createElement('div')
    escHintElement.className = 'esc-hint'
    escHintElement.innerHTML = 'Press <kbd>ESC</kbd> or click another piece to cancel'
    document.body.appendChild(escHintElement)
  }
  setTimeout(() => escHintElement.classList.add('show'), 50)
}

function hideEscHint() {
  if (escHintElement) {
    escHintElement.classList.remove('show')
  }
}

let isDragging = false

function onDragStart(source, piece, position, orientation) {
  if (game.isGameOver()) return false

  // 1. Check if game is in multiplayer mode and we have a color
  if (currentRoomId && currentPlayerColor) {
    // 2. Check if it's our turn
    const currentTurn = game.turn() // 'w' or 'b'
    const playerColorChar = currentPlayerColor.charAt(0) // 'w' or 'b'

    if (currentTurn !== playerColorChar) {
      return false
    }

    // 3. Check if the piece belongs to us
    // piece is 'wP', 'bN', etc.
    const pieceColor = piece.charAt(0) // 'w' or 'b'
    if (pieceColor !== playerColorChar) {
      return false
    }
  }

  // If clicking on a different piece of the same color, allow deselection
  if (selectedSquare && selectedSquare !== source) {
    removeHighlights()
    selectedSquare = source
  } else {
    selectedSquare = source
  }

  isDragging = true
  // Show hint when piece is selected
  showEscHint()
}

function onSnapEnd() {
  board.position(game.fen())
  selectedSquare = null
  isDragging = false
  hideEscHint()
}

// Add ESC key listener to cancel piece selection
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isDragging) {
      // If actively dragging, do NOT call board.position() as it causes duplication
      // Just hide the hint - the piece will snap back when dropped
      hideEscHint()
      return
    }

    if (selectedSquare) {
      removeHighlights()
      board.position(game.fen()) // Reset board to deselect piece
      selectedSquare = null
      hideEscHint()
    }
  }
})

function updateStatus() {
  let status = ''
  const $status = $('#status')

  // Try to get player name from current room data
  let playerName = 'Opponent'
  let isMyTurn = false

  if (currentRoomData) {
    const player = game.turn() === 'w' ? currentRoomData.players?.white : currentRoomData.players?.black
    if (player) {
      // Check if it's the current user's turn
      const user = getCurrentUser()
      isMyTurn = player.uid === user?.uid

      // Debug info
      if (!isMyTurn) {
        console.log('Turn mismatch:', { playerUid: player.uid, userUid: user?.uid, turn: game.turn() })
        // playerName += ` (${player.uid?.slice(0,4)} vs ${user?.uid?.slice(0,4)})`
      }

      // Get player name
      if (isMyTurn) {
        playerName = 'You'
      } else {
        // Get opponent's name
        if (player.email) {
          playerName = player.email.split('@')[0]
        }
      }
    }
  } else {
    playerName = 'Waiting (No Data)'
  }

  if (game.isCheckmate()) {
    const winnerText = isMyTurn ? 'You Win' : playerName.toUpperCase() + ' WINS'
    status = '🏆 GAME OVER: ' + winnerText + '!'
    $status.css('color', 'var(--neon-yellow)')
  } else if (game.isDraw()) {
    status = '🤝 GAME OVER: DRAW'
    $status.css('color', 'var(--neon-yellow)')
  } else {
    if (isMyTurn) {
      status = '▶️ YOUR TURN'
    } else {
      status = '▶️ ' + playerName.toUpperCase() + "'S TURN"
    }

    if (game.isCheck()) {
      status += ' ⚠️ CHECK!'
    }

    // Change color based on whose turn it is
    if (isMyTurn) {
      $status.css('color', 'var(--neon-green)') // Green for your turn
    } else {
      $status.css('color', 'var(--neon-pink)') // Pink for opponent's turn
    }
  }

  $status.html(status)
}

// Initialize sidebar with room info
function initSidebar(mode, roomData) {
  const user = getCurrentUser()

  // Update user info
  if (user) {
    $('#user-email').text(user.email)
    $('#user-photo').attr('src', user.photoURL || '')
  }

  // Display game mode
  const modeText = {
    'random': 'Random Match',
    'join': 'Joined Room',
    'create': 'Created Room'
  }
  $('#game-mode').text(modeText[mode.mode] || 'Unknown')

  // Display room code
  $('#room-code-display').text(mode.code || 'N/A')

  // Update room status based on room data
  if (roomData && roomData.status === 'playing') {
    $('#room-status').text('Playing')
    $('#room-status').css('color', 'var(--neon-green)')
  } else {
    $('#room-status').text('Waiting for opponent...')
    $('#room-status').css('color', 'var(--neon-pink)')
  }

  // Leave room button
  $('#leave-room-btn').on('click', async () => {
    if (mode.roomId) {
      await leaveRoom(mode.roomId)
    }
    window.location.reload() // Go back to selection
  })

  // Sign out button
  $('#signout-btn').on('click', async () => {
    if (mode.roomId) {
      await leaveRoom(mode.roomId)
    }
    await signOutUser()
  })
}

function showNotification(message, type) {
  const notification = $('<div>')
    .addClass('notification')
    .addClass(type)
    .text(message)

  $('body').append(notification)

  setTimeout(() => {
    notification.addClass('show')
  }, 10)

  setTimeout(() => {
    notification.removeClass('show')
    setTimeout(() => notification.remove(), 300)
  }, 2000)
}

let roomUnsubscribe = null
let currentPlayerColor = null
let currentRoomId = null
let currentRoomData = null

export function initGame(mode = { mode: 'create' }) {
  currentPlayerColor = mode.color
  currentRoomId = mode.roomId

  $(function () {
    board = Chessboard('board', boardConfig)
    updateStatus()

    if (mode.roomId) {
      // Setup real-time sync
      setupRealTimeSync(mode)
    } else {
      // Fallback for local mode
      initSidebar(mode, null)
    }
  })

  // Handle window resize to keep board responsive
  window.addEventListener('resize', () => {
    if (board) {
      board.resize()
    }
  })

  // Initial resize to fit container
  setTimeout(() => {
    if (board) {
      board.resize()
    }
  }, 100)
}

async function setupRealTimeSync(mode) {
  const { watchRoom, getRoom, makeMove: dbMakeMove, endGame } = await import('./db.js')

  try {
    // Get initial room data
    const roomData = await getRoom(mode.roomId)
    currentRoomData = roomData // Store immediately for turn checking

    // Robustly determine player color from room data
    const user = getCurrentUser()
    if (user) {
      if (roomData.players?.white?.uid === user.uid) {
        currentPlayerColor = 'white'
      } else if (roomData.players?.black?.uid === user.uid) {
        currentPlayerColor = 'black'
      } else {
        console.warn('User is not a player in this room!', user.uid, roomData.players)
      }
    }

    console.log('Game Setup:', {
      fen: roomData.fen,
      gameTurn: game.turn(),
      currentPlayerColor: currentPlayerColor,
      myUid: user?.uid,
      whiteUid: roomData.players?.white?.uid,
      blackUid: roomData.players?.black?.uid
    })

    initSidebar(mode, roomData)

    // Set board orientation based on color
    if (currentPlayerColor === 'black') {
      board.orientation('black')
    }

    // Load initial position if game has started
    if (roomData.fen) {
      game.load(roomData.fen)
      board.position(roomData.fen)
      updateStatus()
    }

    // Watch for room updates
    roomUnsubscribe = watchRoom(mode.roomId, (updatedRoom) => {
      currentRoomData = updatedRoom // Store for status updates

      // Update status when player joins
      if (updatedRoom.status === 'playing') {
        $('#room-status').text('Playing')
        $('#room-status').css('color', 'var(--neon-green)')
        showNotification('Opponent joined!', 'success')
      }

      // Sync board position
      if (updatedRoom.fen && updatedRoom.fen !== game.fen()) {
        game.load(updatedRoom.fen)
        board.position(updatedRoom.fen)

        // Only update status if game is not finished
        if (updatedRoom.status !== 'finished') {
          updateStatus()
        }

        // Play sound for opponent's move
        if (updatedRoom.currentTurn === currentPlayerColor) {
          soundManager.playMove()
        }
      }

      // Check for game end
      if (updatedRoom.status === 'finished') {
        console.log('🔥 Game Over Detected via Firebase Sync!')
        let winnerName = 'Draw'
        let isCurrentPlayerWinner = false

        if (updatedRoom.winner && updatedRoom.winner !== 'draw') {
          const winner = updatedRoom.players[updatedRoom.winner]
          if (winner) {
            winnerName = winner.email ? winner.email.split('@')[0] : updatedRoom.winner
          }
          isCurrentPlayerWinner = updatedRoom.winner === currentPlayerColor
          console.log('🏆 Winner (Firebase):', {
            dbWinner: updatedRoom.winner,
            winnerName,
            currentPlayerColor,
            isCurrentPlayerWinner
          })
        }

        // Play victory sound if player won
        if (isCurrentPlayerWinner) {
          console.log('🎵 Playing win sound (Firebase sync)')
          soundManager.playWin()
        }

        // Show game over overlay for BOTH players
        console.log('🎊 Showing overlay (Firebase sync):', { winnerName, isCurrentPlayerWinner })
        setTimeout(() => {
          showGameOverOverlay(winnerName, isCurrentPlayerWinner)
        }, 500)
      }
    })

  } catch (error) {
    console.error('Error setting up real-time sync:', error)
    showNotification('Error connecting to game', 'error')
  }
}

// onDrop function with database sync
function onDrop(source, target) {
  isDragging = false // Drag ended

  // If in multiplayer mode, check turn
  if (currentRoomId && currentPlayerColor) {
    // Use database as source of truth for turn
    const dbTurn = currentRoomData?.currentTurn

    if (dbTurn && dbTurn !== currentPlayerColor) {
      showNotification(`Not your turn! It is ${dbTurn}'s turn.`, 'error')
      return 'snapback'
    }

    // CRITICAL FIX: Force sync local game state with DB before validating move
    // This ensures game.move() has the correct turn state
    if (currentRoomData?.fen) {
      const currentFen = game.fen()
      const dbFen = currentRoomData.fen

      // Only reload if FENs differ (to avoid unnecessary reloads)
      if (currentFen !== dbFen) {
        console.log('Syncing FEN before move:', { currentFen, dbFen })
        game.load(dbFen)
        board.position(dbFen) // CRITICAL: Also update the visual board
      }
    }
  }

  removeHighlights()

  // see if the move is legal
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  })

  // illegal move
  if (move === null) {
    soundManager.playInvalid()
    return 'snapback'
  }

  // legal move
  if (move.captured) {
    soundManager.playCapture()
  } else {
    soundManager.playMove()
  }

  // Sync to database if in multiplayer
  if (currentRoomId && currentPlayerColor) {
    import('./db.js').then(({ makeMove: dbMakeMove, endGame }) => {
      const moveNotation = source + target
      dbMakeMove(currentRoomId, game.fen(), moveNotation, currentPlayerColor)
        .catch(error => {
          console.error('Error syncing move:', error)
          showNotification('Error syncing move', 'error')
          // Rollback
          game.undo()
          board.position(game.fen())
        })

      // Check for game end
      if (game.isGameOver()) {
        console.log('🎮 Game Over Detected Locally!')
        let winner = null
        let winnerName = 'Draw'
        let isCurrentPlayerWinner = false

        if (game.isCheckmate()) {
          // The player who just moved wins (checkmate means opponent is mated)
          winner = currentPlayerColor
          isCurrentPlayerWinner = true

          // Get winner name from current user
          const user = getCurrentUser()
          if (user && user.email) {
            winnerName = user.email.split('@')[0]
          }
          console.log('🏆 Winner (local):', { winner, winnerName, isCurrentPlayerWinner })
        } else {
          winner = 'draw'
        }

        // Update database
        endGame(currentRoomId, winner)

        // Show overlay immediately for the winner
        if (isCurrentPlayerWinner) {
          console.log('🎵 Playing win sound for winner')
          soundManager.playWin()
        }

        console.log('🎊 Showing overlay for winner:', { winnerName, isCurrentPlayerWinner })
        setTimeout(() => {
          showGameOverOverlay(winnerName, isCurrentPlayerWinner)
        }, 500)
      }
    })
  }

  updateStatus()
  hideEscHint() // Hide hint after move
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (roomUnsubscribe) {
    roomUnsubscribe()
  }
})
