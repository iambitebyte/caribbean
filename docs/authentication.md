# Authentication Guide

## Overview

Caribbean provides flexible authentication mechanisms to secure your cluster management interface. Authentication can be enabled for both Agent connections and Web UI access.

## Authentication Methods

Caribbean supports two types of authentication:

1. **Token-based Authentication** - For Agent connections
2. **Username/Password + JWT Authentication** - For Web UI access

Both authentication methods can be enabled independently.

---

## Agent Authentication (Token-based)

### Setup

Use the `--token` option when initializing the server:

```bash
caribbean-server init --token your-secret-token-here
```

### Agent Configuration

Configure the agent with the matching token:

```json
{
  "auth": {
    "token": "your-secret-token-here"
  }
}
```

Or use CLI:

```bash
caribbean-agent init --token your-secret-token-here
```

### How it Works

- Agents include the token in the WebSocket connection headers
- Server validates the token on connection
- Invalid tokens are rejected with a 401 error

---

## Web UI Authentication (Username/Password + JWT)

### Method 1: Using Web UI Settings (Recommended)

You can manage authentication settings directly from the Web UI:

1. Access the dashboard at `http://localhost:3000`
2. Click the **Settings** (gear icon) button in the top-right corner
3. Configure authentication settings:
   - Toggle **"Enable Web Login Authentication"** to enable/disable login
   - Enter **Username** and **Password** (required when enabling auth)
   - Configure **Agent Token** for agent connections
   - Click **Save** to apply changes
4. Settings take effect immediately without server restart
5. After enabling authentication, you'll be logged out and need to login again

### Method 2: Using CLI Commands

Use the `set-auth` command to enable Web UI authentication:

```bash
# Set username and password
caribbean-server set-auth --username admin --password your-secure-password

# The server will restart automatically
caribbean-server restart
```

### Disable Authentication

#### From Web UI
1. Go to Settings page
2. Toggle off "Enable Web Login Authentication"
3. Click Save

#### From CLI

To disable authentication (useful for internal networks):

```bash
caribbean-server set-auth --disable
caribbean-server restart
```

### Check Authentication Status

```bash
caribbean-server status
```

Output:
```
Server Configuration:
  WebSocket Port: 8080
  WebSocket Path: /ws/agent
  Max Connections: 1000
  API Port: 3000
  Web UI: http://0.0.0.0:3000
  Auth Enabled: true
  Username: admin
  Password: ******
```

---

## Authentication Flow

### Web UI Login Process

1. **User accesses Web UI** at `http://localhost:3000`
2. **Authentication check**: Server validates JWT token from localStorage
3. **If not authenticated**:
   - Redirect to `/login` page
   - User enters username and password
   - POST request to `/api/login`
   - Server validates credentials and issues JWT token (valid for 7 days)
   - Token stored in localStorage
   - Redirect to dashboard
4. **If token invalid/expired**:
   - API returns 401
   - Modal dialog appears asking user to login
   - User clicks "前往登录" to go to login page
5. **Authenticated requests**:
   - JWT token included in `Authorization: Bearer <token>` header
   - Server validates token and processes request

### JWT Token Details

- **Expiration**: 7 days from issuance
- **Storage**: Browser localStorage
- **Validation**: Server-side verification using secret key
- **Auto-logout**: When token expires, user must re-login

---

## Configuration File

The authentication settings are stored in `~/.caribbean/server.json`:

```json
{
  "auth": {
    "enabled": true,
    "tokens": ["agent-token-here"],
    "user": {
      "username": "admin",
      "password": "your-password"
    },
    "jwtSecret": "caribbean-jwt-secret-1234567890"
  }
}
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Master switch for authentication |
| `tokens` | string[] | List of valid tokens for Agent connections |
| `user.username` | string | Web UI login username |
| `user.password` | string | Web UI login password |
| `jwtSecret` | string | Secret key for JWT token signing (auto-generated) |

---

## API Reference

### Authentication Settings Endpoint

#### Get Settings

**GET** `/api/settings`

Retrieves current authentication settings.

**Authentication**: Required if Web UI auth is enabled

**Success Response (200 OK):**
```json
{
  "auth": {
    "enabled": true,
    "username": "admin",
    "agentTokenSet": true
  }
}
```

#### Update Authentication Settings

**POST** `/api/settings/auth`

Updates authentication configuration. Changes take effect immediately without server restart.

**Authentication**: Required if Web UI auth is enabled

**Request Body:**
```json
{
  "enabled": true,
  "username": "admin",
  "password": "new-password",
  "agentToken": "optional-agent-token"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | boolean | No | Enable or disable Web UI authentication |
| `username` | string | When `enabled=true` | Username for Web UI login |
| `password` | string | When `enabled=true` | Password for Web UI login |
| `agentToken` | string | No | Agent authentication token (empty string to disable) |

**Success Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Note:** When authentication is enabled or credentials are changed, a new JWT token is returned. The frontend automatically stores this token for continued access.

**Error Responses:**

- **400 Bad Request**: Missing required fields
  ```json
  {
    "error": "Username and password are required to enable auth"
  }
  ```

- **401 Unauthorized**: Not logged in (if auth is enabled)

- **500 Internal Server Error**: Failed to update settings
  ```json
  {
    "error": "Failed to update settings"
  }
  ```

### Login Endpoint

**POST** `/api/login`

Authenticates user and returns JWT token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "admin"
}
```

**Error Responses:**

- **400 Bad Request**: Authentication not enabled
  ```json
  {
    "error": "Authentication is not enabled"
  }
  ```

- **400 Bad Request**: Missing credentials
  ```json
  {
    "error": "Username and password are required"
  }
  ```

- **401 Unauthorized**: Invalid credentials
  ```json
  {
    "error": "Invalid username or password"
  }
  ```

---

## Security Best Practices

### For Internal Networks

If running in a trusted internal network:
- Disable Web UI authentication for convenience
- Keep Agent token authentication for an extra layer of security
- Use network firewalls to restrict access

```bash
caribbean-server set-auth --disable
```

### For Public Access

When exposing to the internet:
- Enable both Agent and Web UI authentication
- Use strong passwords (minimum 12 characters, mixed case)
- Consider enabling HTTPS/TLS
- Regularly rotate passwords and tokens
- Use firewall rules to restrict access

```bash
# Generate strong password
openssl rand -base64 24

# Set authentication
caribbean-server set-auth --username admin --password <strong-password>
```

### Password Guidelines

- Minimum length: 12 characters
- Include uppercase and lowercase letters
- Include numbers and special characters
- Avoid common words or patterns
- Rotate passwords regularly (every 90 days)

### Token Guidelines

- Use cryptographically random tokens
- Minimum length: 32 characters
- Never commit tokens to version control
- Use environment variables for tokens in production
- Rotate tokens regularly

Generate secure token:
```bash
openssl rand -hex 32
# or
openssl rand -base64 32
```

---

## Troubleshooting

### Cannot Login

**Problem**: Login always fails with "Invalid username or password"

**Solutions**:
1. Check if authentication is enabled:
   ```bash
   caribbean-server status
   ```
2. Verify username and password match configuration
3. Check server logs for errors:
   ```bash
   journalctl -u caribbean-server -n 50
   ```
4. Ensure server has been restarted after setting authentication

### 401 Unauthorized on API Calls

**Problem**: API requests return 401 even after login

**Solutions**:
1. Check browser console for token storage errors
2. Clear localStorage and try logging in again
3. Check JWT token expiration (7 days)
4. Verify token is being sent in `Authorization` header

### Session Expires Too Quickly

**Problem**: Logged out frequently

**Solutions**:
1. Check browser localStorage size limits
2. Ensure no browser extensions are clearing localStorage
3. Check network connectivity
4. Consider increasing JWT expiration time (modify server code)

### Agent Cannot Connect

**Problem**: Agent connection rejected with 401

**Solutions**:
1. Verify token matches server configuration
2. Check token is included in agent configuration
3. Ensure authentication is enabled on server
4. Restart agent after updating token

---

## Hot Reload

Caribbean supports hot reloading of authentication settings. When you update settings via the Web UI, changes take effect immediately without requiring a server restart.

### What Gets Hot Reloaded

1. **Web UI Authentication** - Enable/disable, username, password
2. **Agent Authentication** - Token validation
3. **JWT Secret** - When credentials change, all existing tokens are invalidated

### Behavior

- **Enabling authentication**: All existing sessions are invalidated, users must login again
- **Disabling authentication**: Current users remain logged in, but new users can access without login
- **Changing credentials**: All JWT tokens are invalidated, requiring re-login
- **Changing agent token**: New agents must use the updated token; existing connections remain valid

### CLI vs Web UI

| Feature | CLI | Web UI |
|---------|-----|---------|
| Requires restart | ✅ Yes | ❌ No |
| Invalidate sessions | ❌ No | ✅ Yes |
| Return new token | ❌ No | ✅ Yes |
| Convenience | 🔧 Advanced | 🖱️ User-friendly |

---

## Advanced Configuration

### Custom JWT Secret

You can specify a custom JWT secret:

```bash
# Edit configuration file manually
nano ~/.caribbean/server.json

# Change jwtSecret to your custom secret
"jwtSecret": "your-custom-jwt-secret"

# Restart server
caribbean-server restart
```

### Multiple Agent Tokens

You can configure multiple tokens for different agents:

```json
{
  "auth": {
    "enabled": true,
    "tokens": [
      "token-for-agent-1",
      "token-for-agent-2",
      "token-for-agent-3"
    ]
  }
}
```

### Disable Specific Authentication Methods

To disable Agent authentication but keep Web UI authentication:

```json
{
  "auth": {
    "enabled": true,
    "tokens": [],
    "user": {
      "username": "admin",
      "password": "your-password"
    }
  }
}
```

To disable Web UI authentication but keep Agent authentication:

```json
{
  "auth": {
    "enabled": true,
    "tokens": ["agent-token"],
    "user": null
  }
}
```

---

## Environment Variables

You can also configure authentication using environment variables:

```bash
# Agent token
export CARIBBEAN_AUTH_TOKEN="your-secret-token"

# Web UI credentials
export CARIBBEAN_WEB_USERNAME="admin"
export CARIBBEAN_WEB_PASSWORD="your-password"

# JWT secret
export CARIBBEAN_JWT_SECRET="your-jwt-secret"
```

---

## Integration Examples

### cURL with Authentication

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' \
  | jq -r '.token')

# Use token for API calls
curl -X GET http://localhost:3000/api/nodes \
  -H "Authorization: Bearer $TOKEN"
```

### JavaScript with Authentication

```javascript
import axios from 'axios';

// Login
const loginResponse = await axios.post('/api/login', {
  username: 'admin',
  password: 'your-password'
});

const token = loginResponse.data.token;

// Use token for subsequent requests
const response = await axios.get('/api/nodes', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Python with Authentication

```python
import requests

# Login
login_response = requests.post('http://localhost:3000/api/login', json={
    'username': 'admin',
    'password': 'your-password'
})

token = login_response.json()['token']

# Use token for subsequent requests
headers = {'Authorization': f'Bearer {token}'}
response = requests.get('http://localhost:3000/api/nodes', headers=headers)
```

---

## Summary

| Feature | Agent Auth | Web UI Auth |
|---------|-----------|-------------|
| Type | Token | Username/Password + JWT |
| Enabled By | `--token` flag | Web UI Settings or `set-auth` command |
| Storage | Config file | localStorage |
| Validation | On connection | On API request |
| Expiration | Never | 7 days |
| Recommended for | Internal networks | Public access |

For production deployments, it's recommended to enable both authentication methods for maximum security.

---

## Web UI Settings Page

### Access

The Settings page can be accessed by clicking the gear icon (⚙️) in the top-right corner of the dashboard, or by navigating to `http://localhost:3000/settings`.

### Features

#### Authentication Section

1. **Web Login Authentication Toggle**
   - Enable or disable username/password authentication for the Web UI
   - When enabled, all users must login to access the dashboard
   - When disabled, the dashboard is publicly accessible

2. **Username**
   - Display name for the admin user
   - Required when authentication is enabled

3. **Password**
   - Secure password for login
   - Shows/hide toggle for convenience
   - Confirmation field to prevent typos

#### Agent Authentication Section

1. **Agent Token**
   - Token required for agents to connect to the server
   - Can be set, changed, or cleared (leave empty to disable)
   - Password field with show/hide toggle
   - Shows if a token is already set (without revealing the value)

### Workflow

#### Enable Authentication

1. Navigate to Settings page
2. Toggle "Enable Web Login Authentication" to ON
3. Enter username and password
4. Confirm password
5. Click Save
6. You'll be automatically logged out
7. Login with your new credentials

#### Disable Authentication

1. Navigate to Settings page
2. Toggle "Enable Web Login Authentication" to OFF
3. Click Save
4. Dashboard becomes immediately accessible without login

#### Update Credentials

1. Navigate to Settings page
2. Update username and/or password
3. Confirm new password
4. Click Save
5. You'll receive a new token automatically
6. Continue using the dashboard seamlessly

#### Configure Agent Token

1. Navigate to Settings page
2. Enter token in the "Agent Token" field
3. Click Save
4. New agents must use this token to connect
5. To disable agent auth, clear the token field and save

### Error Messages

| Message | Cause | Solution |
|---------|--------|----------|
| "Username is required" | Username field is empty | Enter a username |
| "Password is required" | Password field is empty | Enter a password |
| "Passwords do not match" | Confirmation doesn't match | Re-enter password in both fields |
| "Settings saved successfully" | Operation succeeded | No action needed |
| "Failed to save settings" | Server error | Check server logs and try again |
| "Failed to load settings" | Cannot retrieve settings | Check server is running and network connection |

### Security Notes

- Passwords are never returned from the server
- Agent tokens are masked in the UI (only shows if set)
- All changes require a save action
- Authentication changes invalidate existing sessions
- Settings page is protected by current authentication (if enabled)

