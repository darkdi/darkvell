# MMO Crypto PvP Technical Design

## Monorepo

- `client/` React + Phaser 3 + TON Connect PWA.
- `game-server/` NestJS process with raw WebSocket server and authoritative world simulation.
- `auth-server/` NestJS auth API for Telegram and guest sessions.
- `blockchain-service/` NestJS wallet/reward API with TON and Lightning seams.
- `admin-panel/` React operations panel.
- `packages/shared/` shared protocol, class, inventory and world types.

## Realtime Model

The client never decides combat results. It sends input intent:

- movement vector
- dash/block flags
- attack aim and optional target id
- skill id and aim
- reward claim request

The server owns:

- player position clamping
- zone checks
- cooldowns
- PvP safe-zone protection
- monster AI
- damage, death, loot and reward conversion

The vertical slice uses 20 ticks per second. Horizontal scale later needs world sharding and sticky routing by `worldId`.

## Economy Model

- `gold`: off-chain farmed currency.
- `crystal`: premium currency, reserved for later.
- `token`: on-chain reward unit queued by `blockchain-service`.

Current conversion is `25 gold = 1 token`. This is intentionally centralized for the prototype. Production must add fraud checks, rate limits, anti-bot telemetry and treasury accounting.

## Blockchain Model

Mode 1 is TON through Telegram:

- client uses TON Connect
- reward claim passes wallet address
- blockchain service queues a TON reward claim

Mode 2 is Bitcoin Lightning:

- blockchain service exposes a placeholder invoice API
- tournament and arena fees can later call this path

## Persistence Plan

The first slice is in-memory so combat iteration stays fast. The next persistence milestone should add:

- PostgreSQL tables for accounts, characters, inventory, wallets, claims and audit ledger.
- Redis for room presence and short-lived match state.
- Append-only economy ledger before any real payouts.

## Security Plan

Before real money:

- verify Telegram init data server-side
- sign and verify game auth tokens
- add WebSocket rate limits
- validate all wallet claims against an economy ledger
- isolate payout keys from gameplay services
- add observability for abnormal farming, deaths and claims
