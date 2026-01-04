const API_URL = 'http://localhost:3000/api';

// Load games on page load
document.addEventListener('DOMContentLoaded', () => {
    loadGames();
});

// Search games on Enter key
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchGames();
    }
});

async function searchGames() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<p>Searching...</p>';

    try {
        const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
        const games = await response.json();

        if (games.length === 0) {
            resultsDiv.innerHTML = '<p class="empty-state">No games found</p>';
            return;
        }

        resultsDiv.innerHTML = games.map(game => `
            <div class="search-result">
                <div class="game-info">
                    <h3>${game.name}</h3>
                    <p>${game.year_published ? `(${game.year_published})` : ''}</p>
                </div>
                <div class="action-buttons">
                    <button class="btn-played" onclick="addGame(${game.bgg_id}, 'played')">
                        Mark as Played
                    </button>
                    <button class="btn-want" onclick="addGame(${game.bgg_id}, 'want_to_play')">
                        Want to Play
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Search error:', error);
        resultsDiv.innerHTML = '<p class="empty-state">Error searching games</p>';
    }
}

async function addGame(bggId, status) {
    try {
        const response = await fetch(`${API_URL}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bgg_id: bggId,
                status: status,
                play_date: status === 'played' ? new Date().toISOString().split('T')[0] : null
            })
        });

        if (response.ok) {
            document.getElementById('searchInput').value = '';
            document.getElementById('searchResults').innerHTML = '';
            loadGames();
        } else {
            alert('Failed to add game');
        }
    } catch (error) {
        console.error('Add game error:', error);
        alert('Error adding game');
    }
}

async function loadGames() {
    await loadGamesByStatus('played', 'playedGames');
    await loadGamesByStatus('want_to_play', 'wantToPlayGames');
}

async function loadGamesByStatus(status, containerId) {
    try {
        const response = await fetch(`${API_URL}/games/${status}`);
        const games = await response.json();

        const container = document.getElementById(containerId);

        if (games.length === 0) {
            container.innerHTML = '<p class="empty-state">No games yet</p>';
            return;
        }

        container.innerHTML = games.map(game => `
            <div class="game-card">
                ${game.thumbnail ? `<img src="${game.thumbnail}" alt="${game.name}">` : ''}
                <h3>${game.name}</h3>
                <p class="year">${game.year_published ? `(${game.year_published})` : ''}</p>
                ${game.rating ? `<p class="rating">${'⭐'.repeat(game.rating)}</p>` : ''}
                ${game.play_date ? `<p class="play-date">Played: ${formatDate(game.play_date)}</p>` : ''}
                ${game.notes ? `<p class="notes">"${game.notes}"</p>` : ''}
                <div class="links">
                    <a href="https://boardgamegeek.com/boardgame/${game.bgg_id}" target="_blank">
                        View on BGG →
                    </a>
                </div>
                <div class="card-actions">
                    <button class="btn-move" onclick="moveGame(${game.user_game_id}, '${status === 'played' ? 'want_to_play' : 'played'}')">
                        ${status === 'played' ? 'Move to Want to Play' : 'Mark as Played'}
                    </button>
                    <button class="btn-delete" onclick="deleteGame(${game.user_game_id})">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load games error:', error);
        document.getElementById(containerId).innerHTML = '<p class="empty-state">Error loading games</p>';
    }
}

async function moveGame(userGameId, newStatus) {
    try {
        const updates = { status: newStatus };
        if (newStatus === 'played') {
            updates.play_date = new Date().toISOString().split('T')[0];
        }

        const response = await fetch(`${API_URL}/games/${userGameId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (response.ok) {
            loadGames();
        } else {
            alert('Failed to move game');
        }
    } catch (error) {
        console.error('Move game error:', error);
        alert('Error moving game');
    }
}

async function deleteGame(userGameId) {
    if (!confirm('Are you sure you want to delete this game?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/games/${userGameId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadGames();
        } else {
            alert('Failed to delete game');
        }
    } catch (error) {
        console.error('Delete game error:', error);
        alert('Error deleting game');
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
