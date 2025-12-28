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
    ev.dataTransfer.setData("sourceId", ev.target.id === "deck-cont" ? "deck" : "discard");
    if(ev.target.id === 'deck-cont' && tempDeckValue === null) tempDeckValue = Math.floor(Math.random()*14)-2;
}

function updateUI(state) {
    isMyTurn = state.currentPlayerId === socket.id;
    document.getElementById('turn-indicator').innerText = isMyTurn ? "⭐️ À TOI !" : "Tour de " + state.players[state.currentPlayerId].name;
    
    // Alerte Dernier Tour
    if (state.isLastRound) document.getElementById('last-round-banner').classList.add('show');

    // Piles
    const deckCont = document.getElementById('deck-cont');
    const discardCont = document.getElementById('discard-cont');
    const lastDisc = state.discard[state.discard.length-1];

    if(tempDeckValue !== null) {
        deckCont.classList.add('is-visible');
        const front = document.getElementById('deck-val');
        front.innerText = tempDeckValue;
        front.className = `card-front ${getColorClass(tempDeckValue)}`;
    } else {
        deckCont.classList.remove('is-visible');
    }
    deckCont.classList.toggle('selected', selectedFromClick === 'deck');

    const discFront = document.getElementById('discard-val');
    discFront.innerText = lastDisc;
    discFront.className = `card-front ${getColorClass(lastDisc)}`;
    discardCont.classList.toggle('selected', selectedFromClick === 'discard');

    deckCont.onclick = () => { if(isMyTurn) { selectedFromClick = 'deck'; if(tempDeckValue === null) tempDeckValue = Math.floor(Math.random()*14)-2; updateUI(state); } };
    discardCont.onclick = () => { if(isMyTurn) { selectedFromClick = 'discard'; tempDeckValue = null; updateUI(state); } };

    // Ma Grille
    const gridDiv = document.getElementById('grid'); gridDiv.innerHTML = '';
    state.players[socket.id].grid.forEach((c, i) => {
        const container = document.createElement('div');
        container.className = `card-container ${c.isVisible ? 'is-visible' : ''} ${c.removed ? 'removed' : ''}`;
        
        container.innerHTML = `
            <div class="card-inner">
                <div class="card-back">?</div>
                <div class="card-front ${getColorClass(c.value)}">${c.value}</div>
            </div>`;

        container.ondragover = (e) => e.preventDefault();
        container.ondrop = (e) => { 
            const src = e.dataTransfer.getData("sourceId"); 
            executeSwap(i, src === 'deck' ? tempDeckValue : lastDisc); 
        };
        
        container.onclick = () => {
            if(!isMyTurn) return;
            if(selectedFromClick) executeSwap(i, selectedFromClick === 'deck' ? tempDeckValue : lastDisc);
            else if(!c.isVisible) socket.emit('playerAction', { type: 'FLIP', roomId: myRoom, index: i });
        };
        gridDiv.appendChild(container);
    });

    // Adversaires
    const oppCont = document.getElementById('opponents-container'); oppCont.innerHTML = '';
    Object.values(state.players).forEach(p => {
        if(p.id !== socket.id) {
            const d = document.createElement('div'); d.className = 'opponent-mini';
            d.innerHTML = `<span style="font-size:0.7rem;margin-bottom:4px;display:block">${p.name}</span><div class="mini-grid"></div>`;
            p.grid.forEach(c => {
                const mc = document.createElement('div');
                if (c.removed) mc.className = 'card-mini removed' ;
                else { mc.className = `card-mini ${c.isVisible ? getColorClass(c.value) : 'back'}`; mc.innerText = c.isVisible ? c.value : ''; }
                d.querySelector('.mini-grid').appendChild(mc);
            });
            oppCont.appendChild(d);
        }
    });
}

function executeSwap(idx, val) { socket.emit('playerAction', { type: 'SWAP', roomId: myRoom, index: idx, newValue: val }); selectedFromClick = null; tempDeckValue = null; }
function sendMsg() { const inp = document.getElementById('chat-in'); if(inp.value.trim()) { socket.emit('sendChatMessage', { name: myName, message: inp.value, roomId: myRoom }); inp.value = ''; } }
socket.on('receiveChatMessage', (d) => { const m = document.getElementById('messages'); m.innerHTML += `<div><b>${d.name}:</b> ${d.message}</div>`; m.scrollTop = m.scrollHeight; });
function toggleChat() { const w = document.getElementById('chat-window'); w.style.display = (w.style.display === 'flex') ? 'none' : 'flex'; }
socket.on('gameOver', (res) => { document.getElementById('win-modal').style.display = 'block'; document.getElementById('winner-txt').innerText = "🏆 GAGNANT : " + res[0].name; document.getElementById('final-scores').innerHTML = res.map(r => `<p>${r.name}: ${r.score} pts</p>`).join(''); });
function getColorClass(v) { if(v < 0) return 'cat-neg'; if(v === 0) return 'cat-zero'; if(v <= 4) return 'cat-low'; if(v <= 8) return 'cat-mid'; return 'cat-high'; }