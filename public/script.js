const socket = io();
let myRoom = null;
let myName = "";
let isMyTurn = false;

function join() {
    myName = document.getElementById('player-name').value;
    myRoom = document.getElementById('room-input').value.toUpperCase();
    if(!myName || !myRoom) return alert("Pseudo et Code requis !");
    socket.emit('joinRoom', { name: myName, roomId: myRoom });
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-container').style.display = 'flex';
    document.getElementById('lobby-title').innerText = "Salon : " + myRoom;
}

socket.on('updatePlayers', (players) => {
    const list = document.getElementById('player-list');
    list.innerHTML = players.map(p => `<li>👤 ${p.name}</li>`).join('');
    if(players.length >= 2 && players[0].id === socket.id) {
        document.getElementById('start-game-btn').style.display = 'block';
    }
});

function requestStart() {
    socket.emit('startGame', myRoom);
}

socket.on('gameStarted', (state) => {
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    document.getElementById('room-display').innerText = "SALON : " + myRoom;
    updateUI(state);
});

socket.on('gameState', (state) => {
    updateUI(state);
});

function updateUI(state) {
    const currentPlayer = state.players[state.currentPlayerId];
    isMyTurn = (state.currentPlayerId === socket.id);
    
    const indicator = document.getElementById('turn-indicator');
    indicator.innerText = isMyTurn ? "À TOI DE JOUER !" : "Tour de : " + currentPlayer.name;
    indicator.style.color = isMyTurn ? "#27ae60" : "white";

    renderGrid(state.players[socket.id].grid);
    renderOpponents(state.players);
    updateDiscard(state.discard);
}

function renderGrid(grid) {
    const gridDiv = document.getElementById('grid');
    gridDiv.innerHTML = '';
    grid.forEach((card, index) => {
        const c = document.createElement('div');
        c.className = 'card ' + (card.isVisible ? getColorClass(card.value) : 'back');
        c.innerText = card.isVisible ? card.value : '?';
        c.onclick = () => {
            if(isMyTurn && !card.isVisible) {
                socket.emit('playerAction', { roomId: myRoom, index: index });
            }
        };
        gridDiv.appendChild(c);
    });
}

function renderOpponents(players) {
    const container = document.getElementById('opponents-container');
    container.innerHTML = '';
    Object.values(players).forEach(p => {
        if (p.id !== socket.id) {
            const div = document.createElement('div');
            div.className = 'opponent-mini';
            div.innerHTML = `<span>${p.name}</span><div class="mini-grid"></div>`;
            const miniGrid = div.querySelector('.mini-grid');
            p.grid.forEach(card => {
                const c = document.createElement('div');
                c.className = 'card-mini ' + (card.isVisible ? getColorClass(card.value) : 'back');
                miniGrid.appendChild(c);
            });
            container.appendChild(div);
        }
    });
}

function updateDiscard(pile) {
    const disc = document.getElementById('discard');
    const val = pile[pile.length - 1];
    disc.innerText = val;
    disc.className = 'card ' + getColorClass(val);
}

function getColorClass(v) {
    if(v < 0) return 'cat-neg';
    if(v === 0) return 'cat-zero';
    if(v <= 4) return 'cat-low';
    if(v <= 8) return 'cat-mid';
    return 'cat-high';
}

function sendMsg() {
    const input = document.getElementById('chat-input');
    if(input.value) {
        socket.emit('sendChatMessage', { name: myName, message: input.value, roomId: myRoom });
        input.value = '';
    }
}

socket.on('receiveChatMessage', (data) => {
    const msgDiv = document.getElementById('messages');
    msgDiv.innerHTML += `<div><b>${data.name}:</b> ${data.message}</div>`;
    msgDiv.scrollTop = msgDiv.scrollHeight;
});