require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware pour servir les fichiers statiques (index, style, script)
app.use(express.static('public'));

// Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connecté à MongoDB Atlas"))
    .catch(err => console.error("❌ Erreur de connexion MongoDB:", err));

// Schéma pour le Leaderboard
const Score = mongoose.model('Score', { 
    name: String, 
    wins: { type: Number, default: 0 } 
});

// Variable globale stockant l'état des parties en cours
let rooms = {};

/**
 * Crée un deck Skyjo officiel de 150 cartes
 * -2 (5), -1 (10), 0 (15), 1 à 12 (10 de chaque)
 */
function createDeck() {
    let deck = [];
    // Cartes spéciales
    for(let i=0; i<5; i++) deck.push(-2);
    for(let i=0; i<10; i++) deck.push(-1);
    for(let i=0; i<15; i++) deck.push(0);
    // Cartes de 1 à 12
    for(let v=1; v<=12; v++) {
        for(let i=0; i<10; i++) deck.push(v);
    }
    // Mélange (Shuffle)
    return deck.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    console.log(`🔌 Nouvel utilisateur connecté : ${socket.id}`);

    /**
     * Rejoindre un salon
     */
    socket.on('joinRoom', async ({ name, roomId }) => {
        const room = roomId.toUpperCase();
        socket.join(room);

        if (!rooms[room]) {
            rooms[room] = {
                players: {},
                status: 'Lobby',
                deck: [],
                discard: [],
                turnIndex: 0,
                isLastRound: false,
                finisherId: null
            };
        }

        rooms[room].players[socket.id] = {
            id: socket.id,
            name: name,
            grid: [],
            score: 0
        };

        // Mise à jour de la liste des joueurs pour tout le salon
        io.to(room).emit('updatePlayers', Object.values(rooms[room].players));
        
        // Envoi du top 5 des scores globaux
        const top = await Score.find().sort({ wins: -1 }).limit(5);
        socket.emit('updateLeaderboard', top);
    });

    /**
     * Lancer la partie
     */
    socket.on('startGame', (roomId) => {
        const r = rooms[roomId.toUpperCase()];
        if (!r) return;

        r.deck = createDeck();
        const playerIds = Object.keys(r.players);

        // Initialisation de la grille pour chaque joueur (3 lignes x 4 colonnes)
        playerIds.forEach(id => {
            r.players[id].grid = Array.from({length: 12}, () => ({
                value: r.deck.pop(),
                isVisible: false,
                removed: false
            }));
            // On révèle 2 cartes par défaut selon les règles
            r.players[id].grid[0].isVisible = true;
            r.players[id].grid[1].isVisible = true;
        });

        r.discard = [r.deck.pop()];
        r.status = 'Playing';
        r.turnIndex = 0;
        r.currentPlayerId = playerIds[0];

        io.to(roomId.toUpperCase()).emit('gameStarted', r);
    });

    /**
     * Action d'un joueur (Retourner une carte ou Échanger)
     */
    socket.on('playerAction', (data) => {
        const r = rooms[data.roomId.toUpperCase()];
        if (!r || socket.id !== r.currentPlayerId) return;

        const p = r.players[socket.id];

        // Application de l'action
        if (data.type === 'SWAP') {
            // On met l'ancienne carte dans la défausse
            r.discard.push(p.grid[data.index].value);
            // On remplace par la nouvelle
            p.grid[data.index] = { value: data.newValue, isVisible: true, removed: false };
        } else if (data.type === 'FLIP') {
            p.grid[data.index].isVisible = true;
        }

        // LOGIQUE DES COMBOS (Suppression des colonnes de 3 identiques)
        for (let col = 0; col < 4; col++) {
            let i1 = col, i2 = col + 4, i3 = col + 8;
            let c1 = p.grid[i1], c2 = p.grid[i2], c3 = p.grid[i3];

            if (c1.isVisible && c2.isVisible && c3.isVisible && !c1.removed) {
                if (c1.value === c2.value && c2.value === c3.value) {
                    c1.removed = c2.removed = c3.removed = true;
                    c1.value = 0; // Les cartes supprimées valent 0
                    c2.value = 0;
                    c3.value = 0;
                }
            }
        }

        // VÉRIFICATION DERNIER TOUR
        // Si un joueur a toutes ses cartes visibles ou supprimées
        if (!r.isLastRound && p.grid.every(c => c.isVisible || c.removed)) {
            r.isLastRound = true;
            r.finisherId = socket.id;
        }

        // Passage au joueur suivant
        const ids = Object.keys(r.players);
        r.turnIndex = (r.turnIndex + 1) % ids.length;
        r.currentPlayerId = ids[r.turnIndex];

        // FIN DE PARTIE : Si on revient au finisher après le dernier tour
        if (r.isLastRound && r.currentPlayerId === r.finisherId) {
            const finalScores = ids.map(id => {
                const total = r.players[id].grid.reduce((sum, c) => sum + c.value, 0);
                return { name: r.players[id].name, score: total };
            }).sort((a,b) => a.score - b.score);

            io.to(data.roomId.toUpperCase()).emit('gameOver', finalScores);
            
            // Sauvegarde de la victoire en base de données pour le premier
            Score.findOneAndUpdate(
                { name: finalScores[0].name }, 
                { $inc: { wins: 1 } }, 
                { upsert: true }
            ).exec();

            delete rooms[data.roomId.toUpperCase()];
        } else {
            // Sinon, mise à jour simple de l'état
            io.to(data.roomId.toUpperCase()).emit('gameState', r);
        }
    });

    /**
     * Chat
     */
    socket.on('sendChatMessage', (data) => {
        io.to(data.roomId.toUpperCase()).emit('receiveChatMessage', data);
    });

    /**
     * Déconnexion
     */
    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            if (rooms[room]) {
                delete rooms[room].players[socket.id];
                io.to(room).emit('updatePlayers', Object.values(rooms[room].players));
                // Si le salon est vide, on le supprime
                if (Object.keys(rooms[room].players).length === 0) delete rooms[room];
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});