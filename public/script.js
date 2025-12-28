const socket = io();
let myRoom, myName, isMyTurn = false, selectedFromClick = null, tempDeckValue = null;

// --- CONNEXION ET LOBBY ---

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
    const list = document.getElementById('player-list');
    list.innerHTML = players.map(p => `<li>👤 ${p.name}</li>`).join('');
    // Seul le premier joueur peut lancer la partie
    if(players.length >= 2 && players[0].id === socket.id) {
        document.getElementById('start-btn').style.display = 'block';
    }
});

function requestStart() {
    socket.emit('startGame', myRoom);
}

// --- SYNCHRONISATION DU JEU ---

socket.on('gameStarted', (state) => {
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    updateUI(state);
});

socket.on('gameState', updateUI);

// --- LOGIQUE D'AFFICHAGE (UI) ---

function updateUI(state) {
    isMyTurn = state.currentPlayerId === socket.id;
    const currentP = state.players[state.currentPlayerId];
    
    const indicator = document.getElementById('turn-indicator');
    indicator.innerText = isMyTurn ? "À TOI DE JOUER !" : "Tour de " + currentP.name;
    indicator.style.color = isMyTurn ? "#27ae60" : "white";

    // Mise à jour des piles (Pioche et Défausse)
    const deckEl = document.getElementById('deck');
    const discardEl = document.getElementById('discard');
    const lastDisc = state.discard[state.discard.length - 1];

    // Affichage Pioche (avec valeur si cliquée)
    if(tempDeckValue !== null) {
        deckEl.innerText = tempDeckValue;
        deckEl.className = `card ${getColorClass(tempDeckValue)} ${selectedFromClick === 'deck' ? 'selected' : ''}`;
    } else {
        deckEl.innerText = "?";
        deckEl.className = `card back ${selectedFromClick === 'deck' ? 'selected' : ''}`;
    }

    // Affichage Défausse
    discardEl.innerText = lastDisc;
    discardEl.className = `card ${getColorClass(lastDisc)} ${selectedFromClick === 'discard' ? 'selected' : ''}`;

    // Événements sur les piles
    deckEl.onclick = () => {
        if(!isMyTurn) return;
        selectedFromClick = 'deck';
        if(tempDeckValue === null) tempDeckValue = Math.floor(Math.random() * 14) - 2;
        updateUI(state);
    };

    discardEl.onclick = () => {
        if(!isMyTurn) return;
        selectedFromClick = 'discard';
        tempDeckValue = null;
        updateUI(state);
    };

    // MAJ Grille Personnelle
    const gridDiv = document.getElementById('grid');
    gridDiv.innerHTML = '';
    state.players[socket.id].grid.forEach((c, i) => {
        const div = document.createElement('div');
        
        // GESTION DES CARTES SUPPRIMÉES (Combos)
        if (c.removed) {
            div.className = 'card removed';
            gridDiv.appendChild(div);
            return;
        }

        div.className = `card ${c.isVisible ? getColorClass(c.value) : 'back'}`;
        div.innerText = c.isVisible ? c.value : '?';

        // PC : Support Drag & Drop
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            const sourceId = e.dataTransfer.getData("sourceId");
            const val = (sourceId === 'deck') ? tempDeckValue : lastDisc;
            executeSwap(i, val);
        };

        // Mobile + PC : Support Clic
        div.onclick = () => {
            if(!isMyTurn) return;
            if(selectedFromClick) {
                const val = (selectedFromClick === 'deck') ? tempDeckValue : lastDisc;
                executeSwap(i, val);
            } else if(!c.isVisible) {
                socket.emit('playerAction', { type: 'FLIP', roomId: myRoom, index: i });
            }
        };
        
        gridDiv.appendChild(div);
    });

    // MAJ Adversaires (miniatures)
    renderOpponents(state.players);
}

function renderOpponents(players) {
    const container = document.getElementById('opponents-container');
    container.innerHTML = '';
    Object.values(players).forEach(p => {
        if(p.id !== socket.id) {
            const d = document.createElement('div');
            d.className = 'opponent-mini';
            d.innerHTML = `<span>${p.name}</span><div class="mini-grid"></div>`;
            const miniGrid = d.querySelector('.mini-grid');
            p.grid.forEach(c => {
                const mc = document.createElement('div');
                // Cache les cartes supprimées aussi pour les adversaires
                if (c.removed) {
                    mc.className = 'card-mini removed';
                } else {
                    mc.className = `card-mini ${c.isVisible ? getColorClass(c.value) : 'back'}`;
                    mc.innerText = c.isVisible ? c.value : '';
                }
                miniGrid.appendChild(mc);
            });
            container.appendChild(d);
        }
    });
}

// --- ACTIONS ET UTILITAIRES ---

function executeSwap(idx, val) {
    socket.emit('playerAction', { type: 'SWAP', roomId: myRoom, index: idx, newValue: val });
    selectedFromClick = null;
    tempDeckValue = null;
}

function onDragStart(ev) {
    if(!isMyTurn) return ev.preventDefault();
    ev.dataTransfer.setData("sourceId", ev.target.id);
    if(ev.target.id === 'deck' && tempDeckValue === null) {
        tempDeckValue = Math.floor(Math.random() * 14) - 2;
    }
}

function getColorClass(v) {
    if(v < 0) return 'cat-neg';
    if(v === 0) return 'cat-zero';
    if(v <= 4) return 'cat-low';
    if(v <= 8) return 'cat-mid';
    return 'cat-high';
}

// --- CHAT ET MODALES ---

function sendMsg() {
    const input = document.getElementById('chat-in');
    if(input.value.trim()) {
        socket.emit('sendChatMessage', { name: myName, message: input.value, roomId: myRoom });
        input.value = '';
    }
}

socket.on('receiveChatMessage', (data) => {
    const msgDiv = document.getElementById('messages');
    msgDiv.innerHTML += `<div><b>${data.name}:</b> ${data.message}</div>`;
    msgDiv.scrollTop = msgDiv.scrollHeight;
});

function toggleChat() {
    const win = document.getElementById('chat-window');
    win.style.display = (win.style.display === 'flex') ? 'none' : 'flex';
}

socket.on('gameOver', (results) => {
    const modal = document.getElementById('win-modal');
    modal.style.display = 'block';
    document.getElementById('winner-txt').innerText = "🏆 VAINQUEUR : " + results[0].name;
    document.getElementById('final-scores').innerHTML = results.map(r => `<p>${r.name} : ${r.score} pts</p>`).join('');
});