// Generate a unique 6-character room code
export function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return code
}

// Get or create room code for current user
export function getRoomCode() {
    let roomCode = localStorage.getItem('roomCode')
    if (!roomCode) {
        roomCode = generateRoomCode()
        localStorage.setItem('roomCode', roomCode)
    }
    return roomCode
}

// Share room code
export async function shareRoomCode(code) {
    const shareData = {
        title: 'Join my Neon Chess game!',
        text: `Join my chess game with code: ${code}`,
        url: window.location.href
    }

    try {
        // Try Web Share API first (mobile)
        if (navigator.share) {
            await navigator.share(shareData)
            return { success: true, method: 'share' }
        } else {
            // Fallback to clipboard
            await navigator.clipboard.writeText(code)
            return { success: true, method: 'clipboard' }
        }
    } catch (error) {
        console.error('Error sharing:', error)
        // Last resort: try clipboard again
        try {
            await navigator.clipboard.writeText(code)
            return { success: true, method: 'clipboard' }
        } catch (clipError) {
            return { success: false, error: clipError }
        }
    }
}

// Join a room with code
export function joinRoom(code) {
    // Store the room code to join
    localStorage.setItem('joinedRoomCode', code.toUpperCase())
    return code.toUpperCase()
}

// Get joined room code
export function getJoinedRoomCode() {
    return localStorage.getItem('joinedRoomCode')
}
