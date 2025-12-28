const socket = io();
let myRoom, myName, isMyTurn = false, selectedFromClick = null, tempDeckValue = null;

function join() {
    myName = document.getElementById('player-name').value;
    myRoom = document.getElementById('room-input').value.toUpperCase();
    if(myName && myRoom) {
        socket.emit('joinRoom', { name: myName, roomId: myRoom });
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('lobby-container').style.display = 'flex';
        document.getElementById('lobby-title').innerText = "Salon : " + myRoom;
    }
}

socket.on('updatePlayers', (players) => {
    document.getElementById('player-list').innerHTML = players.map(p => `<li>👤 ${p.name}</li>`).join('');
    if(players.length >= 2 && players[0].id === socket.id) document.getElementById('start-btn').style.display = 'block';
});

function requestStart() { socket.emit('startGame', myRoom); }
socket.on('gameStarted', (s) => { document.getElementById('lobby-container').style.display = 'none'; document.getElementById('game-container').style.display = 'flex'; updateUI(s); });
socket.on('gameState', updateUI);

function onDragStart(ev) {
    if(!isMyTurn) return ev.preventDefault();
    ev.dataTransfer.setData("sourceId", ev.target.id);
    if(ev.target.id === 'deck' && tempDeckValue === null) tempDeckValue = Math.floor(Math.random()*14)-2;
}

function updateUI(state) {
    isMyTurn = state.currentPlayerId === socket.id;
    document.getElementById('turn-indicator').innerText = isMyTurn ? "À TOI !" : "Tour de " + state.players[state.currentPlayerId].name;
    document.getElementById('turn-indicator').style.color = isMyTurn ? "#27ae60" : "white";

    const deckEl = document.getElementById('deck');
    const discardEl = document.getElementById('discard');
    const lastDisc = state.discard[state.discard.length-1];

    if(tempDeckValue !== null) { deckEl.innerText = tempDeckValue; deckEl.className = `card ${getColorClass(tempDeckValue)} ${selectedFromClick === 'deck' ? 'selected' : ''}`; }
    else { deckEl.innerText = "?"; deckEl.className = `card back ${selectedFromClick === 'deck' ? 'selected' : ''}`; }

    discardEl.innerText = lastDisc;
    discardEl.className = `card ${getColorClass(lastDisc)} ${selectedFromClick === 'discard' ? 'selected' : ''}`;

    deckEl.onclick = () => { if(isMyTurn) { selectedFromClick = 'deck'; if(tempDeckValue === null) tempDeckValue = Math.floor(Math.random()*14)-2; updateUI(state); } };
    discardEl.onclick = () => { if(isMyTurn) { selectedFromClick = 'discard'; tempDeckValue = null; updateUI(state); } };

    const gridDiv = document.getElementById('grid'); gridDiv.innerHTML = '';
    state.players[socket.id].grid.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = `card ${c.isVisible ? getColorClass(c.value) : 'back'}`;
        div.innerText = c.isVisible ? c.value : '?';
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => { const src = e.dataTransfer.getData("sourceId"); executeSwap(i, src === 'deck' ? tempDeckValue : lastDisc); };
        div.onclick = () => {
            if(!isMyTurn) return;
            if(selectedFromClick) executeSwap(i, selectedFromClick === 'deck' ? tempDeckValue : lastDisc);
            else if(!c.isVisible) socket.emit('playerAction', { type: 'FLIP', roomId: myRoom, index: i });
        };
        gridDiv.appendChild(div);
    });

    const oppCont = document.getElementById('opponents-container'); oppCont.innerHTML = '';
    Object.values(state.players).forEach(p => {
        if(p.id !== socket.id) {
            const d = document.createElement('div'); d.className = 'opponent-mini';
            d.innerHTML = `<span>${p.name}</span><div class="mini-grid"></div>`;
            p.grid.forEach(c => {
                const mc = document.createElement('div'); mc.className = `card-mini ${c.isVisible ? getColorClass(c.value) : 'back'}`;
                mc.innerText = c.isVisible ? c.value : ''; d.querySelector('.mini-grid').appendChild(mc);
            });
            oppCont.appendChild(d);
        }
    });
}

function executeSwap(idx, val) { socket.emit('playerAction', { type: 'SWAP', roomId: myRoom, index: idx, newValue: val }); selectedFromClick = null; tempDeckValue = null; }
function sendMsg() { const inp = document.getElementById('chat-in'); if(inp.value.trim()) { socket.emit('sendChatMessage', { name: myName, message: inp.value, roomId: myRoom }); inp.value = ''; } }
socket.on('receiveChatMessage', (d) => { const m = document.getElementById('messages'); m.innerHTML += `<div><b>${d.name}:</b> ${d.message}</div>`; m.scrollTop = m.scrollHeight; });
function toggleChat() { const w = document.getElementById('chat-window'); w.style.display = (w.style.display === 'flex') ? 'none' : 'flex'; }
socket.on('gameOver', (res) => { document.getElementById('win-modal').style.display = 'block'; document.getElementById('winner-txt').innerText = "Gagnant: " + res[0].name; document.getElementById('final-scores').innerHTML = res.map(r => `<p>${r.name}: ${r.score}</p>`).join(''); });
function getColorClass(v) { if(v < 0) return 'cat-neg'; if(v === 0) return 'cat-zero'; if(v <= 4) return 'cat-low'; if(v <= 8) return 'cat-mid'; return 'cat-high'; }