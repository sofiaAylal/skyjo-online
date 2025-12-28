require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).catch(err => console.log("Erreur Mongo:", err));
const Score = mongoose.model('Score', { name: String, wins: { type: Number, default: 0 } });

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
            r.players[id].grid = Array.from({length:12}, () => ({ value: r.deck.pop(), isVisible: false, removed: false }));
            r.players[id].grid[0].isVisible = r.players[id].grid[1].isVisible = true;
        });
        r.discard = [r.deck.pop()];
        r.status = 'Playing';
        r.currentPlayerId = Object.keys(r.players)[0];
        io.to(roomId.toUpperCase()).emit('gameStarted', r);
    });

    socket.on('playerAction', (data) => {
        const r = rooms[data.roomId.toUpperCase()];
        if (!r || socket.id !== r.currentPlayerId) return;
        const p = r.players[socket.id];

        if (data.type === 'SWAP') {
            r.discard.push(p.grid[data.index].value);
            p.grid[data.index] = { value: data.newValue, isVisible: true, removed: false };
        } else if (data.type === 'FLIP') {
            p.grid[data.index].isVisible = true;
        }

        for (let col = 0; col < 4; col++) {
            let idxs = [col, col + 4, col + 8];
            if (idxs.every(i => p.grid[i].isVisible && !p.grid[i].removed) &&
                p.grid[idxs[0]].value === p.grid[idxs[1]].value && p.grid[idxs[1]].value === p.grid[idxs[2]].value) {
                idxs.forEach(i => { p.grid[i].removed = true; p.grid[i].value = 0; });
            }
        }
        for (let row = 0; row < 3; row++) {
            let start = row * 4;
            let idxs = [start, start + 1, start + 2, start + 3];
            if (idxs.every(i => p.grid[i].isVisible && !p.grid[i].removed) &&
                p.grid[idxs[0]].value === p.grid[idxs[1]].value && p.grid[idxs[1]].value === p.grid[idxs[2]].value && p.grid[idxs[2]].value === p.grid[idxs[3]].value) {
                idxs.forEach(i => { p.grid[i].removed = true; p.grid[i].value = 0; });
            }
        }

        if (!r.isLastRound && p.grid.every(c => c.isVisible || c.removed)) {
            r.isLastRound = true;
            r.finisherId = socket.id;
        }

        const ids = Object.keys(r.players);
        r.turnIndex = (r.turnIndex + 1) % ids.length;
        r.currentPlayerId = ids[r.turnIndex];

        if (r.isLastRound && r.currentPlayerId === r.finisherId) {
            const scores = ids.map(id => ({ name: r.players[id].name, score: r.players[id].grid.reduce((s, c) => s + c.value, 0) }));
            io.to(data.roomId.toUpperCase()).emit('gameOver', scores.sort((a,b) => a.score - b.score));
            delete rooms[data.roomId.toUpperCase()];
        } else {
            io.to(data.roomId.toUpperCase()).emit('gameState', r);
        }
    });

    socket.on('sendChatMessage', (data) => {
        io.to(data.roomId.toUpperCase()).emit('receiveChatMessage', data);
    });
});
server.listen(process.env.PORT || 3000);