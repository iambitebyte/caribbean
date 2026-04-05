# Development Guide

## Prerequisites

- Node.js 18+
- pnpm package manager
- jq（发布时需要）

## Quick Start

```bash
# Clone the repository
git clone https://github.com/bitebyte/caribbean.git
cd caribbean

# Install dependencies
pnpm install

# Build all packages and start
./start.sh
```

---

## Project Structure

```
caribbean/
├── apps/
│   ├── agent/              # Node Agent
│   │   └── src/
│   │       ├── collector.ts    # Status collector
│   │       ├── config-fixer.ts # OpenClaw config fixer
│   │       ├── websocket.ts    # WebSocket client
│   │       ├── cli.ts          # CLI commands
│   │       └── index.ts        # Entry point
│   │
│   ├── server/             # Server
│   │   └── src/
│   │       ├── websocket-hub.ts    # WebSocket Hub
│   │       ├── api.ts              # REST API
│   │       ├── node-manager.ts     # Node management
│   │       ├── database.ts         # Database management
│   │       └── index.ts            # Entry point
│   │
│   └── web/                # Web Dashboard (private, not published)
│       └── src/
│           ├── components/          # UI components
│           ├── lib/                # Utility functions
│           ├── i18n/               # Internationalization
│           ├── App.tsx             # Main app
│           └── main.tsx            # Entry point
│
├── packages/
│   ├── shared/             # @openclaw-caribbean/shared
│   │   └── src/
│   │       ├── node.ts         # Node types
│   │       ├── daemon.ts       # Daemon management utilities
│   │       └── index.ts
│   └── protocol/           # @openclaw-caribbean/protocol
│       └── src/
│           ├── messages.ts     # Message types
│           └── index.ts
│
├── docs/                   # Documentation
├── docker/                 # Docker configuration
├── build-all.sh            # Build all packages
├── start.sh                # Build + start server & agent
└── publish.sh              # Publish to npm
```

---

## Development Workflow

### One-Click Build & Start

```bash
# Build everything and start server + agent
./start.sh
```

### Build Only

```bash
# Build all packages (shared → protocol → web → server → agent)
./build-all.sh
```

### Start Server

```bash
cd apps/server
npm start
```

### Start Agent (separate terminal)

```bash
cd apps/agent
npm start
```

### Start Web Dashboard Dev Server (optional)

The Web Dashboard supports hot-reload during development:

```bash
cd apps/web
pnpm dev
```

Development mode endpoints:

| Service | URL |
|---------|-----|
| Web Dashboard (dev) | `http://localhost:5173` |
| Server (API + WebSocket) | `http://localhost:3000` |

### Production Build

Build the Web Dashboard into the Server for single-binary deployment:

```bash
cd apps/server
pnpm run build:all
npm start
```

Production mode endpoints:

| Service | Port |
|---------|------|
| REST API + Web UI | `http://localhost:3000` |
| WebSocket | `ws://localhost:8080` |

---

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Lint
pnpm lint
```

---

## Component Development

### Settings Page

The Settings page (`apps/web/src/components/Settings.tsx`) manages authentication configuration:

#### Key Features

1. **State Management**
   - Local settings state for form inputs
   - Current settings from server API
   - Loading/saving/error states

2. **Form Validation**
   - Username required when auth enabled
   - Password required when auth enabled
   - Password confirmation match validation
   - Real-time validation feedback

3. **API Integration**
   - `GET /api/settings` - Load current settings
   - `POST /api/settings/auth` - Update settings
   - Automatic token renewal on credential changes

4. **UI Components**
   - Toggle switches for enable/disable
   - Password fields with show/hide toggle
   - Success/error message banners
   - Language switcher in header

#### Adding New Settings

To add a new setting to the page:

1. Add fields to the `settings` state
2. Add corresponding UI controls in the JSX
3. Add validation in `handleSave` function
4. Update the API call to include new fields
5. Add i18n translations in `zh.json` and `en.json`
6. Update backend API endpoint if needed

#### Example: Adding a New Setting Field

```tsx
// 1. Add to state
const [settings, setSettings] = useState({
  auth: { /* ... */ },
  newSetting: ''  // Add new field
})

// 2. Add UI control
<div>
  <label className="block text-sm font-medium mb-2">
    {t('settings.newSetting')}
  </label>
  <input
    type="text"
    value={settings.newSetting}
    onChange={(e) => setSettings(prev => ({ ...prev, newSetting: e.target.value }))}
    className="w-full px-3 py-2 border rounded-md"
  />
</div>

// 3. Add to save function
await updateAuthSettings({
  // ...existing fields
  newSetting: settings.newSetting
})
```

---

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

### Guidelines

- Ensure TypeScript type checks pass
- All tests must pass
- Follow [Conventional Commits](https://conventionalcommits.org/)
