# Changelog

All notable changes to Caribbean will be documented in this file.

## [0.2.1] - 2026-04-05

### Fixed
- Fixed TypeScript build error in `DatabaseManager`: added null check for `config.path` to handle `string | undefined` type correctly

---

## [0.2.0] - 2026-04-04

### Added
- **Web UI Settings Page** - New settings page accessible via gear icon in header
  - Enable/disable Web UI authentication without server restart
  - Configure username and password for Web UI login
  - Configure agent authentication token
  - Password visibility toggle for all password fields
  - Real-time validation and error messages
  - Support for both Chinese and English languages

### Changed
- **Hot Reload Authentication** - Authentication settings now take effect immediately
  - No server restart required when updating authentication via Web UI
  - Automatic token renewal when credentials change
  - Seamless user experience without interruption

### Added
- **Settings API Endpoints**
  - `GET /api/settings` - Retrieve current authentication settings
  - `POST /api/settings/auth` - Update authentication configuration

### Added
- **Agent Token Validation** - WebSocket connections now validate agent tokens
  - Token validation on connection when agent token is configured
  - Empty token list disables agent authentication
  - Token can be updated via Web UI settings

### Fixed
- Fixed issue where saving authentication settings would show error despite success
- Fixed missing language switcher button on settings page
- Fixed duplicate authentication middleware when hot-reloading configuration

### Security
- JWT secret is regenerated when credentials change, invalidating all existing sessions
- Agent tokens are validated on WebSocket connection
- Passwords are never exposed in API responses
- Agent tokens are masked in the UI (shows only if set, not the value)

---

## [0.1.0] - Initial Release

### Features
- Lightweight Agent + Centralized Server architecture
- WebSocket real-time bidirectional communication
- React + Vite modern Web UI dashboard
- OpenClaw Gateway status monitoring
- Token-based authentication for Agent connections
- Username/Password + JWT authentication for Web UI
- SQLite/PostgreSQL database support
- Node management (view, rename, delete)
- Batch operations (start/stop/delete)
- Command execution with result polling
- Real-time status updates via WebSocket
- Multi-language support (Chinese/English)
