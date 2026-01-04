# Game Shelf - Development Notes

**Last Updated:** 2026-01-04
**Purpose:** Comprehensive documentation for future Claude sessions and memory compaction recovery

---

## Project Overview

**Name:** Game Shelf
**Description:** Personal board game tracker with BoardGameGeek integration
**Type:** Full-stack web application
**Use Case:** Track games played and want-to-play lists
**Deployment:** Render (https://game-shelf-e2v0.onrender.com)

---

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js 18+ with Express
- **Database:** SQLite with better-sqlite3 (ephemeral on Render)
- **External API:** BoardGameGeek XML API2
- **Deployment:** Render (free tier, Docker-based)
- **Repository:** aparna-hs/game-shelf

---

## Development History & Issues Fixed

### Session 1: Initial Development (2026-01-04)

**Original Request:**
- User wanted simple board game tracker
- Integration with BoardGameGeek for game data
- Track "played" and "want to play" lists
- Mobile-accessible

**Built:**
1. Express server with SQLite database
2. BGG XML API2 integration
3. Responsive web interface
4. Two-list system (played/want-to-play)
5. Search, add, move, delete functionality

### Critical Issues Discovered & Fixed

#### Issue 1: Dockerfile Missing Build Dependencies (CRITICAL)
**Problem:** `better-sqlite3` requires native compilation (Python, Make, G++)
**Impact:** Deployment failed completely on Render
**Fix:** Added build dependencies to Dockerfile:
```dockerfile
RUN apk add --no-cache python3 make g++
RUN npm ci --omit=dev  # Also fixed deprecated --only=production flag
```
**File:** `/Dockerfile` lines 3-4, 12
**Status:** ✅ FIXED

#### Issue 2: Poor Error Handling in Server
**Problem:** BGG API errors returned empty arrays instead of proper errors
**Impact:** Users saw "No games found" instead of actual error messages
**Fix:**
- Added try/catch to search endpoint
- Proper error propagation in searchBGG and getGameDetails
- Added timeout (15s) and User-Agent headers
**Files:** `/server.js` lines 43-118
**Status:** ✅ FIXED

#### Issue 3: Poor Error Handling in Frontend
**Problem:** No HTTP status checking, assumed all responses were valid
**Impact:** JavaScript errors when server returned error objects
**Fix:**
- Check `response.ok` before parsing JSON
- Validate response is array before mapping
- Better error messages for users
**File:** `/public/app.js` lines 22-57
**Status:** ✅ FIXED

#### Issue 4: No Health Check Endpoint
**Problem:** Render couldn't verify service health
**Fix:** Added `/health` endpoint
**File:** `/server.js` lines 233-236
**Status:** ✅ FIXED

#### Issue 5: BGG API Requirements Not Met (CRITICAL)
**Problem:** Multiple BGG API best practices violated
**Impact:** Risk of rate limiting, blocking, or API failure

**Sub-issues:**
1. **Authorization Token Required** (as of fall 2025)
   - Status: ⚠️ PENDING - requires user registration
   - Impact: API may stop working without warning
   - Action needed: User must register at boardgamegeek.com/using_the_xml_api

2. **No Rate Limiting**
   - BGG recommends 5 seconds between requests
   - Status: 🔨 IMPLEMENTING
   - Fix: Rate limiter with 2-second minimum interval

3. **No Caching**
   - Every search hits BGG servers unnecessarily
   - Status: 🔨 IMPLEMENTING
   - Fix: In-memory cache with 1-hour TTL

4. **No Retry Logic for 202 Responses**
   - BGG returns 202 when request is queued
   - Status: 🔨 IMPLEMENTING
   - Fix: Retry with 5-second delay, max 3 attempts

5. **No 503 Rate Limit Handling**
   - Generic error when rate limited
   - Status: 🔨 IMPLEMENTING
   - Fix: Specific error message for 503 responses

---

## BGG API Integration Details

### API Information
- **Cost:** FREE for non-commercial use
- **Commercial Use:** Requires written approval from BGG
- **Rate Limit:** ~30 requests/minute (5 seconds between requests recommended)
- **Authorization:** Bearer token required (as of fall 2025)
- **Terms:** https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use

### Endpoints Used
1. `/xmlapi2/search` - Search for games by name
2. `/xmlapi2/thing` - Get detailed game information

### Response Codes
- `200` - Success
- `202` - Request queued, retry in 5 seconds
- `503` - Rate limited, wait and retry
- `500` - Server error

### Current Implementation Status
- ✅ Basic API calls working
- ✅ Timeout (15s)
- ✅ User-Agent header
- ✅ XML parsing
- ✅ Error handling
- 🔨 Rate limiting (implementing)
- 🔨 Caching (implementing)
- 🔨 Retry logic (implementing)
- ⚠️ Authorization token (user must register)

---

## Database Schema

### Tables

**games**
- `id` INTEGER PRIMARY KEY
- `bgg_id` INTEGER UNIQUE (BoardGameGeek game ID)
- `name` TEXT NOT NULL
- `year_published` INTEGER
- `thumbnail` TEXT (URL)
- `image` TEXT (URL)

**user_games**
- `id` INTEGER PRIMARY KEY
- `game_id` INTEGER → references games(id)
- `status` TEXT (played | want_to_play)
- `play_date` DATE
- `rating` INTEGER (1-10)
- `notes` TEXT
- `created_at` DATETIME

### Known Database Issues
⚠️ **Ephemeral Storage on Render**
- Free tier doesn't persist files between deploys/restarts
- Data is lost when:
  - App is redeployed
  - Service restarts
  - Container spins down (after 15 min inactivity)

**Solutions:**
1. Add Render Disk (paid)
2. Migrate to PostgreSQL (Render offers free tier)
3. Accept data loss for personal use

---

## Deployment Configuration

### Render Setup
- **Service:** Web Service
- **Repository:** aparna-hs/game-shelf
- **Branch:** claude/review-repo-contents-wxeyk
- **Deploy:** Automatic on push
- **Build:** Docker (uses Dockerfile)
- **Health Check:** /health endpoint

### Environment Variables Needed
```bash
PORT=3000  # Auto-set by Render
BGG_API_TOKEN=<get from BGG>  # User must register and add
```

### render.yaml Configuration
```yaml
services:
  - type: web
    name: game-shelf
    env: node
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
```

**Note:** Both Dockerfile and render.yaml exist. Render uses Dockerfile when env: docker, uses native Node when env: node.

---

## Known Limitations

1. **Data Persistence** - SQLite data lost on Render free tier restarts
2. **BGG API Token** - User must manually register and add token
3. **Cold Starts** - Free tier spins down after 15 min, first request takes 30-60s
4. **Single User** - No authentication, designed for personal use
5. **Mobile Access** - Requires deployment or local network setup

---

## Future Improvements

### High Priority
- [ ] User registers for BGG API token
- [ ] Add environment variable for BGG_API_TOKEN
- [ ] Consider PostgreSQL migration for data persistence
- [ ] Add loading spinners during cold starts

### Medium Priority
- [ ] Add game ratings UI
- [ ] Add play notes UI
- [ ] Filter/sort games lists
- [ ] Export data functionality
- [ ] PWA support for mobile home screen

### Low Priority
- [ ] User authentication (multi-user support)
- [ ] Dark mode
- [ ] Game recommendations
- [ ] BGG user collection import
- [ ] Statistics/analytics dashboard

---

## File Structure

```
/home/user/game-shelf/
├── .gitignore
├── Dockerfile              # Docker build config
├── render.yaml            # Render deployment config
├── package.json           # Node dependencies
├── package-lock.json      # Locked dependencies
├── server.js              # Express backend
├── games.db              # SQLite database (ephemeral)
├── README.md             # User-facing documentation
├── CLAUDE_NOTES.md       # This file
├── DEPLOY.md             # Deployment instructions
└── public/
    ├── index.html        # Main UI
    ├── style.css         # Styles
    └── app.js            # Frontend JavaScript
```

---

## Git Branch Strategy

**Main Branch:** (not specified)
**Development Branch:** claude/review-repo-contents-wxeyk
**Deployment:** From claude/review-repo-contents-wxeyk

**Important:** All pushes should go to branch starting with `claude/` and ending with session ID, otherwise 403 error occurs.

---

## Testing Checklist

When testing after changes:

- [ ] Search for a game (try "Catan")
- [ ] Add game to "Played" list
- [ ] Add game to "Want to Play" list
- [ ] Move game between lists
- [ ] Delete a game
- [ ] Check BGG link works
- [ ] Test on mobile device
- [ ] Verify data persists (until redeploy)
- [ ] Check Render logs for errors

---

## Common Commands

### Development
```bash
npm install           # Install dependencies
npm start            # Start server (production)
npm run dev          # Start with nodemon (development)
```

### Git
```bash
git status
git add -A
git commit -m "message"
git push -u origin claude/review-repo-contents-wxeyk
```

### Deployment
```bash
# Automatic on git push
# Or manual: Render Dashboard → Manual Deploy → Clear cache & deploy
```

---

## Troubleshooting Guide

### Search not working
1. Check Render logs for BGG API errors
2. Verify BGG API is responding (check boardgamegeek.com status)
3. Check if rate limited (503 errors)
4. Verify BGG_API_TOKEN is set (if implemented)

### Deployment fails
1. Check build logs in Render
2. Verify Dockerfile has build dependencies
3. Check package.json syntax
4. Verify node version compatibility (>=18.x)

### Data disappeared
- Expected on Render free tier
- Occurs on: redeploy, restart, or inactivity timeout
- Solution: Migrate to PostgreSQL or accept loss

### Mobile can't access
- If using local server: Ensure same WiFi network
- If using Render: Check deployment URL
- Verify no firewall blocking

---

## API Endpoints

### Frontend Routes
- `GET /` - Main application page

### API Routes
- `GET /api/search?q=<query>` - Search BGG for games
- `POST /api/games` - Add game to collection
- `GET /api/games/played` - Get played games
- `GET /api/games/want_to_play` - Get want-to-play games
- `PATCH /api/games/:id` - Update game status/rating
- `DELETE /api/games/:id` - Remove game from collection
- `GET /health` - Health check

---

## Important Context for Future Sessions

1. **User's Goal:** Simple personal board game tracker for mobile use
2. **Deployment Status:** Currently deployed to Render, may or may not be working
3. **BGG API Status:** May require token registration by user
4. **Data Persistence:** Known issue on Render free tier
5. **Code Quality:** Functional but could use improvements (caching, rate limiting)

---

## Questions to Ask User in Future Sessions

- Is the app still working on Render?
- Have you registered for a BGG API token?
- Do you want to migrate to PostgreSQL for data persistence?
- Any new features needed?
- How is the mobile experience?

---

## External Resources

- [BGG XML API2 Docs](https://boardgamegeek.com/wiki/page/BGG_XML_API2)
- [BGG API Registration](https://boardgamegeek.com/using_the_xml_api)
- [BGG API Terms](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use)
- [Render Docs](https://render.com/docs)
- [better-sqlite3 Docs](https://github.com/WiseLibs/better-sqlite3)

---

*This document should be updated whenever significant changes are made to the project.*
