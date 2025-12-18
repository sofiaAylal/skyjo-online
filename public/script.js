const socket = io();
let myRoom = null;
let myName = "";

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
        document.getElementById('player-count-msg').innerText = "Prêt à lancer !";
    }
});

function requestStart() {
    socket.emit('startGame', myRoom);
}

socket.on('gameStarted', (state) => {
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    document.getElementById('room-display').innerText = "SALON : " + myRoom;
    renderGrid(state.players[socket.id].grid);
    updateDiscard(state.discard);
});

function renderGrid(grid) {
    const gridDiv = document.getElementById('grid');
    gridDiv.innerHTML = '';
    grid.forEach((card, index) => {
        const c = document.createElement('div');
        c.className = 'card ' + (card.isVisible ? getColorClass(card.value) : 'back');
        c.innerText = card.isVisible ? card.value : '?';
        gridDiv.appendChild(c);
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