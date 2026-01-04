# Game Shelf

A simple board game tracker to keep track of games you've played and want to play, with BoardGameGeek integration.

## Features

- Search for games using BoardGameGeek's database
- Track games you've played
- Maintain a "want to play" list
- View game details and link to BGG for more info
- Simple, clean interface

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser to: `http://localhost:3000`

## Usage

1. **Search for games**: Type a game name in the search box and click "Search"
2. **Add games**: Click "Mark as Played" or "Want to Play" to add games to your collection
3. **Manage games**: Move games between lists or delete them from your collection
4. **View details**: Click "View on BGG" to see full game details on BoardGameGeek

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML, CSS, JavaScript
- **API**: BoardGameGeek XML API2

## Database

The app uses SQLite with two tables:
- `games`: Stores game information from BGG
- `user_games`: Tracks your game collection (played/want to play status)

## Development

For development with auto-reload:
```bash
npm run dev
```
