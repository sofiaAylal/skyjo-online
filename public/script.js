const socket = io();
let myRoom, myName, isMyTurn = false, selectedFromClick = null, tempDeckValue = null, lastRoundFired = false;

const sounds = {
    flip: new Audio('sounds/flip.mp3'),
    win: new Audio('sounds/win.mp3'),
    alert: new Audio('sounds/alert.mp3')
};
function playSnd(n) { sounds[n].play().catch(() => {}); }

function join() {
    myName = document.getElementById('player-name').value;
    myRoom = document.getElementById('room-input').value.toUpperCase();
    if(myName && myRoom) {
        socket.emit('joinRoom', { name: myName, roomId: myRoom });
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('lobby-container').style.display = 'flex';
    }
}

socket.on('updatePlayers', (p) => {
    document.getElementById('player-list').innerHTML = p.map(x => `<li>👤 ${x.name}</li>`).join('');
    if(p.length >= 2 && p[0].id === socket.id) document.getElementById('start-btn').style.display = 'block';
});

function requestStart() { socket.emit('startGame', myRoom); }
socket.on('gameStarted', (s) => { 
    document.getElementById('lobby-container').style.display = 'none'; 
    document.getElementById('game-container').style.display = 'flex'; 
    updateUI(s); 
});
socket.on('gameState', updateUI);

function updateUI(state) {
    isMyTurn = state.currentPlayerId === socket.id;
    document.getElementById('turn-indicator').innerText = isMyTurn ? "⭐️ À TOI !" : "Tour de " + state.players[state.currentPlayerId].name;
    
    if (state.isLastRound && !lastRoundFired) {
        const popup = document.getElementById('last-round-popup');
        popup.classList.add('show');
        playSnd('alert');
        lastRoundFired = true;
        setTimeout(() => popup.classList.remove('show'), 5000);
    }

    const deckCont = document.getElementById('deck-cont');
    const discardCont = document.getElementById('discard-cont');
    const lastD = state.discard[state.discard.length-1];

    if(tempDeckValue !== null) {
        deckCont.classList.add('is-visible');
        const f = document.getElementById('deck-val');
        f.innerText = tempDeckValue; f.className = `card-front ${getColorClass(tempDeckValue)}`;
    } else { deckCont.classList.remove('is-visible'); }
    
    deckCont.classList.toggle('selected', selectedFromClick === 'deck');
    const df = document.getElementById('discard-val');
    df.innerText = lastD; df.className = `card-front ${getColorClass(lastD)}`;
    discardCont.classList.toggle('selected', selectedFromClick === 'discard');

    deckCont.onclick = () => { if(isMyTurn) { selectedFromClick = 'deck'; if(tempDeckValue === null) { tempDeckValue = Math.floor(Math.random()*14)-2; playSnd('flip'); } updateUI(state); } };
    discardCont.onclick = () => { if(isMyTurn) { selectedFromClick = 'discard'; tempDeckValue = null; updateUI(state); } };

    const gridDiv = document.getElementById('grid'); gridDiv.innerHTML = '';
    state.players[socket.id].grid.forEach((c, i) => {
        const container = document.createElement('div');
        container.className = `card-container ${c.isVisible ? 'is-visible' : ''} ${c.removed ? 'removed' : ''}`;
        container.innerHTML = `<div class="card-inner"><div class="card-back">?</div><div class="card-front ${getColorClass(c.value)}">${c.value}</div></div>`;
        container.onclick = () => {
            if(!isMyTurn) return;
            if(selectedFromClick) executeSwap(i, selectedFromClick === 'deck' ? tempDeckValue : lastD);
            else if(!c.isVisible) { socket.emit('playerAction', { type: 'FLIP', roomId: myRoom, index: i }); playSnd('flip'); }
        };
        gridDiv.appendChild(container);
    });

    const opp = document.getElementById('opponents-container'); opp.innerHTML = '';
    Object.values(state.players).forEach(p => {
        if(p.id !== socket.id) {
            const d = document.createElement('div'); d.className = 'opponent-mini';
            d.innerHTML = `<div style="font-size:0.6rem;text-align:center">${p.name}</div><div class="mini-grid"></div>`;
            p.grid.forEach(c => {
                const mc = document.createElement('div');
                if (c.removed) mc.className = 'card-mini removed';
                else { mc.className = `card-mini ${c.isVisible ? getColorClass(c.value) : 'back'}`; mc.innerText = c.isVisible ? c.value : ''; }
                d.querySelector('.mini-grid').appendChild(mc);
            });
            opp.appendChild(d);
        }
    });
}

function executeSwap(idx, val) { socket.emit('playerAction', { type: 'SWAP', roomId: myRoom, index: idx, newValue: val }); selectedFromClick = null; tempDeckValue = null; playSnd('flip'); }
function sendMsg() { const i = document.getElementById('chat-in'); if(i.value.trim()) { socket.emit('sendChatMessage', { name: myName, message: i.value, roomId: myRoom }); i.value = ''; } }
socket.on('receiveChatMessage', (d) => { const m = document.getElementById('messages'); m.innerHTML += `<div><b>${d.name}:</b> ${d.message}</div>`; m.scrollTop = m.scrollHeight; });
function toggleChat() { const w = document.getElementById('chat-window'); w.style.display = (w.style.display === 'flex') ? 'none' : 'flex'; }
socket.on('gameOver', (res) => {
    document.getElementById('win-modal').style.display = 'flex';
    document.getElementById('winner-txt').innerText = "🏆 GAGNANT : " + res[0].name;
    document.getElementById('final-scores').innerHTML = res.map(r => `<p>${r.name}: ${r.score} pts</p>`).join('');
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    playSnd('win');
});
function getColorClass(v) { if(v < 0) return 'cat-neg'; if(v === 0) return 'cat-zero'; if(v <= 4) return 'cat-low'; if(v <= 8) return 'cat-mid'; return 'cat-high'; }