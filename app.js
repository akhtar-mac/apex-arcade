/**
 * APEXBET — Next-Gen Sportsbook, Live In-Play Arena & Provably Fair Casino Engine
 * Complete interactive frontend logic with Web Audio synthesizer, canvas crash engine,
 * interactive pitch radar, plinko physics, dynamic betslip, and odds fluctuations.
 */

// ==========================================
// 1. STATE & STORAGE
// ==========================================
const AppState = {
    balance: parseFloat(localStorage.getItem('apex_balance')) || 2500.00,
    oddsFormat: localStorage.getItem('apex_odds_format') || 'decimal',
    soundEnabled: localStorage.getItem('apex_sound') !== 'false',
    currentSportFilter: 'all',
    currentSubFilter: 'all',
    activeView: 'sports',
    betslip: [], // Array of selection objects
    activeBets: JSON.parse(localStorage.getItem('apex_active_bets') || '[]'),
    settledBets: JSON.parse(localStorage.getItem('apex_settled_bets') || '[]'),
    
    // Crash game state
    crash: {
        state: 'waiting', // 'waiting' | 'flying' | 'crashed'
        multiplier: 1.00,
        crashPoint: 2.45,
        userBet: null, // { amount, autoCashout, cashedOut: bool }
        history: [1.82, 3.45, 1.12, 14.20, 2.05, 1.40, 5.60, 1.15, 2.80, 8.42],
        players: [],
        countdown: 4.0
    },

    // Plinko state
    plinko: {
        balls: [],
        risk: 'med',
        recentDrops: [1.5, 0.5, 3.0, 0.2, 1.5]
    }
};

// ==========================================
// 2. WEB AUDIO API SYNTHESIZER
// ==========================================
class SoundFX {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playClick() {
        if (!AppState.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playSelectOdd() {
        if (!AppState.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1040, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playBetPlaced() {
        if (!AppState.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc1.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.08);
        osc2.frequency.setValueAtTime(554.37, this.ctx.currentTime);
        osc2.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08);
        
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.3);
        osc2.stop(this.ctx.currentTime + 0.3);
    }

    playWin() {
        if (!AppState.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (idx * 0.08));
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime + (idx * 0.08));
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (idx * 0.08) + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + (idx * 0.08));
            osc.stop(this.ctx.currentTime + (idx * 0.08) + 0.25);
        });
    }

    playCrashBoom() {
        if (!AppState.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.35);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }

    playPlinkoBounce() {
        if (!AppState.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const freqs = [600, 750, 900, 1100];
        const randomFreq = freqs[Math.floor(Math.random() * freqs.length)];
        osc.frequency.setValueAtTime(randomFreq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
    }
}

const AudioPlayer = new SoundFX();

// ==========================================
// 3. SPORTSBOOK MATCHES DATABASE
// ==========================================
const MatchesDatabase = [
    {
        id: 'm1',
        sport: 'soccer',
        league: 'UEFA Champions League',
        leagueCode: 'ucl',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        isLive: true,
        time: "38' 1st Half",
        homeScore: 1,
        awayScore: 0,
        markets: {
            home: 1.62,
            draw: 3.80,
            away: 5.40,
            over25: 1.85
        }
    },
    {
        id: 'm2',
        sport: 'basketball',
        league: 'NBA Basketball',
        leagueCode: 'nba',
        homeTeam: 'LA Lakers',
        awayTeam: 'Golden State Warriors',
        isLive: true,
        time: 'Q3 04:12',
        homeScore: 84,
        awayScore: 89,
        markets: {
            home: 2.15,
            draw: 14.0,
            away: 1.72,
            over25: 1.90 // Over 225.5
        }
    },
    {
        id: 'm3',
        sport: 'tennis',
        league: 'ATP Shanghai Masters',
        leagueCode: 'tennis',
        homeTeam: 'Carlos Alcaraz',
        awayTeam: 'Novak Djokovic',
        isLive: true,
        time: 'Set 2 (6-4, 4-4)',
        homeScore: 1,
        awayScore: 0,
        markets: {
            home: 1.55,
            draw: 0,
            away: 2.45,
            over25: 1.95
        }
    },
    {
        id: 'm4',
        sport: 'cricket',
        league: 'ICC World Cup',
        leagueCode: 'cricket',
        homeTeam: 'India',
        awayTeam: 'Australia',
        isLive: true,
        time: '34.2 Overs (218/3)',
        homeScore: 218,
        awayScore: 0,
        markets: {
            home: 1.44,
            draw: 25.0,
            away: 2.80,
            over25: 1.80
        }
    },
    {
        id: 'm5',
        sport: 'soccer',
        league: 'Premier League',
        leagueCode: 'epl',
        homeTeam: 'Liverpool',
        awayTeam: 'Manchester United',
        isLive: false,
        time: 'Today 19:30',
        homeScore: null,
        awayScore: null,
        markets: {
            home: 1.52,
            draw: 4.40,
            away: 6.00,
            over25: 1.65
        }
    },
    {
        id: 'm6',
        sport: 'esports',
        league: 'CS2 Major Championship',
        leagueCode: 'esports',
        homeTeam: 'FaZe Clan',
        awayTeam: 'Natus Vincere',
        isLive: true,
        time: 'Map 2 (11 - 9)',
        homeScore: 1,
        awayScore: 0,
        markets: {
            home: 1.85,
            draw: 0,
            away: 1.95,
            over25: 2.05
        }
    },
    {
        id: 'm7',
        sport: 'americanfootball',
        league: 'NFL Football',
        leagueCode: 'nfl',
        homeTeam: 'Kansas City Chiefs',
        awayTeam: 'SF 49ers',
        isLive: false,
        time: 'Tonight 20:15',
        homeScore: null,
        awayScore: null,
        markets: {
            home: 1.80,
            draw: 15.0,
            away: 2.05,
            over25: 1.90
        }
    },
    {
        id: 'm8',
        sport: 'mma',
        league: 'UFC 308 Main Event',
        leagueCode: 'mma',
        homeTeam: 'Islam Makhachev',
        awayTeam: 'Arman Tsarukyan',
        isLive: false,
        time: 'Saturday 22:00',
        homeScore: null,
        awayScore: null,
        markets: {
            home: 1.35,
            draw: 40.0,
            away: 3.30,
            over25: 2.10
        }
    },
    {
        id: 'm9',
        sport: 'soccer',
        league: 'La Liga',
        leagueCode: 'laliga',
        homeTeam: 'Barcelona',
        awayTeam: 'Atletico Madrid',
        isLive: false,
        time: 'Tomorrow 20:00',
        homeScore: null,
        awayScore: null,
        markets: {
            home: 1.90,
            draw: 3.50,
            away: 3.90,
            over25: 1.75
        }
    }
];

// Odds Formatter
function formatOdds(decimalVal) {
    const val = parseFloat(decimalVal);
    if (!val || isNaN(val)) return '1.00';
    if (AppState.oddsFormat === 'fractional') {
        const d = val - 1;
        // Approximate fractional
        if (Math.abs(d - 0.5) < 0.05) return '1/2';
        if (Math.abs(d - 1.0) < 0.05) return '1/1';
        if (Math.abs(d - 1.5) < 0.05) return '3/2';
        if (Math.abs(d - 2.0) < 0.05) return '2/1';
        if (Math.abs(d - 0.33) < 0.05) return '1/3';
        return `${d.toFixed(1)}/1`;
    } else if (AppState.oddsFormat === 'american') {
        if (val >= 2.0) {
            return `+${Math.round((val - 1) * 100)}`;
        } else {
            return `-${Math.round(100 / (val - 1))}`;
        }
    }
    return val.toFixed(2);
}

// Toast System
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==========================================
// 4. RENDERING & UI SYNC
// ==========================================
function updateBalanceDisplay() {
    const balanceEl = document.getElementById('userBalanceDisplay');
    if (balanceEl) {
        balanceEl.textContent = `$${AppState.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    localStorage.setItem('apex_balance', AppState.balance.toString());
}

function updateActiveBetsBadge() {
    const count = AppState.activeBets.length;
    const badge = document.getElementById('activeBetsBadge');
    if (badge) badge.textContent = count;
    const tabCount = document.getElementById('activeBetsTabCount');
    if (tabCount) tabCount.textContent = count;
    const settledCount = document.getElementById('settledBetsTabCount');
    if (settledCount) settledCount.textContent = AppState.settledBets.length;
}

function renderMatches() {
    const container = document.getElementById('matchesListContainer');
    if (!container) return;

    let filtered = MatchesDatabase.filter(m => {
        if (AppState.currentSportFilter !== 'all') {
            if (m.sport !== AppState.currentSportFilter && m.leagueCode !== AppState.currentSportFilter) {
                return false;
            }
        }
        if (AppState.currentSubFilter === 'live' && !m.isLive) return false;
        if (AppState.currentSubFilter === 'upcoming' && m.isLive) return false;
        return true;
    });

    const searchInput = document.getElementById('matchSearchInput');
    if (searchInput && searchInput.value.trim() !== '') {
        const query = searchInput.value.trim().toLowerCase();
        filtered = filtered.filter(m => 
            m.homeTeam.toLowerCase().includes(query) ||
            m.awayTeam.toLowerCase().includes(query) ||
            m.league.toLowerCase().includes(query)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg);">
                <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
                <h4 style="color: #fff; margin-bottom: 4px;">No Matches Found</h4>
                <p style="font-size: 12px;">Try selecting another sport category or clearing the search query.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(match => {
        const is1Selected = isOddSelected(match.id, match.homeTeam);
        const isXSelected = isOddSelected(match.id, 'Draw');
        const is2Selected = isOddSelected(match.id, match.awayTeam);
        const isOverSelected = isOddSelected(match.id, 'Over 2.5 Goals');

        return `
            <div class="match-card" data-match-id="${match.id}">
                <div class="match-meta-col">
                    <div class="match-league-row">
                        <span>${match.league}</span>
                        ${match.isLive ? `<span class="live-tag"><span class="live-dot pulse"></span> LIVE</span>` : ''}
                    </div>
                    <div class="match-teams">
                        <div class="team-line">
                            <span>${match.homeTeam}</span>
                            ${match.homeScore !== null ? `<span class="team-score">${match.homeScore}</span>` : ''}
                        </div>
                        <div class="team-line">
                            <span>${match.awayTeam}</span>
                            ${match.awayScore !== null ? `<span class="team-score">${match.awayScore}</span>` : ''}
                        </div>
                    </div>
                    <div class="match-time-tag">${match.time}</div>
                </div>

                <div class="match-markets-col">
                    <button class="odd-box-btn ${is1Selected ? 'selected' : ''}" 
                        data-match-id="${match.id}"
                        data-match-name="${match.homeTeam} vs ${match.awayTeam}"
                        data-league="${match.league}"
                        data-market="Match Result (1X2)"
                        data-selection="${match.homeTeam}"
                        data-odd="${match.markets.home}">
                        <span class="odd-title">1</span>
                        <span class="odd-value" id="odd-${match.id}-home">${formatOdds(match.markets.home)}</span>
                    </button>

                    ${match.markets.draw > 0 ? `
                        <button class="odd-box-btn ${isXSelected ? 'selected' : ''}" 
                            data-match-id="${match.id}"
                            data-match-name="${match.homeTeam} vs ${match.awayTeam}"
                            data-league="${match.league}"
                            data-market="Match Result (1X2)"
                            data-selection="Draw"
                            data-odd="${match.markets.draw}">
                            <span class="odd-title">X</span>
                            <span class="odd-value" id="odd-${match.id}-draw">${formatOdds(match.markets.draw)}</span>
                        </button>
                    ` : `
                        <button class="odd-box-btn" disabled style="opacity: 0.3; cursor: default;">
                            <span class="odd-title">-</span>
                            <span class="odd-value">-</span>
                        </button>
                    `}

                    <button class="odd-box-btn ${is2Selected ? 'selected' : ''}" 
                        data-match-id="${match.id}"
                        data-match-name="${match.homeTeam} vs ${match.awayTeam}"
                        data-league="${match.league}"
                        data-market="Match Result (1X2)"
                        data-selection="${match.awayTeam}"
                        data-odd="${match.markets.away}">
                        <span class="odd-title">2</span>
                        <span class="odd-value" id="odd-${match.id}-away">${formatOdds(match.markets.away)}</span>
                    </button>

                    <button class="odd-box-btn ${isOverSelected ? 'selected' : ''}" 
                        data-match-id="${match.id}"
                        data-match-name="${match.homeTeam} vs ${match.awayTeam}"
                        data-league="${match.league}"
                        data-market="Over/Under 2.5"
                        data-selection="Over 2.5 Goals"
                        data-odd="${match.markets.over25}">
                        <span class="odd-title">Over 2.5</span>
                        <span class="odd-value" id="odd-${match.id}-over">${formatOdds(match.markets.over25)}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    attachOddsClickHandlers();
}

function isOddSelected(matchId, selection) {
    return AppState.betslip.some(item => item.matchId === matchId && item.selection === selection);
}

function attachOddsClickHandlers() {
    document.querySelectorAll('.odd-box-btn, .hero-odd-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            if (btnEl.disabled) return;
            const matchId = btnEl.dataset.matchId;
            const matchName = btnEl.dataset.matchName;
            const league = btnEl.dataset.league;
            const market = btnEl.dataset.market;
            const selection = btnEl.dataset.selection;
            const odd = parseFloat(btnEl.dataset.odd);

            toggleBetSelection({ matchId, matchName, league, market, selection, odd }, btnEl);
        });
    });
}

function toggleBetSelection(item, element) {
    const existingIndex = AppState.betslip.findIndex(
        s => s.matchId === item.matchId && s.selection === item.selection
    );

    if (existingIndex > -1) {
        // Remove
        AppState.betslip.splice(existingIndex, 1);
        if (element) element.classList.remove('selected');
        AudioPlayer.playClick();
    } else {
        // Same match filter: replace if same match exists in single mode or allow parlay
        const sameMatchIndex = AppState.betslip.findIndex(s => s.matchId === item.matchId);
        if (sameMatchIndex > -1) {
            AppState.betslip.splice(sameMatchIndex, 1);
        }
        AppState.betslip.push(item);
        if (element) element.classList.add('selected');
        AudioPlayer.playSelectOdd();
    }

    renderBetslip();
    renderMatches(); // Update selected styling in cards
}

// ==========================================
// 5. BETSLIP SYSTEM & CALCULATIONS
// ==========================================
let currentSlipMode = 'single'; // 'single' | 'parlay'

function renderBetslip() {
    const countBadge = document.getElementById('slipCountBadge');
    const mobileCount = document.getElementById('mobileBetslipCount');
    const emptyState = document.getElementById('betslipEmptyState');
    const itemsContainer = document.getElementById('betslipItemsContainer');
    const footer = document.getElementById('betslipFooter');
    const combinedOddsDisplay = document.getElementById('combinedOddsDisplay');
    const potentialPayoutDisplay = document.getElementById('potentialPayoutDisplay');
    const parlayBonusLine = document.getElementById('parlayBonusLine');
    const parlayBoostAmount = document.getElementById('parlayBoostAmount');
    const placeBetBtnText = document.getElementById('placeBetBtnText');
    const stakeInput = document.getElementById('globalStakeInput');

    const totalCount = AppState.betslip.length;
    if (countBadge) countBadge.textContent = totalCount;
    if (mobileCount) mobileCount.textContent = totalCount;

    if (totalCount === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (itemsContainer) itemsContainer.innerHTML = '';
        if (footer) footer.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (footer) footer.style.display = 'flex';

    // Render items
    if (itemsContainer) {
        itemsContainer.innerHTML = AppState.betslip.map((item, idx) => `
            <div class="slip-item-card">
                <div class="slip-item-header">
                    <div>
                        <div class="slip-selection-title">${item.selection}</div>
                        <div class="slip-market-name">${item.market}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="slip-odd-val">${formatOdds(item.odd)}</span>
                        <button class="slip-item-remove-btn" data-index="${idx}" title="Remove selection">✕</button>
                    </div>
                </div>
                <div class="slip-match-info">${item.matchName} • ${item.league}</div>
            </div>
        `).join('');

        // Attach removal buttons
        itemsContainer.querySelectorAll('.slip-item-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index, 10);
                AppState.betslip.splice(idx, 1);
                AudioPlayer.playClick();
                renderBetslip();
                renderMatches();
            });
        });
    }

    // Calculations
    const stake = parseFloat(stakeInput.value) || 25;
    let totalOdds = 1.00;
    let bonusMultiplier = 1.0;

    if (currentSlipMode === 'single') {
        // Average or individual payout sum
        let totalReturn = 0;
        AppState.betslip.forEach(s => {
            totalReturn += (stake / AppState.betslip.length) * s.odd;
        });
        totalOdds = AppState.betslip.reduce((acc, curr) => acc + curr.odd, 0) / AppState.betslip.length;
        if (combinedOddsDisplay) combinedOddsDisplay.textContent = formatOdds(totalOdds);
        if (potentialPayoutDisplay) potentialPayoutDisplay.textContent = `$${totalReturn.toFixed(2)}`;
        if (parlayBonusLine) parlayBonusLine.style.display = 'none';
    } else {
        // Parlay / Accumulator combo!
        AppState.betslip.forEach(s => {
            totalOdds *= s.odd;
        });
        // Bonus boost based on legs
        if (totalCount >= 2) bonusMultiplier = 1 + (totalCount * 0.05); // 10%, 15%, etc.
        const baseReturn = stake * totalOdds;
        const finalReturn = baseReturn * bonusMultiplier;
        const bonusMoney = finalReturn - baseReturn;

        if (combinedOddsDisplay) combinedOddsDisplay.textContent = formatOdds(totalOdds);
        if (potentialPayoutDisplay) potentialPayoutDisplay.textContent = `$${finalReturn.toFixed(2)}`;
        if (parlayBonusLine) {
            parlayBonusLine.style.display = 'flex';
            if (parlayBoostAmount) parlayBoostAmount.textContent = `+$${bonusMoney.toFixed(2)} (+${Math.round((bonusMultiplier - 1) * 100)}%)`;
        }
    }

    if (placeBetBtnText) {
        placeBetBtnText.textContent = `PLACE BET ($${stake.toFixed(2)})`;
    }
}

function placeUserBet() {
    const stakeInput = document.getElementById('globalStakeInput');
    const stake = parseFloat(stakeInput.value) || 25;

    if (AppState.betslip.length === 0) {
        showToast('Please add at least 1 selection to place a bet.', 'error');
        return;
    }

    if (AppState.balance < stake) {
        showToast('Insufficient balance! Claim free chips via the Wallet modal.', 'error');
        AudioPlayer.playCrashBoom();
        return;
    }

    // Deduct balance
    AppState.balance -= stake;
    updateBalanceDisplay();
    AudioPlayer.playBetPlaced();

    // Create bet object
    const newBet = {
        id: 'bet_' + Date.now(),
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: currentSlipMode,
        stake: stake,
        selections: [...AppState.betslip],
        potentialPayout: document.getElementById('potentialPayoutDisplay').textContent,
        cashoutValue: (stake * 0.92).toFixed(2), // Initial cashout offer
        status: 'Active'
    };

    AppState.activeBets.unshift(newBet);
    localStorage.setItem('apex_active_bets', JSON.stringify(AppState.activeBets));
    updateActiveBetsBadge();

    showToast(`Bet of $${stake.toFixed(2)} placed successfully! Good luck!`, 'success');

    // Simulate settlement after 25 seconds for exciting gamified feedback!
    scheduleSimulatedSettlement(newBet.id);

    // Clear slip
    AppState.betslip = [];
    renderBetslip();
    renderMatches();
}

function scheduleSimulatedSettlement(betId) {
    setTimeout(() => {
        const betIndex = AppState.activeBets.findIndex(b => b.id === betId);
        if (betIndex === -1) return; // Already cashed out or removed

        const bet = AppState.activeBets[betIndex];
        // 65% win chance for thrilling gameplay demo
        const isWin = Math.random() < 0.65;
        const payout = parseFloat(bet.potentialPayout.replace('$', '').replace(',', ''));

        AppState.activeBets.splice(betIndex, 1);

        if (isWin) {
            AppState.balance += payout;
            updateBalanceDisplay();
            AudioPlayer.playWin();
            bet.status = 'WON';
            bet.finalProfit = `+$${(payout - bet.stake).toFixed(2)}`;
            showToast(`🎉 WINNER! Your bet ${bet.id} won ${bet.potentialPayout}!`, 'success');
        } else {
            bet.status = 'LOST';
            bet.finalProfit = `-$${bet.stake.toFixed(2)}`;
            showToast(`Match ended: Bet ${bet.id} missed on this round.`, 'info');
        }

        AppState.settledBets.unshift(bet);
        localStorage.setItem('apex_active_bets', JSON.stringify(AppState.activeBets));
        localStorage.setItem('apex_settled_bets', JSON.stringify(AppState.settledBets));
        updateActiveBetsBadge();
        renderMyBetsPortfolio();
    }, 28000);
}

// Cashout active bet early
function cashoutActiveBet(betId) {
    const betIndex = AppState.activeBets.findIndex(b => b.id === betId);
    if (betIndex === -1) return;
    const bet = AppState.activeBets[betIndex];
    const cashoutAmount = parseFloat(bet.cashoutValue);

    AppState.balance += cashoutAmount;
    updateBalanceDisplay();
    AudioPlayer.playWin();

    bet.status = 'CASHED OUT';
    bet.finalProfit = `$${cashoutAmount.toFixed(2)}`;
    AppState.activeBets.splice(betIndex, 1);
    AppState.settledBets.unshift(bet);

    localStorage.setItem('apex_active_bets', JSON.stringify(AppState.activeBets));
    localStorage.setItem('apex_settled_bets', JSON.stringify(AppState.settledBets));
    updateActiveBetsBadge();
    renderMyBetsPortfolio();

    showToast(`Cashed out early for $${cashoutAmount.toFixed(2)}!`, 'success');
}

// ==========================================
// 6. REAL-TIME ODDS FLICKER & PITCH SIMULATOR
// ==========================================
function startOddsFluctuations() {
    setInterval(() => {
        // Randomly pick a live match
        const liveMatches = MatchesDatabase.filter(m => m.isLive);
        if (liveMatches.length === 0) return;
        const match = liveMatches[Math.floor(Math.random() * liveMatches.length)];
        
        // Pick market
        const markets = ['home', 'away', 'over25'];
        const chosenMarket = markets[Math.floor(Math.random() * markets.length)];
        const delta = (Math.random() * 0.12 - 0.06);
        let newOdd = Math.max(1.05, match.markets[chosenMarket] + delta);
        newOdd = parseFloat(newOdd.toFixed(2));
        const isUp = newOdd > match.markets[chosenMarket];
        match.markets[chosenMarket] = newOdd;

        // If rendered, highlight element
        const oddEl = document.getElementById(`odd-${match.id}-${chosenMarket}`);
        if (oddEl) {
            oddEl.textContent = formatOdds(newOdd);
            const parentBtn = oddEl.closest('.odd-box-btn');
            if (parentBtn) {
                parentBtn.classList.remove('flash-up', 'flash-down');
                void parentBtn.offsetWidth; // trigger reflow
                parentBtn.classList.add(isUp ? 'flash-up' : 'flash-down');
                parentBtn.dataset.odd = newOdd;
            }
        }
    }, 3800);
}

// Pitch Radar Simulation
const pitchEvents = [
    { text: "🔥 DANGEROUS ATTACK — Vini Jr. on the left wing!", x: 78, y: 35, poss: 58 },
    { text: "⚽ SHOT ON TARGET — Saved brilliantly by Ederson!", x: 88, y: 50, poss: 62 },
    { text: "⚡ COUNTER ATTACK — Haaland breaking through the middle!", x: 28, y: 52, poss: 48 },
    { text: "🚩 CORNER KICK for Real Madrid — Packed penalty box!", x: 92, y: 18, poss: 55 },
    { text: "🛡️ TACKLE by Rudiger — Ball cleared to midfield!", x: 48, y: 46, poss: 52 },
    { text: "🎯 FREE KICK — De Bruyne standing over the dead ball...", x: 34, y: 64, poss: 45 }
];
let currentPitchEventIdx = 0;

function startPitchSimulator() {
    const ball = document.getElementById('pitchBall');
    const badge = document.getElementById('heroLiveEventBadge');
    const possFill = document.getElementById('possessionFill');
    const timeEl = document.getElementById('heroMatchTime');

    let minute = 78;

    setInterval(() => {
        currentPitchEventIdx = (currentPitchEventIdx + 1) % pitchEvents.length;
        const ev = pitchEvents[currentPitchEventIdx];

        if (ball) {
            ball.style.left = `${ev.x}%`;
            ball.style.top = `${ev.y}%`;
        }
        if (badge) {
            badge.textContent = ev.text;
        }
        if (possFill) {
            possFill.style.width = `${ev.poss}%`;
        }
        if (timeEl && minute < 94) {
            minute += 1;
            timeEl.textContent = `${minute}' 2nd Half`;
        }
    }, 4500);
}

// ==========================================
// 7. APEX CRASH GAME ENGINE (60 FPS CANVAS)
// ==========================================
class CrashGameEngine {
    constructor() {
        this.canvas = document.getElementById('crashCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.multiplier = 1.00;
        this.crashPoint = 2.30;
        this.state = 'waiting'; // waiting, flying, crashed
        this.countdown = 4.0;
        this.startTime = 0;
        this.userBet = null;
        this.particles = [];
        this.mockPlayers = [];
        this.init();
    }

    init() {
        if (!this.canvas) return;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.renderHistoryStrip();
        this.generateMockPlayers();
        this.startLoop();
        this.setupEventListeners();
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    generateMockPlayers() {
        const names = ['CryptoWhale', 'ApexSniper', 'LuckyStreak', 'Satoshi99', 'Elena_Pro', 'VegasKing', 'NightRider', 'AlphaBet'];
        this.mockPlayers = names.map(name => ({
            name,
            bet: Math.floor(Math.random() * 200 + 20),
            autoCashout: (Math.random() * 4 + 1.2).toFixed(2),
            cashedOut: false,
            profit: 0
        }));
        this.renderPlayersTable();
    }

    renderPlayersTable() {
        const tbody = document.getElementById('crashPlayersTableBody');
        if (!tbody) return;
        tbody.innerHTML = this.mockPlayers.map(p => `
            <tr>
                <td style="font-weight: 700; color: #fff;">${p.name}</td>
                <td style="color: var(--text-secondary);">$${p.bet.toFixed(2)}</td>
                <td>${p.cashedOut ? `<span style="color: var(--accent-emerald); font-weight: 800;">${p.autoCashout}x</span>` : `<span style="color: var(--text-muted);">-</span>`}</td>
                <td>${p.cashedOut ? `<span style="color: var(--accent-emerald); font-weight: 800;">+$${p.profit.toFixed(2)}</span>` : `<span style="color: var(--text-muted);">-</span>`}</td>
            </tr>
        `).join('');
    }

    setupEventListeners() {
        const mainBtn = document.getElementById('crashMainActionBtn');
        const betInput = document.getElementById('crashBetAmount');
        const autoInput = document.getElementById('crashAutoCashout');

        if (mainBtn) {
            mainBtn.addEventListener('click', () => {
                if (this.state === 'waiting') {
                    // Place bet
                    const amount = parseFloat(betInput.value) || 50;
                    if (AppState.balance < amount) {
                        showToast('Insufficient funds for Crash bet!', 'error');
                        return;
                    }
                    AppState.balance -= amount;
                    updateBalanceDisplay();
                    AudioPlayer.playBetPlaced();

                    this.userBet = {
                        amount: amount,
                        autoCashout: parseFloat(autoInput.value) || 2.0,
                        cashedOut: false
                    };

                    mainBtn.classList.add('cashout-state');
                    document.getElementById('crashBtnText').textContent = 'BET QUEUED';
                    document.getElementById('crashBtnSub').textContent = `Amount: $${amount.toFixed(2)}`;
                    showToast(`Crash bet of $${amount.toFixed(2)} queued!`, 'info');
                } else if (this.state === 'flying' && this.userBet && !this.userBet.cashedOut) {
                    // Manual cash out!
                    this.cashOutUser();
                }
            });
        }

        // Quick multiplier buttons
        const set2x = document.getElementById('crashSet2x');
        const set5x = document.getElementById('crashSet5x');
        const set10x = document.getElementById('crashSet10x');
        if (set2x) set2x.onclick = () => autoInput.value = '2.00';
        if (set5x) set5x.onclick = () => autoInput.value = '5.00';
        if (set10x) set10x.onclick = () => autoInput.value = '10.00';

        const halfBtn = document.getElementById('crashHalfBtn');
        const doubleBtn = document.getElementById('crashDoubleBtn');
        const maxBtn = document.getElementById('crashMaxBtn');
        if (halfBtn) halfBtn.onclick = () => betInput.value = Math.max(1, Math.floor(parseFloat(betInput.value) / 2));
        if (doubleBtn) doubleBtn.onclick = () => betInput.value = Math.floor(parseFloat(betInput.value) * 2);
        if (maxBtn) maxBtn.onclick = () => betInput.value = Math.min(1000, Math.floor(AppState.balance));
    }

    cashOutUser() {
        if (!this.userBet || this.userBet.cashedOut) return;
        this.userBet.cashedOut = true;
        const winAmount = this.userBet.amount * this.multiplier;
        AppState.balance += winAmount;
        updateBalanceDisplay();
        AudioPlayer.playWin();

        const mainBtn = document.getElementById('crashMainActionBtn');
        if (mainBtn) {
            mainBtn.classList.remove('cashout-state');
            document.getElementById('crashBtnText').textContent = 'CASHED OUT!';
            document.getElementById('crashBtnSub').textContent = `Won $${winAmount.toFixed(2)}`;
        }
        showToast(`🚀 CASHED OUT at ${this.multiplier.toFixed(2)}x! Won $${winAmount.toFixed(2)}!`, 'success');
    }

    startLoop() {
        let lastTime = performance.now();
        const loop = (currentTime) => {
            const dt = (currentTime - lastTime) / 1000;
            lastTime = currentTime;
            this.update(dt);
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update(dt) {
        const overlayMult = document.getElementById('crashMultiplierBig');
        const stateMsg = document.getElementById('crashStateMsg');
        const mainBtn = document.getElementById('crashMainActionBtn');

        if (this.state === 'waiting') {
            this.countdown -= dt;
            if (overlayMult) {
                overlayMult.classList.remove('crashed');
                overlayMult.textContent = `${Math.max(0, this.countdown).toFixed(1)}s`;
            }
            if (stateMsg) stateMsg.textContent = 'Next Rocket Launch in...';

            if (this.countdown <= 0) {
                // Launch rocket!
                this.state = 'flying';
                this.multiplier = 1.00;
                // Generate crash point (house edge formula)
                const r = Math.random();
                this.crashPoint = Math.max(1.05, +(1 / (1 - r * 0.95)).toFixed(2));
                this.generateMockPlayers();

                if (this.userBet) {
                    if (mainBtn) {
                        mainBtn.classList.add('cashout-state');
                    }
                }
            }
        } else if (this.state === 'flying') {
            // Multiplier growth speed
            this.multiplier += this.multiplier * 0.28 * dt;

            if (overlayMult) {
                overlayMult.textContent = `${this.multiplier.toFixed(2)}x`;
            }
            if (stateMsg) stateMsg.textContent = 'Soaring to the moon...';

            // Check auto cashout
            if (this.userBet && !this.userBet.cashedOut) {
                const currentProfit = (this.userBet.amount * this.multiplier).toFixed(2);
                document.getElementById('crashBtnText').textContent = `CASH OUT $${currentProfit}`;
                document.getElementById('crashBtnSub').textContent = `Profit +$${(currentProfit - this.userBet.amount).toFixed(2)}`;

                if (this.multiplier >= this.userBet.autoCashout) {
                    this.cashOutUser();
                }
            }

            // Check mock players
            this.mockPlayers.forEach(p => {
                if (!p.cashedOut && this.multiplier >= parseFloat(p.autoCashout)) {
                    p.cashedOut = true;
                    p.profit = (p.bet * p.autoCashout) - p.bet;
                    this.renderPlayersTable();
                }
            });

            // Check if crashed
            if (this.multiplier >= this.crashPoint) {
                this.state = 'crashed';
                this.countdown = 3.5;
                AudioPlayer.playCrashBoom();

                // Spawn explosion particles
                this.spawnParticles();

                if (overlayMult) {
                    overlayMult.classList.add('crashed');
                    overlayMult.textContent = `CRASHED @ ${this.crashPoint.toFixed(2)}x`;
                }
                if (stateMsg) stateMsg.textContent = 'Rocket detonated! Preparing next launch...';

                // Add to history
                AppState.crash.history.unshift(this.crashPoint);
                if (AppState.crash.history.length > 10) AppState.crash.history.pop();
                this.renderHistoryStrip();

                if (this.userBet && !this.userBet.cashedOut) {
                    showToast(`Rocket crashed at ${this.crashPoint.toFixed(2)}x. Bet lost.`, 'error');
                }

                this.userBet = null;
                if (mainBtn) {
                    mainBtn.classList.remove('cashout-state');
                    document.getElementById('crashBtnText').textContent = 'PLACE BET';
                    document.getElementById('crashBtnSub').textContent = 'Next round in 3s';
                }
            }
        } else if (this.state === 'crashed') {
            this.countdown -= dt;
            if (this.countdown <= 0) {
                this.state = 'waiting';
                this.countdown = 4.0;
            }
        }

        // Update particles
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt;
        });
        this.particles = this.particles.filter(p => p.life > 0);
    }

    spawnParticles() {
        if (!this.canvas) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: w * 0.75,
                y: h * 0.35,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                color: Math.random() > 0.5 ? '#ff3366' : '#ffb800',
                size: Math.random() * 5 + 2,
                life: Math.random() * 0.8 + 0.3
            });
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 40; x < w; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 30; y < h; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Draw curve if flying or crashed
        if (this.state === 'flying' || this.state === 'crashed') {
            const startX = 40;
            const startY = h - 40;
            const progress = Math.min(1, (this.multiplier - 1) / (this.crashPoint * 1.2));
            const endX = startX + (w - 120) * Math.min(1, (this.multiplier - 1) / 5);
            const endY = startY - (h - 100) * Math.min(1, Math.pow(this.multiplier - 1, 0.6) / 2.5);

            // Curve glow gradient
            const grad = ctx.createLinearGradient(startX, startY, endX, endY);
            if (this.state === 'crashed') {
                grad.addColorStop(0, 'rgba(255, 51, 102, 0.1)');
                grad.addColorStop(1, '#ff3366');
            } else {
                grad.addColorStop(0, 'rgba(13, 245, 157, 0.1)');
                grad.addColorStop(0.7, '#0df59d');
                grad.addColorStop(1, '#00e5ff');
            }

            // Draw line
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(startX + (endX - startX) * 0.4, startY, endX, endY);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 4;
            ctx.stroke();

            // Rocket Icon / Glowing Head
            if (this.state === 'flying') {
                ctx.save();
                ctx.translate(endX, endY);
                ctx.shadowColor = '#0df59d';
                ctx.shadowBlur = 18;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();

                // Rocket emoji / flame
                ctx.font = '22px sans-serif';
                ctx.fillText('🚀', -10, -6);
                ctx.restore();
            }
        }

        // Draw particles
        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    renderHistoryStrip() {
        const bar = document.getElementById('crashHistoryBar');
        if (!bar) return;
        bar.innerHTML = AppState.crash.history.map(val => {
            let cls = 'low';
            if (val >= 2.0 && val < 5.0) cls = 'med';
            if (val >= 5.0) cls = 'high';
            return `<span class="crash-history-pill ${cls}">${val.toFixed(2)}x</span>`;
        }).join('');
    }
}

// ==========================================
// 8. CYBER PLINKO GAME ENGINE
// ==========================================
class PlinkoEngine {
    constructor() {
        this.canvas = document.getElementById('plinkoCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.rows = 8;
        this.pegs = [];
        this.balls = [];
        this.multipliers = [10.0, 3.0, 1.5, 0.5, 0.2, 0.5, 1.5, 3.0, 10.0];
        this.init();
    }

    init() {
        if (!this.canvas) return;
        this.buildPegs();
        this.renderSlots();
        this.setupControls();
        this.startLoop();
    }

    buildPegs() {
        this.pegs = [];
        const w = this.canvas.width;
        const h = this.canvas.height;
        const startY = 60;
        const rowHeight = (h - 140) / this.rows;

        for (let r = 0; r < this.rows; r++) {
            const count = r + 3;
            const rowWidth = count * 42;
            const startX = (w - rowWidth) / 2 + 21;
            for (let c = 0; c < count; c++) {
                this.pegs.push({
                    x: startX + c * 42,
                    y: startY + r * rowHeight,
                    radius: 4
                });
            }
        }
    }

    renderSlots() {
        const slotsRow = document.getElementById('plinkoSlotsRow');
        if (!slotsRow) return;
        slotsRow.innerHTML = this.multipliers.map((m, idx) => {
            let bg = 'rgba(255, 51, 102, 0.2)';
            let color = '#ff3366';
            if (m >= 1.5 && m < 5) {
                bg = 'rgba(13, 245, 157, 0.2)';
                color = '#0df59d';
            } else if (m >= 5) {
                bg = 'rgba(255, 184, 0, 0.2)';
                color = '#ffb800';
            }
            return `<div class="slot-box" id="slot-${idx}" style="background: ${bg}; color: ${color}; border: 1px solid ${color};">${m}x</div>`;
        }).join('');
    }

    setupControls() {
        const dropBtn = document.getElementById('plinkoDropBtn');
        const betInput = document.getElementById('plinkoBet');

        if (dropBtn) {
            dropBtn.addEventListener('click', () => {
                const bet = parseFloat(betInput.value) || 25;
                if (AppState.balance < bet) {
                    showToast('Insufficient balance for Plinko drop!', 'error');
                    return;
                }
                AppState.balance -= bet;
                updateBalanceDisplay();
                AudioPlayer.playClick();
                this.dropBall(bet);
            });
        }

        // Chip buttons
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                betInput.value = e.currentTarget.dataset.val;
            });
        });
    }

    dropBall(betAmount) {
        const w = this.canvas.width;
        this.balls.push({
            x: w / 2 + (Math.random() - 0.5) * 16,
            y: 20,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 2.0,
            radius: 7,
            bet: betAmount,
            color: '#00e5ff'
        });
    }

    startLoop() {
        const loop = () => {
            this.update();
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update() {
        const gravity = 0.22;
        const bounce = 0.55;
        const h = this.canvas.height;
        const w = this.canvas.width;

        this.balls.forEach((ball, idx) => {
            ball.vy += gravity;
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Peg collisions
            this.pegs.forEach(peg => {
                const dx = ball.x - peg.x;
                const dy = ball.y - peg.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < ball.radius + peg.radius) {
                    // Collision resolution
                    const angle = Math.atan2(dy, dx);
                    ball.vx = Math.cos(angle) * (2.8 + Math.random() * 0.5);
                    ball.vy = Math.sin(angle) * 2.5;
                    AudioPlayer.playPlinkoBounce();
                }
            });

            // Landed in bottom slots
            if (ball.y >= h - 45) {
                // Determine slot index
                const slotWidth = w / this.multipliers.length;
                let slotIdx = Math.floor(ball.x / slotWidth);
                slotIdx = Math.max(0, Math.min(this.multipliers.length - 1, slotIdx));
                const mult = this.multipliers[slotIdx];
                const win = ball.bet * mult;

                AppState.balance += win;
                updateBalanceDisplay();

                if (mult >= 1.5) AudioPlayer.playWin();
                showToast(`Plinko landed on ${mult}x! Payout: $${win.toFixed(2)}`, mult >= 1.5 ? 'success' : 'info');

                // Highlight slot
                const slotEl = document.getElementById(`slot-${slotIdx}`);
                if (slotEl) {
                    slotEl.classList.add('hit');
                    setTimeout(() => slotEl.classList.remove('hit'), 500);
                }

                // Remove ball
                this.balls.splice(idx, 1);
            }
        });
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw pegs
        this.pegs.forEach(peg => {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#0df59d';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw balls
        this.balls.forEach(ball => {
            ctx.fillStyle = ball.color;
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// ==========================================
// 9. LIVE WINNERS TICKER & MARQUEE
// ==========================================
const mockGlobalWins = [
    { user: 'cryptoking_7', game: 'Real Madrid vs Man City', win: '$4,850.00' },
    { user: 'vladimir_88', game: 'Apex Crash (14.20x)', win: '$7,100.00' },
    { user: 'sarah_bets', game: 'Arsenal vs Chelsea', win: '$1,240.00' },
    { user: 'neo_matrix', game: 'Cyber Plinko (10x)', win: '$2,500.00' },
    { user: 'marcus_aus', game: 'India vs Australia', win: '$3,180.00' },
    { user: 'satoshi_fan', game: 'Apex Crash (8.40x)', win: '$5,040.00' }
];

function initLiveTicker() {
    const track = document.getElementById('tickerTrack');
    if (!track) return;
    const doubled = [...mockGlobalWins, ...mockGlobalWins];
    track.innerHTML = doubled.map(w => `
        <div class="ticker-item">
            <span class="ticker-user">${w.user}</span> won 
            <span class="ticker-win">${w.win}</span> on 
            <span class="ticker-game">${w.game}</span>
        </div>
    `).join('');
}

// ==========================================
// 10. MODALS & TAB NAVIGATION
// ==========================================
function setupModalsAndTabs() {
    // Top tab switcher (Sportsbook, Live, Crash, Plinko)
    const tabs = document.querySelectorAll('.nav-tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.dataset.tab;
            switchTab(targetTab);
        });
    });

    // Sidebar items with tab triggers
    document.querySelectorAll('[data-tab-trigger]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.tabTrigger;
            switchTab(target);
        });
    });

    // Sub filters (All, Live, Upcoming)
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            AppState.currentSubFilter = e.currentTarget.dataset.filterType;
            renderMatches();
        });
    });

    // Sidebar sports filter
    document.querySelectorAll('.sidebar-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.sidebar-item-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            if (e.currentTarget.dataset.filter) {
                AppState.currentSportFilter = e.currentTarget.dataset.filter;
            } else if (e.currentTarget.dataset.sport) {
                AppState.currentSportFilter = e.currentTarget.dataset.sport;
            }
            switchTab('sports');
            renderMatches();
        });
    });

    // Search input
    const searchInput = document.getElementById('matchSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderMatches());
    }

    // Odds format selector
    const oddsFormatSelect = document.getElementById('oddsFormatSelect');
    if (oddsFormatSelect) {
        oddsFormatSelect.value = AppState.oddsFormat;
        oddsFormatSelect.addEventListener('change', (e) => {
            AppState.oddsFormat = e.target.value;
            localStorage.setItem('apex_odds_format', AppState.oddsFormat);
            renderMatches();
            renderBetslip();
        });
    }

    // Sound toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    const soundIcon = document.getElementById('soundIcon');
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            AppState.soundEnabled = !AppState.soundEnabled;
            localStorage.setItem('apex_sound', AppState.soundEnabled.toString());
            soundIcon.textContent = AppState.soundEnabled ? '🔊' : '🔇';
            soundBtn.querySelector('.sound-label').textContent = AppState.soundEnabled ? 'Audio ON' : 'Muted';
            AudioPlayer.playClick();
        });
    }

    // Deposit Modal
    const depositModal = document.getElementById('depositModal');
    const openDepositBtn = document.getElementById('openDepositModalBtn');
    const closeDepositBtn = document.getElementById('closeDepositModal');
    const claimInstantFaucetBtn = document.getElementById('claimInstantFaucetBtn');
    const simulateCryptoDepositBtn = document.getElementById('simulateCryptoDepositBtn');
    const simulateCardDepositBtn = document.getElementById('simulateCardDepositBtn');
    const applyCustomBalanceBtn = document.getElementById('applyCustomBalanceBtn');
    const claimBonusBtn = document.getElementById('claimBonusBtn');

    if (openDepositBtn && depositModal) {
        openDepositBtn.addEventListener('click', () => {
            depositModal.classList.add('open');
            AudioPlayer.playClick();
        });
    }
    if (closeDepositBtn && depositModal) {
        closeDepositBtn.addEventListener('click', () => depositModal.classList.remove('open'));
    }
    if (claimInstantFaucetBtn) {
        claimInstantFaucetBtn.addEventListener('click', () => {
            AppState.balance += 1000.00;
            updateBalanceDisplay();
            AudioPlayer.playWin();
            showToast('+$1,000.00 added to your wallet balance!', 'success');
            depositModal.classList.remove('open');
        });
    }
    if (simulateCryptoDepositBtn) {
        simulateCryptoDepositBtn.addEventListener('click', () => {
            AppState.balance += 500.00;
            updateBalanceDisplay();
            AudioPlayer.playWin();
            showToast('Simulated Crypto Deposit of $500.00 confirmed!', 'success');
            depositModal.classList.remove('open');
        });
    }
    if (simulateCardDepositBtn) {
        simulateCardDepositBtn.addEventListener('click', () => {
            const amt = parseFloat(document.getElementById('cardDepositAmount').value) || 250;
            AppState.balance += amt;
            updateBalanceDisplay();
            AudioPlayer.playWin();
            showToast(`Card transaction approved: +$${amt.toFixed(2)} credited!`, 'success');
            depositModal.classList.remove('open');
        });
    }
    if (applyCustomBalanceBtn) {
        applyCustomBalanceBtn.addEventListener('click', () => {
            const customAmt = parseFloat(document.getElementById('customExactBalanceInput').value) || 5000;
            AppState.balance = customAmt;
            updateBalanceDisplay();
            AudioPlayer.playClick();
            showToast(`Balance updated to $${customAmt.toFixed(2)}`, 'info');
            depositModal.classList.remove('open');
        });
    }
    if (claimBonusBtn) {
        claimBonusBtn.addEventListener('click', () => {
            AppState.balance += 100.00;
            updateBalanceDisplay();
            AudioPlayer.playWin();
            showToast('🎁 Daily $100 VIP Faucet Claimed!', 'success');
        });
    }

    // Deposit method tabs
    document.querySelectorAll('.method-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const method = e.currentTarget.dataset.method;
            document.getElementById('cryptoMethod').style.display = method === 'crypto' ? 'block' : 'none';
            document.getElementById('cardMethod').style.display = method === 'card' ? 'block' : 'none';
            document.getElementById('customMethod').style.display = method === 'custom' ? 'block' : 'none';
        });
    });

    // Copy Address Button
    const copyBtn = document.getElementById('copyAddressBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText('bc1qapex9974kxv8f37h8924ujs839kdqw0').then(() => {
                showToast('Address copied to clipboard!', 'info');
            });
        });
    }

    // My Bets Modal
    const myBetsBtn = document.getElementById('myBetsBtn');
    const myBetsModal = document.getElementById('myBetsModal');
    const closeMyBetsModal = document.getElementById('closeMyBetsModal');

    if (myBetsBtn && myBetsModal) {
        myBetsBtn.addEventListener('click', () => {
            renderMyBetsPortfolio();
            myBetsModal.classList.add('open');
            AudioPlayer.playClick();
        });
    }
    if (closeMyBetsModal && myBetsModal) {
        closeMyBetsModal.addEventListener('click', () => myBetsModal.classList.remove('open'));
    }

    // Portfolio tabs (Active vs Settled)
    document.querySelectorAll('.bet-tab-btn').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.bet-tab-btn').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const isSettled = e.currentTarget.dataset.tabBets === 'settled';
            document.getElementById('activeBetsListView').style.display = isSettled ? 'none' : 'flex';
            document.getElementById('settledBetsListView').style.display = isSettled ? 'flex' : 'none';
        });
    });

    // Betslip mode switcher (Single vs Parlay)
    const singleTab = document.getElementById('singleBetTab');
    const parlayTab = document.getElementById('parlayBetTab');
    if (singleTab && parlayTab) {
        singleTab.addEventListener('click', () => {
            currentSlipMode = 'single';
            singleTab.classList.add('active');
            parlayTab.classList.remove('active');
            AudioPlayer.playClick();
            renderBetslip();
        });
        parlayTab.addEventListener('click', () => {
            currentSlipMode = 'parlay';
            parlayTab.classList.add('active');
            singleTab.classList.remove('active');
            AudioPlayer.playClick();
            renderBetslip();
        });
    }

    // Stake presets
    document.querySelectorAll('.stake-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stakeInput = document.getElementById('globalStakeInput');
            const add = parseFloat(e.currentTarget.dataset.stake);
            stakeInput.value = (parseFloat(stakeInput.value) || 0) + add;
            AudioPlayer.playClick();
            renderBetslip();
        });
    });

    // Stake input changes
    const globalStakeInput = document.getElementById('globalStakeInput');
    if (globalStakeInput) {
        globalStakeInput.addEventListener('input', () => renderBetslip());
    }

    // Clear slip
    const clearSlipBtn = document.getElementById('clearSlipBtn');
    if (clearSlipBtn) {
        clearSlipBtn.addEventListener('click', () => {
            AppState.betslip = [];
            AudioPlayer.playClick();
            renderBetslip();
            renderMatches();
        });
    }

    // Place bet action
    const placeBetBtn = document.getElementById('placeBetBtn');
    if (placeBetBtn) {
        placeBetBtn.addEventListener('click', () => placeUserBet());
    }

    // Mobile Sidebar & Betslip toggles
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarPanel = document.getElementById('sidebarPanel');
    const mobileBetslipToggle = document.getElementById('mobileBetslipToggle');
    const betslipPanel = document.getElementById('betslipPanel');
    const closeMobileSlip = document.getElementById('closeMobileSlip');

    if (sidebarToggle && sidebarPanel) {
        sidebarToggle.addEventListener('click', () => sidebarPanel.classList.toggle('open'));
    }
    if (mobileBetslipToggle && betslipPanel) {
        mobileBetslipToggle.addEventListener('click', () => betslipPanel.classList.add('open'));
    }
    if (closeMobileSlip && betslipPanel) {
        closeMobileSlip.addEventListener('click', () => betslipPanel.classList.remove('open'));
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const sportsView = document.getElementById('sportsView');
    const crashView = document.getElementById('crashView');
    const plinkoView = document.getElementById('plinkoView');

    if (tabName === 'sports' || tabName === 'live') {
        if (sportsView) sportsView.classList.add('active');
        if (crashView) crashView.classList.remove('active');
        if (plinkoView) plinkoView.classList.remove('active');
        if (tabName === 'live') {
            AppState.currentSubFilter = 'live';
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.toggle('active', p.dataset.filterType === 'live'));
            renderMatches();
        }
    } else if (tabName === 'crash') {
        if (sportsView) sportsView.classList.remove('active');
        if (crashView) crashView.classList.add('active');
        if (plinkoView) plinkoView.classList.remove('active');
    } else if (tabName === 'plinko') {
        if (sportsView) sportsView.classList.remove('active');
        if (crashView) crashView.classList.remove('active');
        if (plinkoView) plinkoView.classList.add('active');
    }
}

function renderMyBetsPortfolio() {
    const activeContainer = document.getElementById('activeBetsListView');
    const settledContainer = document.getElementById('settledBetsListView');

    if (activeContainer) {
        if (AppState.activeBets.length === 0) {
            activeContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);">No active bets right now. Place a bet from the sportsbook!</div>`;
        } else {
            activeContainer.innerHTML = AppState.activeBets.map(b => `
                <div class="portfolio-bet-card">
                    <div class="portfolio-header">
                        <span class="portfolio-type">${b.mode.toUpperCase()} (${b.selections.length} Legs)</span>
                        <span class="portfolio-date">${b.date} • ID: ${b.id}</span>
                    </div>
                    <div>
                        ${b.selections.map(s => `
                            <div style="font-size: 12px; margin-bottom: 3px;">
                                <strong style="color: var(--accent-emerald);">${s.selection}</strong> 
                                <span style="color: var(--text-secondary);">@ ${formatOdds(s.odd)}</span> 
                                <span style="color: var(--text-muted); font-size: 11px;">(${s.matchName})</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="portfolio-details">
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted);">Stake: $${b.stake.toFixed(2)}</span>
                            <div style="font-size: 13px; font-weight: 800; color: #fff;">To Win: ${b.potentialPayout}</div>
                        </div>
                        <button class="portfolio-cashout-btn" onclick="cashoutActiveBet('${b.id}')">Cash Out $${b.cashoutValue}</button>
                    </div>
                </div>
            `).join('');
        }
    }

    if (settledContainer) {
        if (AppState.settledBets.length === 0) {
            settledContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);">No settled bets in history yet.</div>`;
        } else {
            settledContainer.innerHTML = AppState.settledBets.map(b => `
                <div class="portfolio-bet-card">
                    <div class="portfolio-header">
                        <span class="portfolio-type" style="background: ${b.status === 'WON' ? 'rgba(13, 245, 157, 0.15)' : 'rgba(255, 51, 102, 0.15)'}; color: ${b.status === 'WON' ? 'var(--accent-emerald)' : 'var(--accent-red)'};">${b.status}</span>
                        <span class="portfolio-date">${b.date} • Result: ${b.finalProfit}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        Stake: $${b.stake.toFixed(2)} • ${b.selections.map(s => s.selection).join(', ')}
                    </div>
                </div>
            `).join('');
        }
    }
}

// Make cashoutActiveBet globally accessible
window.cashoutActiveBet = cashoutActiveBet;

// ==========================================
// 11. INITIALIZATION ON DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    updateBalanceDisplay();
    updateActiveBetsBadge();
    initLiveTicker();
    renderMatches();
    renderBetslip();
    setupModalsAndTabs();
    startOddsFluctuations();
    startPitchSimulator();

    // Start Game Engines
    new CrashGameEngine();
    new PlinkoEngine();
});
