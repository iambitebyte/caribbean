# Caribbean Web Dashboard

A web-based dashboard for monitoring and managing Caribbean cluster nodes.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Framer Motion** - Animation library
- **React Icons** - Additional icon components

## Features

- Real-time node monitoring
- System resource tracking (CPU, memory, uptime)
- Agent status display
- Connection status indicators
- Auto-refresh every 10 seconds
- Responsive grid layout
- **Multi-instance monitoring** - Track multiple OpenClaw instances with online/offline status
- **Animated status indicators** - Visual feedback with fish/lobster icons showing instance status
- **Health status tracking** - Monitor instance health with color-coded indicators
- **Dynamic animations** - Smooth transitions and hover effects using Framer Motion
- **Memory usage visualization** - Progress bars showing resource utilization

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

The dashboard will be available at `http://localhost:5173`

### Build

```bash
pnpm build
```

### Preview Production Build

```bash
pnpm preview
```

## API Integration

The dashboard connects to the Caribbean Server HTTP API running on `http://localhost:3000`. The following API endpoints are used:

- `GET /api/health` - Server health check
- `GET /api/nodes` - List all nodes
- `GET /api/nodes/:id` - Get node details
- `GET /api/stats` - Get cluster statistics

During development, Vite proxies API requests to the backend server.

## Usage

1. Start the Caribbean Server:
   ```bash
   cd apps/server
   npm run build
   npm start
   ```

2. Start the Web Dashboard:
   ```bash
   cd apps/web
   pnpm dev
   ```

3. Open your browser to `http://localhost:5173`

## Components

- `NodeCard` - Displays individual node information
- `Card` - Base card component from shadcn/ui
- `Button` - Button component with variants
- `Badge` - Status badge component

## Styling

The dashboard uses TailwindCSS with a custom design system based on CSS variables for theming support:

- Light/Dark mode ready
- Custom color palette
- Responsive breakpoints
- Consistent spacing and typography
