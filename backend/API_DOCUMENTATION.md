# Squad, Transfer, and Chip Management API Documentation

This document describes the new API endpoints for managing user squads, transfers, and chips in the FPL Predictor application.

## Overview

These endpoints enable:
- **Squad Management**: Track user's current squad with purchase/selling prices
- **Transfer System**: Make transfers with proper validation and points deduction
- **Chip System**: Manage FPL chips (Wildcard, Free Hit, Bench Boost, Triple Captain)
- **Historical Tracking**: Store squad snapshots for each gameweek

## Base URL

All endpoints are prefixed with: `http://localhost:5000/api/`

## Authentication

All endpoints require authentication via JWT token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

---

## Squad Endpoints

### Initialize Squad

**POST** `/api/squad/initialize`

Initialize a user's squad from their FPL team data. This should be called once when a user first connects their FPL account.

**Request Body:**
```json
{
  "userId": "mongodb_user_id",
  "entryId": 123456,
  "gameweek": 1
}
```

**Response:**
```json
{
  "message": "Squad initialized successfully",
  "squad": {
    "_id": "squad_id",
    "userId": "user_id",
    "gameweek": 1,
    "players": [...],
    "bank": 5,
    "squadValue": 1000,
    "freeTransfers": 1,
    "transfersMadeThisWeek": 0,
    "pointsDeducted": 0,
    "activeChip": null
  },
  "chips": {...}
}
```

---

### Get Current Squad

**GET** `/api/squad/:userId`

Get user's current squad with calculated selling prices.

**Response:**
```json
{
  "_id": "squad_id",
  "userId": "user_id",
  "gameweek": 5,
  "players": [
    {
      "playerId": 1,
      "position": 1,
      "purchasePrice": 75,
      "currentPrice": 78,
      "sellingPrice": 76,
      "profit": 3,
      "isCaptain": false,
      "isViceCaptain": false,
      "multiplier": 1
    }
  ],
  "bank": 5,
  "squadValue": 1005,
  "totalSellingValue": 996,
  "totalCurrentValue": 1003,
  "freeTransfers": 1,
  "transfersMadeThisWeek": 0,
  "transferCost": 0,
  "pointsDeducted": 0,
  "activeChip": null
}
```

**Player Price Calculation:**
- `purchasePrice`: Price when player was bought (£0.1m units)
- `currentPrice`: Current market price
- `sellingPrice`: Price when selling = `purchasePrice + floor((currentPrice - purchasePrice) / 2)`
- `profit`: `currentPrice - purchasePrice`

---

### Get Squad History

**GET** `/api/squad/history/:userId/:gameweek`

Get squad snapshot for a specific gameweek.

**Response:**
```json
{
  "_id": "history_id",
  "userId": "user_id",
  "gameweek": 3,
  "players": [...],
  "bank": 5,
  "squadValue": 1000,
  "freeTransfers": 1,
  "transfersMadeThisWeek": 2,
  "pointsDeducted": 4,
  "activeChip": "wildcard",
  "pointsScored": 65,
  "overallRank": 123456
}
```

---

### Get All Squad History

**GET** `/api/squad/history/:userId`

Get all squad snapshots for a user, sorted by gameweek.

**Response:**
```json
[
  {
    "gameweek": 1,
    "players": [...],
    "pointsScored": 58,
    ...
  },
  {
    "gameweek": 2,
    "players": [...],
    "pointsScored": 62,
    ...
  }
]
```

---

### Update for New Gameweek

**POST** `/api/squad/update-gameweek`

Called at the start of each new gameweek to:
- Reset transfer counters
- Update free transfers (carry over if unused, max 2)
- Revert Free Hit changes
- Clear active chip

**Request Body:**
```json
{
  "userId": "user_id",
  "newGameweek": 6
}
```

**Response:**
```json
{
  "message": "Squad updated for new gameweek",
  "squad": {...}
}
```

---

## Transfer Endpoints

### Make Transfer

**POST** `/api/transfers`

Make a player transfer with automatic validation and cost calculation.

**Request Body:**
```json
{
  "userId": "user_id",
  "playerOutId": 123,
  "playerInId": 456,
  "gameweek": 5
}
```

**Validation:**
- Players must be same position type
- Sufficient funds available
- Transfer cost calculated based on free transfers and active chips

**Response:**
```json
{
  "message": "Transfer completed successfully",
  "transfer": {
    "_id": "transfer_id",
    "userId": "user_id",
    "gameweek": 5,
    "playerIn": {
      "playerId": 456,
      "price": 95
    },
    "playerOut": {
      "playerId": 123,
      "purchasePrice": 90,
      "sellingPrice": 92
    },
    "isFree": true,
    "pointsCost": 0,
    "chipActive": null
  },
  "squad": {
    "players": [...],
    "bank": 3,
    "squadValue": 1003,
    "transfersMadeThisWeek": 1,
    "freeTransfers": 1,
    "pointsDeducted": 0
  },
  "playerIn": {
    "id": 456,
    "name": "Mohamed Salah",
    "cost": 95
  },
  "playerOut": {
    "id": 123,
    "name": "Bruno Fernandes",
    "sellingPrice": 92
  }
}
```

**Transfer Cost Logic:**
- Free if `transfersMadeThisWeek < freeTransfers`
- Free if Wildcard or Free Hit active
- Otherwise: 4 points per transfer

---

### Get Transfer History

**GET** `/api/transfers/history/:userId?gameweek=5&limit=10`

Get user's transfer history with optional filters.

**Query Parameters:**
- `gameweek` (optional): Filter by specific gameweek
- `limit` (optional): Limit number of results

**Response:**
```json
[
  {
    "_id": "transfer_id",
    "userId": "user_id",
    "gameweek": 5,
    "playerIn": {
      "playerId": 456,
      "price": 95,
      "name": "Mohamed Salah",
      "webName": "Salah"
    },
    "playerOut": {
      "playerId": 123,
      "purchasePrice": 90,
      "sellingPrice": 92,
      "name": "Bruno Fernandes",
      "webName": "Bruno F."
    },
    "isFree": false,
    "pointsCost": 4,
    "chipActive": null,
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

---

### Get Transfer Summary

**GET** `/api/transfers/summary/:userId/:gameweek`

Get transfer summary for a specific gameweek.

**Response:**
```json
{
  "gameweek": 5,
  "totalTransfers": 3,
  "freeTransfers": 1,
  "paidTransfers": 2,
  "totalPointsCost": 8,
  "transfers": [...]
}
```

---

## Chip Endpoints

### Get Available Chips

**GET** `/api/chips/:userId?gameweek=5`

Get chips available for a specific gameweek.

**Query Parameters:**
- `gameweek` (required): Gameweek to check availability

**Response:**
```json
{
  "userId": "user_id",
  "gameweek": 5,
  "availableChips": [
    {
      "id": "bench_boost_1",
      "type": "bench_boost",
      "number": "1",
      "description": "Bench Boost",
      "effect": "Points scored by your bench players are included in your total"
    },
    {
      "id": "triple_captain_1",
      "type": "triple_captain",
      "number": "1",
      "description": "Triple Captain",
      "effect": "Your captain points are tripled instead of doubled"
    },
    {
      "id": "wildcard_1",
      "type": "wildcard",
      "number": "1",
      "description": "Wildcard",
      "effect": "All transfers in the Gameweek are free of charge"
    },
    {
      "id": "free_hit_1",
      "type": "free_hit",
      "number": "1",
      "description": "Free Hit",
      "effect": "Make unlimited free transfers for a single Gameweek. Squad returns to previous state next gameweek"
    }
  ],
  "allChips": {
    "benchBoost1": {
      "available": true,
      "usedInGameweek": null,
      "availableFrom": 1,
      "availableUntil": 19
    },
    ...
  }
}
```

**Chip Availability Windows:**
- **Bench Boost 1**: GW1-19
- **Bench Boost 2**: GW20-38
- **Triple Captain 1**: GW1-19
- **Triple Captain 2**: GW20-38
- **Free Hit 1**: GW2-19 (cannot use in consecutive gameweeks)
- **Free Hit 2**: GW20-38 (cannot use in consecutive gameweeks)
- **Wildcard 1**: GW2-19
- **Wildcard 2**: GW20-38

---

### Activate Chip

**POST** `/api/chips/activate`

Activate a chip for the current gameweek.

**Request Body:**
```json
{
  "userId": "user_id",
  "chipName": "wildcard_1",
  "gameweek": 5
}
```

**Validation:**
- Chip must be available
- No other chip active this gameweek
- Gameweek must be within chip's availability window
- Free Hit cannot be used in consecutive gameweeks

**Response:**
```json
{
  "message": "Chip wildcard activated successfully",
  "chip": "wildcard_1",
  "activeChip": "wildcard",
  "squad": {
    "gameweek": 5,
    "activeChip": "wildcard",
    "transfersMadeThisWeek": 0,
    "pointsDeducted": 0
  }
}
```

**Effects:**
- **Wildcard**: Resets transfer counters, all transfers free this GW
- **Free Hit**: Saves current squad, all transfers free this GW, reverts next GW
- **Triple Captain**: Sets captain multiplier to 3
- **Bench Boost**: No automatic effect (handled during points calculation)

---

### Cancel Chip

**POST** `/api/chips/cancel`

Cancel an active chip before the gameweek deadline.

**Request Body:**
```json
{
  "userId": "user_id"
}
```

**Restrictions:**
- **Cannot cancel**: Wildcard, Free Hit (once confirmed)
- **Can cancel**: Bench Boost, Triple Captain (before deadline)

**Response:**
```json
{
  "message": "Chip triple_captain cancelled successfully",
  "squad": {
    "gameweek": 5,
    "activeChip": null
  }
}
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `404` - Not found (squad/user not found)
- `500` - Server error

---

## Usage Examples

### Example 1: Initialize and Make First Transfer

```javascript
// 1. Initialize squad
const initResponse = await fetch('/api/squad/initialize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user123',
    entryId: 123456,
    gameweek: 1
  })
});

// 2. Make a transfer
const transferResponse = await fetch('/api/transfers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user123',
    playerOutId: 123,
    playerInId: 456,
    gameweek: 1
  })
});
```

### Example 2: Use Wildcard Chip

```javascript
// 1. Activate wildcard
await fetch('/api/chips/activate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user123',
    chipName: 'wildcard_1',
    gameweek: 5
  })
});

// 2. Make multiple free transfers
await fetch('/api/transfers', {
  method: 'POST',
  body: JSON.stringify({ userId, playerOutId: 1, playerInId: 10, gameweek: 5 })
});
await fetch('/api/transfers', {
  method: 'POST',
  body: JSON.stringify({ userId, playerOutId: 2, playerInId: 20, gameweek: 5 })
});
// All transfers are free due to wildcard
```

---

## Data Flow

```
User Action → API Endpoint → Controller
                                 ↓
                          Validate Request
                                 ↓
                          Update Database
                                 ↓
                        Update Squad State
                                 ↓
                       Create History Record
                                 ↓
                          Return Response
```

---

## Database Collections

### squads
Stores current squad state for each user.

### squadhistories
Stores historical snapshots of squads for each gameweek.

### transfers
Records all player transfers made.

### chips
Tracks chip availability and usage for each user.

---

## Notes

1. **Prices**: All prices are stored in £0.1m units (e.g., 75 = £7.5m)
2. **Selling Price**: Always rounds down to nearest £0.1m
3. **Free Transfers**: Max 2 can be banked
4. **Transfer Cost**: 4 points per extra transfer
5. **Chips**: One-time use per gameweek, specific availability windows
6. **Free Hit**: Squad automatically reverts next gameweek
7. **Saved Transfers**: Retained when using Wildcard or Free Hit
