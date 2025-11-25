export function renderGamePage() {
  return `
    <div id="app">
      <div id="game-container">
        <div id="board-wrapper">
          <div id="board"></div>
        </div>
      </div>
      <div id="sidebar">
        <h1>NEON<br>CHESS</h1>
        
        <div class="user-info">
          <img id="user-photo" src="" alt="User" class="user-avatar">
          <div id="user-email" class="user-email"></div>
        </div>
        
        <div id="status">Loading game...</div>
        
        <div class="room-info-section">
          <h3 class="section-title">Room Info</h3>
          <div class="room-mode-display">
            <div class="mode-label">Mode:</div>
            <div id="game-mode" class="mode-value">-</div>
          </div>
          <div class="room-code-display-container">
            <div class="mode-label">Room Code:</div>
            <div id="room-code-display" class="room-code-small">-</div>
          </div>
          <div class="room-status-display">
            <div class="mode-label">Status:</div>
            <div id="room-status" class="status-value">Waiting...</div>
          </div>
        </div>
        
        <button id="leave-room-btn" class="leave-room-btn">
          Leave Room
        </button>
        
        <button id="signout-btn" class="signout-btn">
          Sign Out
        </button>
        
        <div class="game-info">
          <p>Premium Multiplayer Experience</p>
        </div>
      </div>
    </div>
  `
}
