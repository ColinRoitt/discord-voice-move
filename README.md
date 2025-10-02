# Discord Voice Mover (Bundled Client + Server)

This project bundles the **Discord bot + API (Express)** and a **React client (Vite)** in one folder.
It supports production via a single container and an optional dev mode with hot reload via Docker Compose profiles.

## Prereqs
- A Discord bot with `Move Members` permission and **SERVER MEMBERS INTENT** enabled.
- Two voice channels: `general` and `other_team` (use their IDs).
- Copy `.env.example` to `.env` and fill values.

## Environment
```
DISCORD_TOKEN=YOUR_BOT_TOKEN
GUILD_ID=YOUR_GUILD_ID
GENERAL_VC_ID=VOICE_CHANNEL_ID_FOR_general
OTHER_TEAM_VC_ID=VOICE_CHANNEL_ID_FOR_other_team
ADMIN_SHARED_SECRET=super-secret
PORT=3000
```

## Production (single service)
```bash
cp .env.example .env
docker compose up -d --build
# open http://localhost:3000
```
The server builds the React client and serves it as a SPA.

## Dev mode (hot reload, optional)
```bash
docker compose --profile dev up
# API:    http://localhost:3000
# Client: http://localhost:5173
```
In dev mode, the React app calls the API at `/api/*` on port 3000.

## Commands in the UI
- **Move Selected → other_team**
- **Everyone → general**
- **Refresh** (also auto-refreshes every 3s)
- Provide your `x-admin-key` (value of `ADMIN_SHARED_SECRET`) to authenticate.

## Notes
- The bot must have visibility and `Move Members` on both channels.
- If moves fail, check the bot role is above the users in **Server Settings → Roles**.
