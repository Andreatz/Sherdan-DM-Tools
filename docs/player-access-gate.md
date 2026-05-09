# Player access gate

This document defines the first access gate for player-facing API routes.

## Goal

Player-facing APIs must not be reachable by accident. Even though the API output is already player-safe, routes under `/api/player/*` are now closed unless a local access code is configured and the browser has a valid signed cookie.

## Environment variable

Set this only on the server/local machine running the app:

```txt
SHERDAN_PLAYER_ACCESS_CODE=<choose-a-private-code>
```

If this value is missing, player APIs stay closed and return a configuration error instead of opening publicly.

## Current endpoints

```txt
POST /api/player/access/login
POST /api/player/access/logout
GET  /api/player/access/status
```

`POST /api/player/access/login` accepts:

```json
{ "code": "..." }
```

On success it sets a signed `httpOnly` cookie:

```txt
sherdan_player_access
```

The cookie is valid for seven days and uses `sameSite=lax`. In production it is marked `secure`.

## Protected routes

The following routes require the signed cookie:

```txt
GET /api/player/entities?campaign_id=<uuid>
GET /api/player/entities/[id]?campaign_id=<uuid>
```

Without a valid cookie they return `401 unauthorized`.

If `SHERDAN_PLAYER_ACCESS_CODE` is not configured, they return `503 service_unavailable`.

## Security boundaries

This is a simple local-first access gate, not full user management.

It protects against accidental exposure and casual access, but it does not yet provide:

- per-player identity;
- per-player permissions;
- role-based access control;
- audit logs;
- invite links;
- revocation per user.

## Next upgrade

Before a real public Player Dashboard, consider one of these upgrades:

1. campaign-level password screen plus session cookie UI;
2. tokenized read-only invite links;
3. full auth with `dm` / `player` roles.

The recommended next step is a simple Player Dashboard login page that calls `/api/player/access/login` and then fetches player-safe data only from `/api/player/*` routes.
