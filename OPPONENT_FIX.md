# Opponent Field Fix

## Problem
The opponent field was always showing "TBD" because the FPL API's `/bootstrap-static/` endpoint doesn't include opponent information in the player data.

## Root Cause
Players only have a `team` field (their club ID), but no direct opponent information. Opponent data must be derived from the `/fixtures/` endpoint by:
1. Finding upcoming fixtures
2. Matching player's team with fixtures
3. Determining the opponent team

## Solution Implemented

### Backend Changes

#### 1. Added `fetchFixtures()` function
- Fetches fixture data from FPL API
- Returns all fixtures including upcoming matches

#### 2. Added `enrichPlayersWithOpponents()` function
- Takes players, fixtures, teams, and current event ID
- Finds next fixture for each team
- Adds opponent information to each player:
  - `opponent`: Opponent team ID
  - `opponent_short`: Opponent team short name (e.g., "ARS", "MUN")
  - `is_home`: Boolean indicating if playing at home
  - `next_event`: Gameweek number of next fixture
  - Falls back to 'TBD' if no upcoming fixture

#### 3. Updated Controllers
- **`getPredictedTeam()`**: Now fetches fixtures and enriches players before building team
- **`getUserTeam()`**: Now fetches fixtures and enriches players before building user's team

### Frontend Changes

#### Updated Hooks
- **`useTeamData.js`**: Formats players with `opponent: player.opponent_short || 'TBD'`
- **`usePredictedTeam.js`**: Formats players with `opponent: player.opponent_short || 'TBD'`

### PlayerCard Display
The PlayerCard component already had the opponent display implemented:
```javascript
const opponent = player.opponent || 'TBD';
```
Now it will show the actual opponent short name (e.g., "ARS", "CHE", "MUN") instead of always showing "TBD".

## How It Works

1. When building a team (highest predicted or user team):
   - Backend fetches bootstrap-static data (players, teams, events)
   - Backend fetches fixtures data
   - Backend enriches players with opponent info
   - Returns enriched player data to frontend

2. Frontend displays opponent in PlayerCard:
   - Shows opponent short name (e.g., "ARS")
   - Falls back to "TBD" if no fixture available

## Example Data Flow

```javascript
// Before enrichment
player = {
  web_name: "Salah",
  team: 12, // Liverpool
  // No opponent field
}

// After enrichment  
player = {
  web_name: "Salah",
  team: 12, // Liverpool
  opponent: 4, // Aston Villa team ID
  opponent_short: "AVL",
  is_home: true,
  next_event: 22
}

// In frontend
formattedPlayer = {
  webName: "Salah",
  opponent: "AVL" // Displayed in PlayerCard
}
```

## Benefits

1. **Accurate Information**: Shows real upcoming opponents
2. **Fixture Awareness**: Players see who each player faces next
3. **Better Decisions**: Helps in transfer and substitution decisions
4. **Home/Away Context**: Could be extended to show (H) or (A) indicators

## Future Enhancements

- Show home/away indicator: "AVL (H)" or "AVL (A)"
- Show fixture difficulty rating
- Show multiple upcoming fixtures
- Color-code by difficulty (green=easy, red=hard)
