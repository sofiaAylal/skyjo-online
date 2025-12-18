const socket = io();
let myRoom, myName, isMyTurn = false;

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

socket.on('gameStarted', (state) => {
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    updateGameState(state);
});

socket.on('gameState', updateGameState);

function updateGameState(state) {
    isMyTurn = state.currentPlayerId === socket.id;
    const currentName = state.players[state.currentPlayerId].name;
    document.getElementById('turn-indicator').innerText = isMyTurn ? "À TOI !" : "Tour de : " + currentName;
    document.getElementById('turn-indicator').style.color = isMyTurn ? "#27ae60" : "white";

    // Grille
    const gridDiv = document.getElementById('grid');
    gridDiv.innerHTML = '';
    state.players[socket.id].grid.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = `card ${c.isVisible ? getColorClass(c.value) : 'back'}`;
        div.innerText = c.isVisible ? c.value : '?';
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => onDrop(e, i);
        div.onclick = () => { if(isMyTurn && !c.isVisible) socket.emit('playerAction', {type:'FLIP', index:i, roomId:myRoom}); };
        gridDiv.appendChild(div);
    });

    // Adversaires
    const oppCont = document.getElementById('opponents-container');
    oppCont.innerHTML = '';
    Object.values(state.players).forEach(p => {
        if(p.id !== socket.id) {
            const d = document.createElement('div');
            d.className = 'opponent-mini';
            d.innerHTML = `<span>${p.name}</span><div class="mini-grid"></div>`;
            p.grid.forEach(c => {
                const mc = document.createElement('div');
                mc.className = `card-mini ${c.isVisible ? getColorClass(c.value) : 'back'}`;
                mc.innerText = c.isVisible ? c.value : '';
                d.querySelector('.mini-grid').appendChild(mc);
            });
            oppCont.appendChild(d);
        }
    });

    const lastDisc = state.discard[state.discard.length-1];
    document.getElementById('discard').innerText = lastDisc;
    document.getElementById('discard').className = 'card ' + getColorClass(lastDisc);
}

function onDrag(ev) { if(!isMyTurn) ev.preventDefault(); ev.dataTransfer.setData("source", ev.target.id); }
function onDrop(ev, index) {
    ev.preventDefault();
    const source = ev.dataTransfer.getData("source");
    const val = (source === 'deck') ? Math.floor(Math.random()*14)-2 : parseInt(document.getElementById('discard').innerText);
    socket.emit('playerAction', { type: 'SWAP', roomId: myRoom, index, newValue: val });
}

function toggleChat() { 
    const win = document.getElementById('chat-window');
    win.style.display = (win.style.display === 'flex') ? 'none' : 'flex';
}

function getColorClass(v) {
    if(v < 0) return 'cat-neg'; if(v === 0) return 'cat-zero';
    if(v <= 4) return 'cat-low'; if(v <= 8) return 'cat-mid'; return 'cat-high';
}