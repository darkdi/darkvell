# DarkVell

DarkVell is an open-source browser MMORPG prototype with realtime PvP/PvE, an authoritative game server, bots, towns, merchants, teleport gates, loot, arena progression and mobile controls.

The live game is available at [darkvell.ru](https://darkvell.ru).

## Stack

- React and Phaser 3 client
- NestJS game, authentication and reward services
- Raw WebSocket realtime protocol
- Shared TypeScript world data and protocol types
- Android WebView wrapper for RuStore

## Repository layout

- `client/` — React HUD and Phaser game client
- `game-server/` — authoritative simulation and realtime server
- `auth-server/` — account and session API
- `blockchain-service/` — experimental reward/wallet API
- `admin-panel/` — operations interface
- `packages/shared/` — shared protocol, world definitions and item data
- `infra/` — example deployment configuration
- `android-rustore/` — Android WebView wrapper without signing material

## Local development

Requirements: Node.js 20+ and npm 10+.

```bash
cp .env.example .env.local
npm install
npm run build
./scripts/start-local.sh
```

The default local endpoints are:

- client: `http://localhost:4173`
- game HTTP: `http://localhost:3100`
- game WebSocket: `ws://localhost:3101`
- auth: `http://localhost:3200`
- reward service: `http://localhost:3300`

Stop the local services with `./scripts/stop-local.sh`.

## Assets

Copyrighted music, personal portraits, signing keys, player data and third-party editable art are intentionally excluded. Some visual content in the live game therefore does not appear in this repository. See [ASSETS.md](ASSETS.md) before adding or redistributing assets.

The application can build without those private files. Features that depend on an omitted runtime asset may use procedural graphics, remain silent or require a replacement asset that you are licensed to distribute.

## Security and privacy

Never commit `.env` files, production data, account exports, player saves, signing keys, APK/AAB releases or backups. The repository ignore rules cover the known local paths, but contributors remain responsible for reviewing staged files before every commit.

Please report security issues privately to the project owner instead of opening a public exploit report.

## License

Source code is licensed under the [GNU Affero General Public License v3.0](LICENSE). This license does not grant rights to excluded or separately licensed names, logos, music, artwork or other media.
