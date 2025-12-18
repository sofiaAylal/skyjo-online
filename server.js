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
    socket.on('joinRoom', async ({ name, roomId }) => {
        const room = roomId.toUpperCase();
        socket.join(room);
        if (!rooms[room]) rooms[room] = { players: {}, status: 'Lobby', deck: [], discard: [], turnIndex: 0 };
        
        rooms[room].players[socket.id] = { id: socket.id, name, grid: [], score: 0 };
        io.to(room).emit('updatePlayers', Object.values(rooms[room].players));
        
        const top = await Score.find().sort({ wins: -1 }).limit(5);
        socket.emit('updateLeaderboard', top);
    });

    socket.on('startGame', (roomId) => {
        const room = rooms[roomId.toUpperCase()];
        if (!room) return;
        room.deck = createDeck();
        const ids = Object.keys(room.players);
        ids.forEach(id => {
            room.players[id].grid = Array.from({length: 12}, () => ({ value: room.deck.pop(), isVisible: false }));
            // On révèle 2 cartes au hasard pour commencer
            room.players[id].grid[0].isVisible = true;
            room.players[id].grid[1].isVisible = true;
        });
        room.discard = [room.deck.pop()];
        room.status = 'Playing';
        room.turnIndex = 0;
        room.currentPlayerId = ids[0];
        io.to(roomId).emit('gameStarted', room);
    });

    socket.on('playerAction', (data) => {
        const room = rooms[data.roomId.toUpperCase()];
        if (!room || socket.id !== room.currentPlayerId) return;

        // Logique simplifiée : on clique pour révéler et passer le tour
        const player = room.players[socket.id];
        if (!player.grid[data.index].isVisible) {
            player.grid[data.index].isVisible = true;
            
            // Passer au joueur suivant
            const ids = Object.keys(room.players);
            room.turnIndex = (room.turnIndex + 1) % ids.length;
            room.currentPlayerId = ids[room.turnIndex];
            
            io.to(data.roomId.toUpperCase()).emit('gameState', room);
        }
    });

    socket.on('sendChatMessage', (data) => {
        io.to(data.roomId.toUpperCase()).emit('receiveChatMessage', data);
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            if (rooms[room]) {
                delete rooms[room].players[socket.id];
                io.to(room).emit('updatePlayers', Object.values(rooms[room].players));
            }
        });
    });
});

server.listen(process.env.PORT || 3000, () => console.log("🚀 Serveur Skyjo Prêt !"));