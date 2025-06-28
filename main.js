const socket = io('https://drawgame-production.up.railway.app'); // Use full URL with https

const app = document.getElementById('app');

function renderHome() {
  app.innerHTML = `
    <div class="container">
      <h1>Online Drawing Game</h1>
      <form id="home-form">
        <label>
          Username:<br>
          <input type="text" id="username" required autocomplete="off" />
        </label>
        <div style="margin: 20px 0;">
          <button type="button" id="create-room">Create Game Room</button>
          <span style="margin: 0 10px;">or</span>
          <input type="text" id="room-code" placeholder="Room Code" style="width: 100px;" />
          <button type="button" id="join-room">Join Game Room</button>
        </div>
      </form>
      <div id="home-error" style="color: red; margin-top: 10px;"></div>
    </div>
  `;

  const usernameInput = document.getElementById('username');
  const roomCodeInput = document.getElementById('room-code');
  const createRoomBtn = document.getElementById('create-room');
  const joinRoomBtn = document.getElementById('join-room');
  const errorDiv = document.getElementById('home-error');

  createRoomBtn.onclick = () => {
    const username = usernameInput.value.trim();
    if (!username) {
      errorDiv.textContent = "Please enter a username.";
      return;
    }
    socket.emit('createRoom', { username }, ({ roomCode }) => {
      renderLobby(roomCode, username);
    });
  };

  joinRoomBtn.onclick = () => {
    const username = usernameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!username) {
      errorDiv.textContent = "Please enter a username.";
      return;
    }
    if (!roomCode) {
      errorDiv.textContent = "Please enter a room code to join.";
      return;
    }
    socket.emit('joinRoom', { username, roomCode }, (response) => {
      if (response.error) {
        errorDiv.textContent = response.error;
      } else {
        renderLobby(roomCode, username);
      }
    });
  };
}

let currentRoom = null;
let currentUsername = null;
let isLeader = false;
let gameStarted = false;

function renderLobby(roomCode, username) {
  currentRoom = roomCode;
  currentUsername = username;
  app.innerHTML = `
    <div class="container">
      <h2>Lobby - Room <span style="color:blue">${roomCode}</span></h2>
      <p>Welcome, <b>${username}</b>!</p>
      <h3>Players:</h3>
      <ul id="player-list"></ul>
      <div id="lobby-actions"></div>
      <button id="back-home">Back to Home</button>
    </div>
  `;
  document.getElementById('back-home').onclick = renderHome;

  socket.off('updatePlayers');
  socket.on('updatePlayers', (players, leaderId, started) => {
    console.log('Players:', players); // Add this line
    isLeader = (socket.id === leaderId);
    gameStarted = started;
    document.getElementById('player-list').innerHTML =
      players.map(p => `<li>${p.name ? p.name : '(no name)'} ${p.ready ? '✅' : ''}${leaderId === p.id ? ' (Leader)' : ''}</li>`).join('');
    renderLobbyActions(players, leaderId, started);
  });

  socket.off('gameStarted');
  socket.on('gameStarted', () => {
    renderGame();
  });

  // Request latest player list on entering lobby
  socket.emit('setReady', { roomCode, ready: false });
}

function renderLobbyActions(players, leaderId, started) {
  const me = players.find(p => p.id === socket.id); // Only match by id
  const allReady = players.length > 1 && players.every(p => p.ready);
  let html = '';

  if (!started) {
    html += `<button id="ready-btn">${me && me.ready ? 'Unready' : 'Ready'}</button>`;
    if (isLeader) {
      html += `<button id="start-btn" ${allReady ? '' : 'disabled'}>Start Game</button>`;
    }
  } else {
    html += `<p>Game started!</p>`;
  }

  document.getElementById('lobby-actions').innerHTML = html;

  if (!started) {
    document.getElementById('ready-btn').onclick = () => {
      socket.emit('setReady', { roomCode: currentRoom, ready: !(me && me.ready) });
    };
    if (isLeader) {
      document.getElementById('start-btn').onclick = () => {
        socket.emit('startGame', currentRoom);
      };
    }
  }
}

function renderGame() {
  app.innerHTML = `
    <div class="container">
      <h2>Game Started!</h2>
      <!-- Add your game UI here -->
      <button id="back-home">Back to Home</button>
    </div>
  `;
  document.getElementById('back-home').onclick = renderHome;
}

socket.off('startRound');
socket.on('startRound', ({ round, totalRounds, theme, item, time, startTimestamp }) => {
  renderDrawingRound(round, totalRounds, theme, item, time, startTimestamp);
});

let drawingInterval = null;
let drawingSubmitted = false;
let drawingReadyCount = 0;
let drawingReadyTotal = 1;
let lastCanvasDataUrl = null;

socket.off('drawingReadyUpdate');
socket.on('drawingReadyUpdate', ({ ready, total }) => {
  drawingReadyCount = ready;
  drawingReadyTotal = total;
  if (window.lastDrawingRoundArgs) {
    // Pass the timestamp along!
    renderDrawingRound(...window.lastDrawingRoundArgs);
  }
});

function renderDrawingRound(round, totalRounds, theme, item, time, startTimestamp) {
  // Only reset if this is a new round (not just a re-render)
  if (
    !window.lastDrawingRoundArgs ||
    window.lastDrawingRoundArgs[0] !== round ||
    window.lastDrawingRoundArgs[4] !== time ||
    window.lastDrawingRoundArgs[5] !== startTimestamp
  ) {
    lastCanvasDataUrl = null;
    drawingSubmitted = false;
    drawingReadyCount = 0;
    window.drawingHistory = [];
    window.redoStack = [];
  }
  window.lastDrawingRoundArgs = [round, totalRounds, theme, item, time, startTimestamp];

  // Only clear interval if we're starting a new round
  if (drawingInterval) {
    clearInterval(drawingInterval);
    drawingInterval = null;
  }

  // Calculate time left based on server timestamp
  function getTimeLeft() {
    const now = Date.now();
    return Math.max(0, Math.round((startTimestamp + time * 1000 - now) / 1000));
  }
  let timer = getTimeLeft();

  app.innerHTML = `
    <div class="container">
      <h2>Round ${round} of ${totalRounds}</h2>
      <h3>
        ${
          theme
            ? `Theme: <span style="color:green">${theme}</span><br>
               Draw: <span style="color:blue">${item}</span>`
            : 'Free Draw!'
        }
      </h3>
      <div>Time left: <span id="timer">${timer}</span> seconds</div>
      <div style="margin-bottom:10px;">
        <select id="tool">
          <option value="pencil">✏️ Pencil</option>
          <option value="eraser">🧽 Eraser</option>
          <option value="line">/ Line</option>
          <option value="rect">▭ Rectangle</option>
          <option value="rectFill">▮ Filled Rectangle</option>
          <option value="circle">◯ Circle</option>
          <option value="circleFill">⬤ Filled Circle</option>
          <option value="bucket">🪣 Paint Bucket</option>
        </select>
        <input type="color" id="color" value="#222222" />
        <button id="undo-btn">Undo</button>
        <button id="redo-btn">Redo</button>
        <button id="clear-btn">Clear All</button>
      </div>
      <canvas id="draw-canvas" width="600" height="400" style="border:1px solid #000; background:#fff"></canvas>
      <button id="ready-drawing-btn">
        ${drawingSubmitted ? `Unready (${drawingReadyCount}/${drawingReadyTotal} Ready)` : `Ready (${drawingReadyCount}/${drawingReadyTotal} Ready)`}
      </button>
      <div id="drawing-status" style="margin-top:10px;color:green;"></div>
    </div>
  `;

  const canvas = document.getElementById('draw-canvas');

  // --- Drawing logic ---
  const ctx = canvas.getContext('2d');
  let tool = 'pencil';
  let color = '#222222';
  let isDrawing = false;
  let startX = 0, startY = 0;
  let previewImg = null;

  // Restore drawing if available
  if (lastCanvasDataUrl) {
    const img = new window.Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = lastCanvasDataUrl;
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Restore history if available
  if (!window.drawingHistory || window.drawingHistory.length === 0) {
    window.drawingHistory = [canvas.toDataURL()];
    window.redoStack = [];
  }

  function saveHistory() {
    window.drawingHistory.push(canvas.toDataURL());
    if (window.drawingHistory.length > 50) window.drawingHistory.shift();
    window.redoStack = [];
  }

  function setCanvasEnabled(enabled) {
    canvas.style.pointerEvents = enabled ? 'auto' : 'none';
    canvas.style.opacity = enabled ? '1' : '0.5';
    document.getElementById('tool').disabled = !enabled;
    document.getElementById('color').disabled = !enabled;
    document.getElementById('undo-btn').disabled = !enabled;
    document.getElementById('redo-btn').disabled = !enabled;
    document.getElementById('clear-btn').disabled = !enabled;
  }

  setCanvasEnabled(!drawingSubmitted && timer > 0);

  // Tool and color listeners
  document.getElementById('tool').onchange = e => tool = e.target.value;
  document.getElementById('color').onchange = e => color = e.target.value;

  // Undo/Redo/Clear
  document.getElementById('undo-btn').onclick = () => {
    if (window.drawingHistory.length > 1) {
      window.redoStack.push(window.drawingHistory.pop());
      let img = new Image();
      img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0);}
      img.src = window.drawingHistory[window.drawingHistory.length-1];
      lastCanvasDataUrl = img.src;
    }
  };
  document.getElementById('redo-btn').onclick = () => {
    if (window.redoStack.length > 0) {
      let img = new Image();
      img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0);}
      img.src = window.redoStack[window.redoStack.length-1];
      window.drawingHistory.push(window.redoStack.pop());
      lastCanvasDataUrl = img.src;
    }
  };
  document.getElementById('clear-btn').onclick = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    saveHistory();
    lastCanvasDataUrl = canvas.toDataURL();
  };

  // Drawing events
  canvas.onmousedown = e => {
    if (drawingSubmitted || timer <= 0) return;
    isDrawing = true;
    startX = e.offsetX;
    startY = e.offsetY;
    if (tool === 'pencil' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
    } else if (tool === 'bucket') {
      floodFill(ctx, startX, startY, hexToRgb(color));
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
      isDrawing = false;
    } else if (tool === 'line' || tool === 'rect' || tool === 'rectFill' || tool === 'circle' || tool === 'circleFill') {
      // Save preview image for shape preview
      previewImg = new Image();
      previewImg.src = canvas.toDataURL();
    }
  };
  canvas.onmousemove = e => {
    if (!isDrawing || drawingSubmitted || timer <= 0) return;
    const x = e.offsetX, y = e.offsetY;
    if (tool === 'pencil') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'eraser') {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 16;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'line' || tool === 'rect' || tool === 'rectFill' || tool === 'circle' || tool === 'circleFill') {
      // Shape preview
      if (!previewImg) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(previewImg, 0, 0);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (tool === 'rect' || tool === 'rectFill') {
        const w = x - startX, h = y - startY;
        if (tool === 'rectFill') {
          ctx.fillRect(startX, startY, w, h);
        } else {
          ctx.strokeRect(startX, startY, w, h);
        }
      } else if (tool === 'circle' || tool === 'circleFill') {
        const r = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        ctx.beginPath();
        ctx.arc(startX, startY, r, 0, 2 * Math.PI);
        if (tool === 'circleFill') ctx.fill();
        else ctx.stroke();
      }
    }
  };
  canvas.onmouseup = e => {
    if (!isDrawing) return;
    isDrawing = false;
    const x = e.offsetX, y = e.offsetY;
    if (tool === 'pencil' || tool === 'eraser') {
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'line') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'rect' || tool === 'rectFill') {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      const w = x - startX, h = y - startY;
      if (tool === 'rectFill') {
        ctx.fillRect(startX, startY, w, h);
      } else {
        ctx.strokeRect(startX, startY, w, h);
      }
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'circle' || tool === 'circleFill') {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      const r = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
      ctx.beginPath();
      ctx.arc(startX, startY, r, 0, 2 * Math.PI);
      if (tool === 'circleFill') ctx.fill();
      else ctx.stroke();
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
    }
    previewImg = null;
  };
  canvas.onmouseout = () => { isDrawing = false; ctx.beginPath(); previewImg = null; };

  // Touch events
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (drawingSubmitted || timer <= 0) return;
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.touches[0].clientX - rect.left;
    startY = e.touches[0].clientY - rect.top;
    if (tool === 'pencil' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
    } else if (tool === 'bucket') {
      floodFill(ctx, startX, startY, hexToRgb(color));
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
      isDrawing = false;
    } else if (tool === 'line' || tool === 'rect' || tool === 'rectFill' || tool === 'circle' || tool === 'circleFill') {
      // Save preview image for shape preview
      previewImg = new Image();
      previewImg.src = canvas.toDataURL();
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!isDrawing || drawingSubmitted || timer <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    if (tool === 'pencil') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'eraser') {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 16;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'line' || tool === 'rect' || tool === 'rectFill' || tool === 'circle' || tool === 'circleFill') {
      // Shape preview
      if (!previewImg) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(previewImg, 0, 0);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (tool === 'rect' || tool === 'rectFill') {
        const w = x - startX, h = y - startY;
        if (tool === 'rectFill') {
          ctx.fillRect(startX, startY, w, h);
        } else {
          ctx.strokeRect(startX, startY, w, h);
        }
      } else if (tool === 'circle' || tool === 'circleFill') {
        const r = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        ctx.beginPath();
        ctx.arc(startX, startY, r, 0, 2 * Math.PI);
        if (tool === 'circleFill') ctx.fill();
        else ctx.stroke();
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    if (!isDrawing) return;
    isDrawing = false;
    const rect = canvas.getBoundingClientRect();
    const x = e.changedTouches[0].clientX - rect.left;
    const y = e.changedTouches[0].clientY - rect.top;
    if (tool === 'pencil' || tool === 'eraser') {
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'line') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'rect' || tool === 'rectFill') {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      const w = x - startX, h = y - startY;
      if (tool === 'rectFill') {
        ctx.fillRect(startX, startY, w, h);
      } else {
        ctx.strokeRect(startX, startY, w, h);
      }
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
    } else if (tool === 'circle' || tool === 'circleFill') {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      const r = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
      ctx.beginPath();
      ctx.arc(startX, startY, r, 0, 2 * Math.PI);
      if (tool === 'circleFill') ctx.fill();
      else ctx.stroke();
      saveHistory();
      lastCanvasDataUrl = canvas.toDataURL();
    }
    previewImg = null;
  }, { passive: false });

  // --- Ready/Unready logic ---
  function readyDrawing() {
    drawingSubmitted = true;
    setCanvasEnabled(false);
    document.getElementById('drawing-status').textContent = "Ready! Waiting for others or timer...";
    lastCanvasDataUrl = canvas.toDataURL();
    saveHistory();
    socket.emit('submitDrawing', { roomCode: currentRoom, round, drawing: lastCanvasDataUrl });
    socket.emit('drawingReady', { roomCode: currentRoom, ready: true });
    document.getElementById('ready-drawing-btn').textContent = `Unready (${drawingReadyCount}/${drawingReadyTotal} Ready)`;
  }

  function unreadyDrawing() {
    drawingSubmitted = false;
    setCanvasEnabled(true);
    document.getElementById('drawing-status').textContent = "";
    socket.emit('unreadyDrawing', { roomCode: currentRoom, round });
    socket.emit('drawingReady', { roomCode: currentRoom, ready: false });
    document.getElementById('ready-drawing-btn').textContent = `Ready (${drawingReadyCount}/${drawingReadyTotal} Ready)`;
  }

  document.getElementById('ready-drawing-btn').onclick = () => {
    if (!drawingSubmitted && timer > 0) {
      readyDrawing();
    } else if (drawingSubmitted && timer > 0) {
      unreadyDrawing();
    }
  };

  // --- Timer ---
  drawingInterval = setInterval(() => {
    timer = getTimeLeft();
    document.getElementById('timer').textContent = timer;
    if (timer <= 0) {
      setCanvasEnabled(false);
      document.getElementById('ready-drawing-btn').disabled = true;
      if (!drawingSubmitted) {
        readyDrawing();
      }
      clearInterval(drawingInterval);
      drawingInterval = null;
    }
  }, 250); // update 4x per second for smoothness

  // --- Flood fill (paint bucket) ---
  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const num = parseInt(hex, 16);
    return [num >> 16, (num >> 8) & 255, num & 255];
  }
  function floodFill(ctx, x, y, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const stack = [[x, y]];
    const pixelPos = (x, y) => (y * width + x) * 4;
    const startPos = pixelPos(x, y);
    const startColor = data.slice(startPos, startPos + 3);

    function matchColor(pos) {
      return [0, 1, 2].every(i => data[pos + i] === startColor[i]);
    }
    function setColor(pos) {
      [0, 1, 2].forEach(i => data[pos + i] = fillColor[i]);
      data[pos + 3] = 255;
    }

    if (startColor[0] === fillColor[0] && startColor[1] === fillColor[1] && startColor[2] === fillColor[2]) return;

    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
      const pos = pixelPos(cx, cy);
      if (matchColor(pos)) {
        setColor(pos);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

socket.off('showDrawings');
socket.on('showDrawings', (drawings) => {
  renderShowDrawings(drawings);
});

function renderShowDrawings(drawings) {
  socket.emit('getPlayerNames', { roomCode: currentRoom }, (players) => {
    app.innerHTML = `
      <div class="container">
        <h2>Drawings</h2>
        <div style="display:flex;gap:20px;">
          ${Object.entries(drawings).map(([id, dataUrl]) => {
            const player = players.find(p => p.id === id);
            const name = player ? player.name : 'Unknown';
            const isMe = id === socket.id;
            return `
              <div style="text-align:center">
                <div style="font-weight:bold;margin-bottom:5px;">${name}</div>
                <img src="${dataUrl}" width="200" style="border:1px solid #000"/>
                <div>
                  ${
                    isMe
                      ? `<span style="color:gray;">(You can't rate your own drawing)</span>`
                      : `<input type="number" min="0" max="10" step="1" id="rate-${id}" style="width:50px;">
                         <button onclick="window.submitRating && window.submitRating('${id}')">Rate</button>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <p>Rate each drawing (except your own) from 0 to 10!</p>
      </div>
    `;

    window.submitRating = function(targetId) {
      const input = document.getElementById(`rate-${targetId}`);
      let rating = parseInt(input.value, 10);
      if (isNaN(rating)) rating = 0;
      if (rating < 0) rating = 0;
      if (rating > 10) rating = 10;
      input.value = rating; // Clamp value in UI
      socket.emit('submitRating', { roomCode: currentRoom, targetId, rating });
      input.disabled = true;
      input.nextElementSibling.disabled = true;
    };
  });
}

socket.off('gameOver');
socket.on('gameOver', () => {
  app.innerHTML = `
    <div class="container">
      <h2>Game Over! Thanks for playing!</h2>
      <button id="play-again">Play Again (Same Room)</button>
      <button id="back-home">Back to Home</button>
    </div>
  `;
  document.getElementById('play-again').onclick = () => {
    socket.emit('setReady', { roomCode: currentRoom, ready: false });
    socket.emit('startGame', currentRoom);
  };
  document.getElementById('back-home').onclick = renderHome;
});

let nextRoundReadyCount = 0;
let nextRoundTotal = 1;
let nextRoundClicked = false;

socket.off('nextRoundReadyUpdate');
socket.on('nextRoundReadyUpdate', ({ ready, total }) => {
  nextRoundReadyCount = ready;
  nextRoundTotal = total;
  if (window.lastShowScoresArgs) {
    renderShowScores(...window.lastShowScoresArgs);
  }
});

socket.off('showScores');
socket.on('showScores', ({ drawings, scores }) => {
  socket.emit('getPlayerNames', { roomCode: currentRoom }, (players) => {
    nextRoundReadyCount = 0;
    nextRoundTotal = players.length;
    renderShowScores(drawings, scores, players);
  });
});

function renderShowScores(drawings, scores, players) {
  window.lastShowScoresArgs = [drawings, scores, players];
  app.innerHTML = `
    <div class="container">
      <h2>Round Results</h2>
      <div style="display:flex;gap:20px;">
        ${Object.entries(drawings).map(([id, dataUrl]) => {
          const player = players.find(p => p.id === id);
          const name = player ? player.name : 'Unknown';
          const score = scores[id] ? scores[id].average : 0;
          return `
            <div style="text-align:center">
              <div style="font-weight:bold;margin-bottom:5px;">${name}</div>
              <img src="${dataUrl}" width="200" style="border:1px solid #000"/>
              <div style="margin-top:5px;font-size:1.1em;">
                Score: <b>${score}</b>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top:30px;">
        <button id="next-round-btn">
          Next Round (${nextRoundReadyCount}/${nextRoundTotal} Ready)
        </button>
      </div>
    </div>
  `;
  document.getElementById('next-round-btn').onclick = () => {
    nextRoundClicked = !nextRoundClicked;
    socket.emit('nextRoundReady', { roomCode: currentRoom, ready: nextRoundClicked });
    renderShowScores(drawings, scores, players); // re-render to update button state
  };
}



renderHome();