// Confetti animation
export function createConfetti() {
    const canvas = document.createElement('canvas')
    canvas.id = 'confetti-canvas'
    document.body.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const confettiParticles = []
    const colors = ['#00f3ff', '#ff00ff', '#00ff00', '#fcee0a', '#ff0064']

    class Confetti {
        constructor() {
            this.x = Math.random() * canvas.width
            this.y = -20
            this.size = Math.random() * 10 + 5
            this.speedY = Math.random() * 3 + 2
            this.speedX = Math.random() * 2 - 1
            this.color = colors[Math.floor(Math.random() * colors.length)]
            this.rotation = Math.random() * 360
            this.rotationSpeed = Math.random() * 10 - 5
        }

        update() {
            this.y += this.speedY
            this.x += this.speedX
            this.rotation += this.rotationSpeed

            if (this.y > canvas.height) {
                this.y = -20
                this.x = Math.random() * canvas.width
            }
        }

        draw() {
            ctx.save()
            ctx.translate(this.x, this.y)
            ctx.rotate(this.rotation * Math.PI / 180)
            ctx.fillStyle = this.color
            ctx.shadowBlur = 10
            ctx.shadowColor = this.color
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size)
            ctx.restore()
        }
    }

    // Create confetti particles
    for (let i = 0; i < 150; i++) {
        confettiParticles.push(new Confetti())
    }

    let animationId
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        confettiParticles.forEach(confetti => {
            confetti.update()
            confetti.draw()
        })

        animationId = requestAnimationFrame(animate)
    }

    animate()

    // Clean up after 10 seconds
    setTimeout(() => {
        cancelAnimationFrame(animationId)
        canvas.remove()
    }, 10000)
}

// Show game over overlay
export function showGameOverOverlay(winner, isCurrentPlayer) {
    const overlay = document.createElement('div')
    overlay.className = 'game-over-overlay'

    const winnerName = winner || 'Draw'
    const isDraw = !winner || winner === 'draw'

    overlay.innerHTML = `
    <div class="winner-card">
      <div class="winner-trophy">${isDraw ? '🤝' : '🏆'}</div>
      <h1 class="winner-title">${isDraw ? 'Game Draw!' : 'Winner!'}</h1>
      ${!isDraw ? `<div class="winner-name">${winnerName}</div>` : ''}
      <div class="winner-buttons">
        <button class="winner-btn primary" id="play-again-btn">Play Again</button>
        <button class="winner-btn" id="leave-game-btn">Leave Game</button>
      </div>
    </div>
  `

    document.body.appendChild(overlay)

    // Add confetti if not a draw
    if (!isDraw) {
        createConfetti()
    }

    // Event listeners
    document.getElementById('play-again-btn').addEventListener('click', () => {
        overlay.remove()
        window.location.reload()
    })

    document.getElementById('leave-game-btn').addEventListener('click', () => {
        overlay.remove()
        window.location.hash = ''
        window.location.reload()
    })
}
