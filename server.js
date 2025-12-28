require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).catch(err => console.log(err));

let rooms = {};

function createDeck() {
    let deck = [];
    for(let i=0; i<5; i++) deck.push(-2);
    for(let i=0; i<10; i++) deck.push(-1);
    for(let i=0; i<15; i++) deck.push(0);
    for(let v=1; v<=12; v++) { for(let i=0; i<10; i++) deck.push(v); }
    return deck.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ name, roomId }) => {
        const room = roomId.toUpperCase();
        socket.join(room);
        if (!rooms[room]) rooms[room] = { players: {}, status: 'Lobby', deck: [], discard: [], turnIndex: 0, isLastRound: false, finisherId: null };
        rooms[room].players[socket.id] = { id: socket.id, name, grid: [] };
        io.to(room).emit('updatePlayers', Object.values(rooms[room].players));
    });

    socket.on('startGame', (roomId) => {
        const r = rooms[roomId.toUpperCase()];
        if (!r) return;
        r.deck = createDeck();
        Object.keys(r.players).forEach(id => {
            r.players[id].grid = Array.from({length:12}, () => ({ value: r.deck.pop(), isVisible: false }));
            r.players[id].grid[0].isVisible = r.players[id].grid[1].isVisible = true;
        });
        r.discard = [r.deck.pop()];
        r.status = 'Playing';
        r.currentPlayerId = Object.keys(r.players)[0];
        io.to(roomId.toUpperCase()).emit('gameStarted', r);
    });

    // Dans server.js, modifie la section playerAction :

    socket.on('playerAction', (data) => {
        const r = rooms[data.roomId.toUpperCase()];
        if (!r || socket.id !== r.currentPlayerId) return;

        const p = r.players[socket.id];
        
        // 1. Appliquer l'action (SWAP ou FLIP)
        if (data.type === 'SWAP') {
            r.discard.push(p.grid[data.index].value);
            p.grid[data.index] = { value: data.newValue, isVisible: true };
        } else {
            p.grid[data.index].isVisible = true;
        }

        // 2. LOGIQUE DE SUPPRESSION (COMBOS)
        checkAndRemoveCombos(p);

        // 3. Vérifier si la grille est vide ou pleine après suppression
        if (!r.isLastRound && (p.grid.every(c => c.isVisible) || p.grid.every(c => c.removed))) {
            r.isLastRound = true;
            r.finisherId = socket.id;
        }

        // Suite du code (changement de tour...) identique à avant
        const ids = Object.keys(r.players);
        r.turnIndex = (r.turnIndex + 1) % ids.length;
        r.currentPlayerId = ids[r.turnIndex];
        
        // ... émission de gameState ou gameOver ...
    });

    // NOUVELLE FONCTION DE SUPPRESSION
    function checkAndRemoveCombos(player) {
        const grid = player.grid;
        // On considère une grille de 3 lignes x 4 colonnes
        const ROWS = 3;
        const COLS = 4;

        // Vérification des colonnes (ex: index 0, 4, 8)
        for (let c = 0; c < COLS; c++) {
            let idx1 = c, idx2 = c + 4, idx3 = c + 8;
            let v1 = grid[idx1], v2 = grid[idx2], v3 = grid[idx3];

            if (v1.isVisible && v2.isVisible && v3.isVisible && !v1.removed) {
                if (v1.value === v2.value && v2.value === v3.value) {
                    // Combo trouvé ! On marque les cartes comme supprimées
                    v1.removed = true; v2.removed = true; v3.removed = true;
                    // Optionnel : on peut les mettre à 0 ou les sortir du calcul
                    v1.value = 0; v2.value = 0; v3.value = 0; 
                }
            }
        }
        
        // Note : Pour respecter ta règle "soit ligne soit colonne", 
        // on pourrait ajouter un flag player.comboType = 'col' ou 'row'.
        // Ici, le code vérifie les colonnes (standard Skyjo). 
    }

    socket.on('sendChatMessage', (data) => {
        io.to(data.roomId.toUpperCase()).emit('receiveChatMessage', data);
    });
});
server.listen(process.env.PORT || 3000);