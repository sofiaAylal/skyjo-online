const socket = io();
let myRoom, myName, isMyTurn = false, currentCardInHand = null;

function join() {
    myName = document.getElementById('player-name').value;
    myRoom = document.getElementById('room-input').value.toUpperCase();
    if(myName && myRoom) {
        socket.emit('joinRoom', { name: myName, roomId: myRoom });
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
    }
}

// DRAG & DROP
function drag(ev) {
    if(!isMyTurn) return ev.preventDefault();
    ev.dataTransfer.setData("source", ev.target.id);
}

function allowDrop(ev) { ev.preventDefault(); }

function drop(ev, index) {
    ev.preventDefault();
    const source = ev.dataTransfer.getData("source");
    socket.emit('playerAction', { 
        type: 'SWAP', 
        roomId: myRoom, 
        index: index, 
        newValue: source === 'deck' ? Math.floor(Math.random()*14)-2 : parseInt(document.getElementById('discard').innerText)
    });
}

socket.on('gameState', (state) => {
    isMyTurn = state.currentPlayerId === socket.id;
    document.getElementById('turn-indicator').innerText = isMyTurn ? "À TOI !" : `Tour de ${state.players[state.currentPlayerId].name}`;
    
    // Grille perso
    const gridDiv = document.getElementById('grid');
    gridDiv.innerHTML = '';
    state.players[socket.id].grid.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = `card ${c.isVisible ? getColorClass(c.value) : 'back'}`;
        div.innerText = c.isVisible ? c.value : '?';
        div.ondrop = (e) => drop(e, i);
        div.ondragover = allowDrop;
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

    document.getElementById('discard').innerText = state.discard[state.discard.length-1];
    document.getElementById('discard').className = 'card ' + getColorClass(parseInt(state.discard[state.discard.length-1]));
});

socket.on('gameOver', (results) => {
    document.getElementById('win-modal').style.display = 'block';
    document.getElementById('winner-txt').innerText = `Vainqueur : ${results[0].name}`;
    document.getElementById('final-scores').innerHTML = results.map(r => `<p>${r.name} : ${r.score} pts</p>`).join('');
});

function toggleChat() { document.getElementById('chat-drawer').classList.toggle('open'); }
function getColorClass(v) {
    if(v < 0) return 'cat-neg'; if(v === 0) return 'cat-zero';
    if(v <= 4) return 'cat-low'; if(v <= 8) return 'cat-mid'; return 'cat-high';
}