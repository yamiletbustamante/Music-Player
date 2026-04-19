// ================================================
// MUSIC PLAYER — iTunes Search API (sin CORS)
// ================================================

const state = {
    results: [],
    currentIndex: -1,
    audio: null,
    isPlaying: false,
    volume: 0.8
};

// Referencias al DOM
const ui = {
    trackTitle: document.getElementById('trackTitle'),
    trackArtist: document.getElementById('trackArtist'),
    albumArt: document.getElementById('albumArt'),
    albumImg: document.getElementById('albumImg'),
    albumPlaceholder: document.getElementById('albumPlaceholder'),
    statusDot: document.getElementById('statusDot'),
    playBtn: document.getElementById('playBtn'),
    playIcon: document.getElementById('playIcon'),
    pauseIcon: document.getElementById('pauseIcon'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    menuBtn: document.getElementById('menuBtn'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    currentTime: document.getElementById('currentTime'),
    totalTime: document.getElementById('totalTime'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    resultsPanel: document.getElementById('resultsPanel'),
    resultsContent: document.getElementById('resultsContent'),
    resultsCount: document.getElementById('resultsCount'),
    closeResults: document.getElementById('closeResults'),
    volumeBar: document.getElementById('volumeBar'),
    volumeFill: document.getElementById('volumeFill'),
    volLabel: document.getElementById('volLabel'),
    toast: document.getElementById('toast'),
};

// ── BÚSQUEDA ──────────────────────────────────────
async function search(query) {
    query = query.trim();
    if (!query) { showToast('Escribe algo primero'); return; }

    ui.resultsContent.innerHTML = `
        <div class="state-msg">
            <div class="spinner"></div>
            <span>Buscando...</span>
        </div>`;
    ui.resultsPanel.style.display = 'block';
    ui.resultsCount.textContent = '';

    try {
        // iTunes Search API — pública, sin key, CORS habilitado
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Solo canciones con preview disponible
        state.results = (data.results || []).filter(t => t.previewUrl);

        if (state.results.length === 0) {
            ui.resultsContent.innerHTML = `
                <div class="state-msg">
                    <span>Sin resultados con preview.</span>
                    <span style="font-size:11px;opacity:.6">Prueba otro artista o título.</span>
                </div>`;
            ui.resultsCount.textContent = '0 resultados';
            return;
        }

        ui.resultsCount.textContent = `${state.results.length} resultados`;
        renderResults();

    } catch (err) {
        ui.resultsContent.innerHTML = `
            <div class="state-msg">
                <span>Error: ${err.message}</span>
            </div>`;
        console.error(err);
    }
}

// ── RENDER LISTA ──────────────────────────────────
function renderResults() {
    ui.resultsContent.innerHTML = state.results.map((track, i) => {
        const dur = fmt(track.trackTimeMillis / 1000);
        const art = track.artworkUrl60 || '';
        const active = i === state.currentIndex ? 'active' : '';

        return `
            <div class="result-item ${active}" onclick="selectTrack(${i})">
                <div class="result-thumb">
                    ${art
                ? `<img src="${art}" alt="${escHtml(track.trackName)}" loading="lazy">`
                : noteIcon()
            }
                </div>
                <div class="result-info">
                    <div class="result-name">${escHtml(track.trackName)}</div>
                    <div class="result-meta">${escHtml(track.artistName)}</div>
                </div>
                <div class="result-dur">${dur}</div>
            </div>`;
    }).join('');
}

function noteIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" width="20" height="20">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>`;
}

// ── SELECCIONAR CANCIÓN ───────────────────────────
function selectTrack(index) {
    state.currentIndex = index;
    const track = state.results[index];

    // Actualizar info en pantalla
    ui.trackTitle.textContent = track.trackName;
    ui.trackArtist.textContent = track.artistName;

    // Portada (pedir 300x300 en vez de 100x100)
    const art = (track.artworkUrl100 || track.artworkUrl60 || '')
        .replace('100x100bb', '300x300bb')
        .replace('100x100', '300x300');

    if (art) {
        ui.albumImg.src = art;
        ui.albumImg.style.display = 'block';
        ui.albumPlaceholder.style.display = 'none';
        ui.albumArt.classList.add('lit');
    } else {
        ui.albumImg.style.display = 'none';
        ui.albumPlaceholder.style.display = 'flex';
        ui.albumArt.classList.remove('lit');
    }

    // Detener audio anterior
    if (state.audio) {
        state.audio.pause();
        state.audio.removeEventListener('timeupdate', onTimeUpdate);
        state.audio.removeEventListener('ended', onEnded);
    }

    // Nuevo audio
    state.audio = new Audio(track.previewUrl);
    state.audio.volume = state.volume;
    state.audio.addEventListener('timeupdate', onTimeUpdate);
    state.audio.addEventListener('ended', onEnded);

    playAudio();

    // Cerrar panel y refrescar highlights
    ui.resultsPanel.style.display = 'none';
    renderResults();
}

// ── REPRODUCCIÓN ──────────────────────────────────
function playAudio() {
    if (!state.audio) return;
    state.audio.play()
        .then(() => {
            state.isPlaying = true;
            ui.playIcon.style.display = 'none';
            ui.pauseIcon.style.display = 'block';
            ui.statusDot.classList.add('playing');
        })
        .catch(err => {
            showToast('No se pudo reproducir');
            console.error(err);
        });
}

function pauseAudio() {
    if (!state.audio) return;
    state.audio.pause();
    state.isPlaying = false;
    ui.playIcon.style.display = 'block';
    ui.pauseIcon.style.display = 'none';
    ui.statusDot.classList.remove('playing');
}

function togglePlay() {
    if (!state.audio) { showToast('Selecciona una canción'); return; }
    state.isPlaying ? pauseAudio() : playAudio();
}

function nextTrack() {
    if (!state.results.length) return;
    selectTrack((state.currentIndex + 1) % state.results.length);
}

function prevTrack() {
    if (!state.results.length) return;
    // Si llevamos más de 3s → rebobinar; si no → canción anterior
    if (state.audio && state.audio.currentTime > 3) {
        state.audio.currentTime = 0;
    } else {
        const prev = (state.currentIndex - 1 + state.results.length) % state.results.length;
        selectTrack(prev);
    }
}

// ── PROGRESO ──────────────────────────────────────
function onTimeUpdate() {
    if (!state.audio) return;
    const cur = state.audio.currentTime;
    const dur = state.audio.duration || 30;
    ui.progressFill.style.width = (cur / dur * 100) + '%';
    ui.currentTime.textContent = fmt(cur);
    ui.totalTime.textContent = fmt(dur);
}

function onEnded() { nextTrack(); }

function seek(e) {
    if (!state.audio) return;
    const rect = ui.progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.audio.currentTime = pct * (state.audio.duration || 30);
}

// ── VOLUMEN ───────────────────────────────────────
function setVolume(e) {
    const rect = ui.volumeBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.volume = pct;
    if (state.audio) state.audio.volume = pct;
    ui.volumeFill.style.width = (pct * 100) + '%';
    ui.volLabel.textContent = Math.round(pct * 100);
}

// ── MENÚ ──────────────────────────────────────────
function toggleMenu() {
    if (!state.results.length) { ui.searchInput.focus(); return; }
    const visible = ui.resultsPanel.style.display !== 'none';
    if (visible) {
        ui.resultsPanel.style.display = 'none';
    } else {
        renderResults();
        ui.resultsPanel.style.display = 'block';
    }
}

// ── TOAST ─────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2600);
}

// ── UTILIDADES ────────────────────────────────────
function fmt(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── EVENTOS ───────────────────────────────────────
ui.searchBtn.addEventListener('click', () => search(ui.searchInput.value));
ui.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') search(ui.searchInput.value);
});

ui.playBtn.addEventListener('click', togglePlay);
ui.nextBtn.addEventListener('click', nextTrack);
ui.prevBtn.addEventListener('click', prevTrack);
ui.menuBtn.addEventListener('click', toggleMenu);
ui.closeResults.addEventListener('click', () => ui.resultsPanel.style.display = 'none');

ui.progressBar.addEventListener('click', seek);
ui.volumeBar.addEventListener('click', setVolume);

// Teclado
document.addEventListener('keydown', e => {
    if (e.target === ui.searchInput) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight') nextTrack();
    if (e.key === 'ArrowLeft') prevTrack();
});

// Exponer para los onclick del HTML
window.selectTrack = selectTrack;

console.log('🎵 Music Player listo. API: iTunes Search');