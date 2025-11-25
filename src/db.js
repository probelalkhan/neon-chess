import { getDatabase, ref, set, push, get, onValue, off, remove, update, query, orderByChild, limitToFirst } from 'firebase/database'
import { auth } from './firebase.js'

const db = getDatabase()

// Generate unique room code
export function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return code
}

// Create a new room
export async function createRoom(mode = 'create') {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const roomId = push(ref(db, 'rooms')).key
    const code = generateRoomCode()

    const roomData = {
        code,
        mode,
        status: 'waiting',
        createdAt: Date.now(),
        players: {
            white: {
                uid: user.uid,
                email: user.email,
                photoURL: user.photoURL || '',
                joinedAt: Date.now()
            }
        },
        currentTurn: 'white',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [],
        lastMoveAt: Date.now(),
        winner: null
    }

    await set(ref(db, `rooms/${roomId}`), roomData)
    await set(ref(db, `userRooms/${user.uid}/${roomId}`), true)

    return { roomId, code, color: 'white' }
}

// Join a room by code
export async function joinRoomByCode(code) {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    // Find room with this code
    const roomsRef = ref(db, 'rooms')
    const snapshot = await get(roomsRef)

    let roomId = null
    let roomData = null

    snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val()
        if (data.code === code && data.status === 'waiting') {
            roomId = childSnapshot.key
            roomData = data
        }
    })

    if (!roomId) {
        throw new Error('Room not found or already full')
    }

    // Check if room already has 2 players
    if (roomData.players.white && roomData.players.black) {
        throw new Error('Room is full')
    }

    // Join as black player
    const color = roomData.players.white ? 'black' : 'white'

    await update(ref(db, `rooms/${roomId}`), {
        [`players/${color}`]: {
            uid: user.uid,
            email: user.email,
            photoURL: user.photoURL || '',
            joinedAt: Date.now()
        },
        status: 'playing'
    })

    await set(ref(db, `userRooms/${user.uid}/${roomId}`), true)

    return { roomId, code, color }
}

// Add user to matchmaking queue
export async function joinMatchmaking() {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    // Check if there's someone waiting
    const matchmakingRef = ref(db, 'matchmaking')
    const q = query(matchmakingRef, orderByChild('timestamp'), limitToFirst(1))
    const snapshot = await get(q)

    if (snapshot.exists()) {
        // Found a match!
        const opponentId = Object.keys(snapshot.val())[0]
        const opponentData = snapshot.val()[opponentId]

        // Don't match with yourself
        if (opponentId === user.uid) {
            // Add yourself to queue
            await set(ref(db, `matchmaking/${user.uid}`), {
                uid: user.uid,
                email: user.email,
                photoURL: user.photoURL || '',
                timestamp: Date.now()
            })
            return { waiting: true }
        }

        // Create room with both players
        const roomId = push(ref(db, 'rooms')).key
        const code = generateRoomCode()

        const roomData = {
            code,
            mode: 'random',
            status: 'playing',
            createdAt: Date.now(),
            players: {
                white: {
                    uid: opponentData.uid,
                    email: opponentData.email,
                    photoURL: opponentData.photoURL || '',
                    joinedAt: Date.now()
                },
                black: {
                    uid: user.uid,
                    email: user.email,
                    photoURL: user.photoURL || '',
                    joinedAt: Date.now()
                }
            },
            currentTurn: 'white',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            moves: [],
            lastMoveAt: Date.now(),
            winner: null
        }

        await set(ref(db, `rooms/${roomId}`), roomData)
        await set(ref(db, `userRooms/${opponentData.uid}/${roomId}`), true)
        await set(ref(db, `userRooms/${user.uid}/${roomId}`), true)

        // Remove both from matchmaking
        await remove(ref(db, `matchmaking/${opponentId}`))
        await remove(ref(db, `matchmaking/${user.uid}`))

        return { roomId, code, color: 'black', matched: true }
    } else {
        // No match found, add to queue
        await set(ref(db, `matchmaking/${user.uid}`), {
            uid: user.uid,
            email: user.email,
            photoURL: user.photoURL || '',
            timestamp: Date.now()
        })
        return { waiting: true }
    }
}

// Listen for matchmaking updates
export function watchMatchmaking(userId, callback) {
    const userRoomsRef = ref(db, `userRooms/${userId}`)

    const listener = onValue(userRoomsRef, (snapshot) => {
        if (snapshot.exists()) {
            const roomIds = Object.keys(snapshot.val())
            const latestRoomId = roomIds[roomIds.length - 1]

            // Get room data
            get(ref(db, `rooms/${latestRoomId}`)).then((roomSnapshot) => {
                if (roomSnapshot.exists()) {
                    const roomData = roomSnapshot.val()
                    const color = roomData.players.white.uid === userId ? 'white' : 'black'
                    callback({ roomId: latestRoomId, code: roomData.code, color, matched: true })
                }
            })
        }
    })

    return () => off(userRoomsRef, 'value', listener)
}

// Get room data
export async function getRoom(roomId) {
    const snapshot = await get(ref(db, `rooms/${roomId}`))
    if (!snapshot.exists()) {
        throw new Error('Room not found')
    }
    return { id: roomId, ...snapshot.val() }
}

// Listen to room updates
export function watchRoom(roomId, callback) {
    const roomRef = ref(db, `rooms/${roomId}`)

    const listener = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: roomId, ...snapshot.val() })
        }
    })

    return () => off(roomRef, 'value', listener)
}

// Make a move
export async function makeMove(roomId, fen, move, playerColor) {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    const roomRef = ref(db, `rooms/${roomId}`)
    const snapshot = await get(roomRef)

    if (!snapshot.exists()) {
        throw new Error('Room not found')
    }

    const roomData = snapshot.val()

    // Verify it's the player's turn
    if (roomData.currentTurn !== playerColor) {
        throw new Error('Not your turn')
    }

    // Verify the player is in the room
    if (roomData.players[playerColor].uid !== user.uid) {
        throw new Error('Unauthorized')
    }

    const nextTurn = playerColor === 'white' ? 'black' : 'white'
    const moves = roomData.moves || []
    moves.push(move)

    await update(roomRef, {
        fen,
        moves,
        currentTurn: nextTurn,
        lastMoveAt: Date.now()
    })
}

// End game
export async function endGame(roomId, winner) {
    await update(ref(db, `rooms/${roomId}`), {
        status: 'finished',
        winner
    })
}

// Leave room
export async function leaveRoom(roomId) {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated')

    // Remove from user's rooms
    await remove(ref(db, `userRooms/${user.uid}/${roomId}`))

    // Remove from matchmaking if in queue
    await remove(ref(db, `matchmaking/${user.uid}`))
}
