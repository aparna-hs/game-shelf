const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const axios = require('axios');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;
const BGG_API_TOKEN = process.env.BGG_API_TOKEN;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
const db = new Database('games.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bgg_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    year_published INTEGER,
    thumbnail TEXT,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS user_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('played', 'want_to_play')),
    play_date DATE,
    rating INTEGER CHECK(rating >= 1 AND rating <= 10),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );
`);

// BGG API rate limiting and caching
let lastBGGRequest = 0;
const BGG_MIN_INTERVAL = 2000; // 2 seconds between requests
const gameCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

function getCached(key) {
  const cached = gameCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  gameCache.delete(key); // Clean up expired cache
  return null;
}

function setCache(key, data) {
  gameCache.set(key, { data, timestamp: Date.now() });
}

async function rateLimitedBGGRequest(requestFn) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastBGGRequest;

  if (timeSinceLastRequest < BGG_MIN_INTERVAL) {
    await new Promise(resolve =>
      setTimeout(resolve, BGG_MIN_INTERVAL - timeSinceLastRequest)
    );
  }

  lastBGGRequest = Date.now();
  return requestFn();
}

async function bggRequestWithRetry(axiosConfig, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios(axiosConfig);

      if (response.status === 202) {
        // BGG is processing, wait and retry
        console.log(`BGG returned 202, retrying in 5 seconds (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      return response;
    } catch (error) {
      if (error.response?.status === 503 && attempt < maxRetries - 1) {
        // Rate limited, wait and retry
        console.log(`BGG rate limited (503), retrying in 10 seconds (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('BGG API timeout after retries');
}

// BGG API helpers
async function searchBGG(query) {
  // Check cache first
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`Cache hit for search: ${query}`);
    return cached;
  }

  // Rate limited request with retry logic
  return rateLimitedBGGRequest(async () => {
    try {
      const headers = {
        'User-Agent': 'GameShelf/1.0 (personal board game tracker)'
      };

      if (BGG_API_TOKEN) {
        headers['Authorization'] = `Bearer ${BGG_API_TOKEN}`;
      }

      const response = await bggRequestWithRetry({
        method: 'get',
        url: 'https://boardgamegeek.com/xmlapi2/search',
        params: { query, type: 'boardgame' },
        timeout: 15000,
        headers
      });

      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);

      if (!result.items || !result.items.item) {
        return [];
      }

      const data = result.items.item.map(item => ({
        bgg_id: parseInt(item.$.id),
        name: item.name[0].$.value,
        year_published: item.yearpublished ? parseInt(item.yearpublished[0].$.value) : null
      }));

      // Cache the result
      setCache(cacheKey, data);
      return data;
    } catch (error) {
      if (error.response?.status === 503) {
        throw new Error('BoardGameGeek is currently rate limiting requests. Please try again in a few minutes.');
      }
      console.error('BGG search error:', error.message);
      throw new Error('Failed to search BoardGameGeek. Please try again.');
    }
  });
}

async function getGameDetails(bggId) {
  // Check cache first
  const cacheKey = `game:${bggId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`Cache hit for game: ${bggId}`);
    return cached;
  }

  // Rate limited request with retry logic
  return rateLimitedBGGRequest(async () => {
    try {
      const headers = {
        'User-Agent': 'GameShelf/1.0 (personal board game tracker)'
      };

      if (BGG_API_TOKEN) {
        headers['Authorization'] = `Bearer ${BGG_API_TOKEN}`;
      }

      const response = await bggRequestWithRetry({
        method: 'get',
        url: 'https://boardgamegeek.com/xmlapi2/thing',
        params: { id: bggId, type: 'boardgame' },
        timeout: 15000,
        headers
      });

      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);

      if (!result.items || !result.items.item || !result.items.item[0]) {
        return null;
      }

      const item = result.items.item[0];
      const data = {
        bgg_id: parseInt(item.$.id),
        name: item.name.find(n => n.$.type === 'primary').$.value,
        year_published: item.yearpublished ? parseInt(item.yearpublished[0].$.value) : null,
        thumbnail: item.thumbnail ? item.thumbnail[0] : null,
        image: item.image ? item.image[0] : null
      };

      // Cache the result
      setCache(cacheKey, data);
      return data;
    } catch (error) {
      if (error.response?.status === 503) {
        throw new Error('BoardGameGeek is currently rate limiting requests. Please try again in a few minutes.');
      }
      console.error('BGG details error:', error.message);
      throw new Error('Failed to fetch game details from BoardGameGeek');
    }
  });
}

// Routes

// Search BGG for games
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  try {
    const results = await searchBGG(q);
    res.json(results);
  } catch (error) {
    console.error('Search endpoint error:', error);
    res.status(503).json({ error: 'Failed to search BoardGameGeek. Please try again.' });
  }
});

// Add game to collection
app.post('/api/games', async (req, res) => {
  const { bgg_id, status, play_date, rating, notes } = req.body;

  if (!bgg_id || !status) {
    return res.status(400).json({ error: 'bgg_id and status required' });
  }

  try {
    // Check if game exists in our database
    let game = db.prepare('SELECT * FROM games WHERE bgg_id = ?').get(bgg_id);

    // If not, fetch from BGG and save
    if (!game) {
      const gameDetails = await getGameDetails(bgg_id);
      if (!gameDetails) {
        return res.status(404).json({ error: 'Game not found on BGG' });
      }

      const insert = db.prepare(`
        INSERT INTO games (bgg_id, name, year_published, thumbnail, image)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = insert.run(
        gameDetails.bgg_id,
        gameDetails.name,
        gameDetails.year_published,
        gameDetails.thumbnail,
        gameDetails.image
      );

      game = { id: result.lastInsertRowid, ...gameDetails };
    }

    // Add to user's collection
    const insertUserGame = db.prepare(`
      INSERT INTO user_games (game_id, status, play_date, rating, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertUserGame.run(game.id, status, play_date || null, rating || null, notes || null);

    res.json({ id: result.lastInsertRowid, game, status, play_date, rating, notes });
  } catch (error) {
    console.error('Error adding game:', error);
    res.status(500).json({ error: 'Failed to add game' });
  }
});

// Get all games by status
app.get('/api/games/:status', (req, res) => {
  const { status } = req.params;

  if (!['played', 'want_to_play'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const games = db.prepare(`
    SELECT
      ug.id as user_game_id,
      ug.status,
      ug.play_date,
      ug.rating,
      ug.notes,
      ug.created_at,
      g.id as game_id,
      g.bgg_id,
      g.name,
      g.year_published,
      g.thumbnail,
      g.image
    FROM user_games ug
    JOIN games g ON ug.game_id = g.id
    WHERE ug.status = ?
    ORDER BY ug.created_at DESC
  `).all(status);

  res.json(games);
});

// Update game status or rating
app.patch('/api/games/:id', (req, res) => {
  const { id } = req.params;
  const { status, rating, notes, play_date } = req.body;

  const updates = [];
  const params = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
  }
  if (rating !== undefined) {
    updates.push('rating = ?');
    params.push(rating);
  }
  if (notes !== undefined) {
    updates.push('notes = ?');
    params.push(notes);
  }
  if (play_date !== undefined) {
    updates.push('play_date = ?');
    params.push(play_date);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(id);

  const stmt = db.prepare(`UPDATE user_games SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...params);

  res.json({ success: true });
});

// Delete game from collection
app.delete('/api/games/:id', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM user_games WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access from mobile: http://<your-computer-ip>:${PORT}`);
});
