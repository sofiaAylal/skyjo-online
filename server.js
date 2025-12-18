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
const Score = mongoose.model('Score', { name: String, wins: { type: Number, default: 0 } });

let rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ name, roomId }) => {
        const room = roomId.toUpperCase();
        socket.join(room);
        if (!rooms[room]) rooms[room] = { players: {}, status: 'Lobby', deck: [], discard: [], turnIndex: 0, isLastRound: false };
        
        rooms[room].players[socket.id] = { id: socket.id, name, grid: [], score: 0 };
        io.to(room).emit('updatePlayers', Object.values(rooms[room].players));
    });

    socket.on('startGame', (roomId) => {
        const r = rooms[roomId.toUpperCase()];
        if (!r) return;
        r.deck = Array.from({length:150}, (_,i) => (i%15)-2).sort(() => Math.random()-0.5);
        Object.keys(r.players).forEach(id => {
            r.players[id].grid = Array.from({length:12}, () => ({ value: r.deck.pop(), isVisible: false }));
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
            const oldVal = p.grid[data.index].value;
            p.grid[data.index] = { value: data.newValue, isVisible: true };
            r.discard.push(oldVal);
        } else {
            p.grid[data.index].isVisible = true;
        }

        const ids = Object.keys(r.players);
        r.turnIndex = (r.turnIndex + 1) % ids.length;
        r.currentPlayerId = ids[r.turnIndex];
        io.to(data.roomId.toUpperCase()).emit('gameState', r);
    });

    socket.on('sendChatMessage', (data) => {
        io.to(data.roomId.toUpperCase()).emit('receiveChatMessage', data);
    });
});
server.listen(process.env.PORT || 3000);