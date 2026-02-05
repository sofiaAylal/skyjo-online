const socket = io();
let myRoom, myName, isMyTurn = false, selectedFromClick = null, tempDeckValue = null, lastRoundFired = false;

const sounds = {
    flip: new Audio('sounds/flip.mp3'),
    win: new Audio('sounds/win.mp3'),
    alert: new Audio('sounds/alert.mp3')
};
function playSnd(n) { sounds[n].play().catch(() => {}); }

function join() {
    myName = document.getElementById('player-name').value;
    myRoom = document.getElementById('room-input').value.toUpperCase();
    if(myName && myRoom) {
        socket.emit('joinRoom', { name: myName, roomId: myRoom });
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('lobby-container').style.display = 'flex';
    }
}

socket.on('updatePlayers', (p) => {
    document.getElementById('player-list').innerHTML = p.map(x => `<li style="margin:5px 0">👤 ${x.name}</li>`).join('');
    if(p.length >= 2 && p[0].id === socket.id) document.getElementById('start-btn').style.display = 'block';
});

function requestStart() { socket.emit('startGame', myRoom); }
socket.on('gameStarted', (s) => { 
    document.getElementById('lobby-container').style.display = 'none'; 
    document.getElementById('game-container').style.display = 'flex'; 
    updateUI(s); 
});
socket.on('gameState', updateUI);

function updateUI(state) {
    isMyTurn = state.currentPlayerId === socket.id;
    document.getElementById('turn-indicator').innerText = isMyTurn ? "⭐️ À TOI !" : "Tour de " + state.players[state.currentPlayerId].name;
    
    if (state.isLastRound && !lastRoundFired) {
        const popup = document.getElementById('last-round-popup');
        popup.classList.add('show');
        playSnd('alert');
        lastRoundFired = true;
        setTimeout(() => popup.classList.remove('show'), 5000);
    }

    const deckCont = document.getElementById('deck-cont');
    const discardCont = document.getElementById('discard-cont');
    const lastD = state.discard[state.discard.length-1];

    if(tempDeckValue !== null) {
        deckCont.classList.add('is-visible');
        document.getElementById('deck-val').innerText = tempDeckValue;
        document.getElementById('deck-val').className = `card-front ${getColorClass(tempDeckValue)}`;
    } else { deckCont.classList.remove('is-visible'); }
    
    deckCont.classList.toggle('selected', selectedFromClick === 'deck');
    document.getElementById('discard-val').innerText = lastD;
    document.getElementById('discard-val').className = `card-front ${getColorClass(lastD)}`;
    discardCont.classList.toggle('selected', selectedFromClick === 'discard');

    deckCont.onclick = () => { 
        if(isMyTurn) { 
            selectedFromClick = 'deck'; 
            if(tempDeckValue === null) { tempDeckValue = Math.floor(Math.random()*14)-2; playSnd('flip'); } 
            updateUI(state);
            try { deckCont.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
        } 
    };
    discardCont.onclick = () => { 
        if(isMyTurn) { 
            selectedFromClick = 'discard'; tempDeckValue = null; updateUI(state);
            try { discardCont.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
            // pulse highlight
            try { discardCont.classList.add('pulse'); setTimeout(() => discardCont.classList.remove('pulse'), 800); } catch(e){}
        } 
    };

    const gridDiv = document.getElementById('grid'); gridDiv.innerHTML = '';
    state.players[socket.id].grid.forEach((c, i) => {
        const container = document.createElement('div');
        container.className = `card-container ${c.isVisible ? 'is-visible' : ''} ${c.removed ? 'removed' : ''}`;
        container.innerHTML = `<div class="card-inner"><div class="card-back">?</div><div class="card-front ${getColorClass(c.value)}">${c.value}</div></div>`;
        // make keyboard-focusable and accessible as a button (basic)
        container.tabIndex = 0;
        container.setAttribute('role', 'button');
        container.setAttribute('aria-label', `Carte ${i+1} ${c.isVisible ? ('valeur ' + c.value) : 'cachée'}`);

        container.onclick = () => {
            if(!isMyTurn) return;
            if(selectedFromClick) {
                try { container.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
                socket.emit('playerAction', { type: 'SWAP', roomId: myRoom, index: i, newValue: selectedFromClick === 'deck' ? tempDeckValue : lastD });
                selectedFromClick = null; tempDeckValue = null; playSnd('flip');
                try { container.classList.add('pulse'); setTimeout(() => container.classList.remove('pulse'), 800); } catch(e){}
            } else if(!c.isVisible) {
                try { container.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
                socket.emit('playerAction', { type: 'FLIP', roomId: myRoom, index: i });
                playSnd('flip');
                try { container.classList.add('pulse'); setTimeout(() => container.classList.remove('pulse'), 800); } catch(e){}
            }
        };

        // keyboard support: Enter or Space triggers click
        container.addEventListener('keydown', (ev) => {
            if(ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault(); container.click();
            }
        });

        // pointer feedback for touch devices
        container.addEventListener('pointerdown', () => container.classList.add('pressed'));
        container.addEventListener('pointerup', () => container.classList.remove('pressed'));
        container.addEventListener('pointercancel', () => container.classList.remove('pressed'));

        gridDiv.appendChild(container);
    });

    const opp = document.getElementById('opponents-container'); opp.innerHTML = '';
    Object.values(state.players).forEach(p => {
        if(p.id !== socket.id) {
            const d = document.createElement('div'); d.className = 'opponent-mini';
            d.innerHTML = `<div style="font-size:0.6rem;text-align:center">${p.name}</div><div class="mini-grid"></div>`;
            p.grid.forEach(c => {
                const mc = document.createElement('div');
                if (c.removed) mc.className = 'card-mini';
                else { mc.className = `card-mini ${c.isVisible ? getColorClass(c.value) : 'back'}`; mc.innerText = c.isVisible ? c.value : ''; }
                d.querySelector('.mini-grid').appendChild(mc);
            });
            opp.appendChild(d);
        }
    });
}

function sendMsg() { const i = document.getElementById('chat-in'); if(i.value.trim()) { socket.emit('sendChatMessage', { name: myName, message: i.value, roomId: myRoom }); i.value = ''; } }
socket.on('receiveChatMessage', (d) => { const m = document.getElementById('messages'); m.innerHTML += `<div><b>${d.name}:</b> ${d.message}</div>`; m.scrollTop = m.scrollHeight; });
function toggleChat() { 
    const w = document.getElementById('chat-window');
    const isOpen = (w.style.display === 'flex');
    if(isOpen) {
        w.style.display = 'none';
    } else {
        w.style.display = 'flex';
        // focus input and ensure it's visible on mobile keyboards
        const inp = document.getElementById('chat-in');
        if(inp) {
            setTimeout(() => { try { inp.focus(); inp.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch(e){} }, 300);
        }
    }
}

// Accessibility: keyboard shortcuts and modal handling
document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') {
        // close scoreboard if open
        const sc = document.getElementById('scoreboard-container');
        if(sc && sc.style.display === 'flex') { hideScoreboard(); return; }
        // close chat
        const cw = document.getElementById('chat-window');
        if(cw && cw.style.display === 'flex') { toggleChat(); return; }
        // close win modal
        const wm = document.getElementById('win-modal');
        if(wm && wm.style.display === 'flex') { wm.style.display = 'none'; }
    }
});

// Improve chat message semantics when receiving
socket.off && socket.off('receiveChatMessage');
socket.on('receiveChatMessage', (d) => {
    const m = document.getElementById('messages');
    const item = document.createElement('div');
    item.setAttribute('role', 'listitem');
    item.innerHTML = `<b>${escapeHtml(d.name)}:</b> ${escapeHtml(d.message)}`;
    m.appendChild(item);
    m.scrollTop = m.scrollHeight;
});

// basic HTML escape
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
socket.on('gameOver', (res) => {
    document.getElementById('win-modal').style.display = 'flex';
    document.getElementById('winner-txt').innerText = "🏆 GAGNANT : " + res[0].name;
    document.getElementById('final-scores').innerHTML = res.map(r => `<p>${r.name}: ${r.score} pts</p>`).join('');
    
    // Sauvegarder le score du gagnant
    saveScore(res[0].name, res[0].score);
    
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    playSnd('win');
});
function getColorClass(v) { if(v < 0) return 'cat-neg'; if(v === 0) return 'cat-zero'; if(v <= 4) return 'cat-low'; if(v <= 8) return 'cat-mid'; return 'cat-high'; }

// ===== SCOREBOARD MANAGEMENT =====
let topScores = JSON.parse(localStorage.getItem('skyjo-topscores')) || [];

function saveScore(playerName, score) {
    topScores.push({ name: playerName, score: score });
    topScores.sort((a, b) => a.score - b.score); // scores croissants (meilleur = plus bas)
    topScores = topScores.slice(0, 5); // Garder top 5
    localStorage.setItem('skyjo-topscores', JSON.stringify(topScores));
}

function showScoreboard() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('scoreboard-container').style.display = 'flex';
    updateScoreboardDisplay();
}

function hideScoreboard() {
    document.getElementById('scoreboard-container').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
}

function updateScoreboardDisplay() {
    const list = document.getElementById('scoreboard-list');
    list.innerHTML = '';
    if(topScores.length === 0) {
        list.innerHTML = '<li style="text-align: center; color: #999;">Aucun score enregistré</li>';
    } else {
        topScores.forEach((entry, idx) => {
            const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][idx];
            const li = document.createElement('li');
            li.style.cssText = 'padding: 10px; margin: 5px 0; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
            li.innerHTML = `<span>${medal} ${entry.name}</span><span style="font-weight: bold; color: var(--gold);">${entry.score} pts</span>`;
            list.appendChild(li);
        });
    }
}

// Mobile UX helpers: ensure chat input and other focused inputs are visible
const chatInEl = document.getElementById('chat-in');
if(chatInEl) {
    chatInEl.addEventListener('focus', () => {
        // small delay lets mobile keyboard appear
        setTimeout(() => {
            const win = document.getElementById('chat-window');
            if(win) win.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 300);
    });
}

// When name input in main menu is focused on mobile, ensure menu scrolls so input is visible
const nameInput = document.getElementById('player-name');
if(nameInput) {
    nameInput.addEventListener('focus', () => {
        setTimeout(() => { try { nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){} }, 250);
    });
}

// Detect low battery or slow network to reduce visuals
(function detectAndReduceVisuals(){
    function applyReduce(){
        try { document.body.classList.add('reduce-visuals'); } catch(e){}
    }
    function removeReduce(){
        try { document.body.classList.remove('reduce-visuals'); } catch(e){}
    }
    // Network check
    try {
        const nav = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if(nav && nav.effectiveType) {
            const slow = ['slow-2g','2g','3g'].includes(nav.effectiveType);
            if(slow) applyReduce();
        }
    } catch(e){}
    // Battery check (if available)
    if(navigator.getBattery) {
        try {
            navigator.getBattery().then(batt => {
                if(typeof batt.level === 'number' && batt.level <= 0.18 && !batt.charging) applyReduce();
                // also listen for changes
                batt.addEventListener('levelchange', () => { if(batt.level <= 0.18 && !batt.charging) applyReduce(); else removeReduce(); });
                batt.addEventListener('chargingchange', () => { if(batt.charging) removeReduce(); });
            }).catch(()=>{});
        } catch(e){}
    }
})();