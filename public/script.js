const socket = io();
let myRoom = null;
let myName = "";

function join() {
    myName = document.getElementById('player-name').value;
    myRoom = document.getElementById('room-input').value.toUpperCase();
    if(!myName || !myRoom) return alert("Pseudo et Code requis");
    socket.emit('joinRoom', { name: myName, roomId: myRoom });
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('room-code-display').innerText = "SALON : " + myRoom;
}

socket.on('updateLeaderboard', (top) => {
    const list = document.getElementById('score-list');
    list.innerHTML = top.map(p => `<li>${p.name}: ${p.wins} vicoires</li>`).join('');
});

socket.on('gameStarted', (state) => {
    renderGrid(state.players[socket.id].grid);
    document.getElementById('discard').innerText = state.discard[state.discard.length-1];
});

function renderGrid(grid) {
    const gridDiv = document.getElementById('grid');
    gridDiv.innerHTML = '';
    grid.forEach(card => {
        const c = document.createElement('div');
        c.className = 'card ' + (card.isVisible ? getColorClass(card.value) : 'back');
        c.innerText = card.isVisible ? card.value : '?';
        gridDiv.appendChild(c);
    });
}

function getColorClass(v) {
    if(v < 0) return 'cat-neg';
    if(v === 0) return 'cat-zero';
    if(v <= 4) return 'cat-low';
    if(v <= 8) return 'cat-mid';
    return 'cat-high';
}
