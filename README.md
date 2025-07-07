# GM Lite

An Electron-based desktop application.

## Project Structure

```
src/
├── main/           # Main process files
│   ├── main.js     # Main entry point
│   └── preload.js  # Preload script for IPC
├── renderer/       # Renderer process files
│   ├── index.html  # Main HTML file
│   ├── scripts/    # Renderer JavaScript files
│   └── styles/     # CSS files
```

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start the application in development mode:
```bash
npm run dev
```

### Build

To build the application:
```bash
npm run build
```

## Features

- Secure IPC communication between main and renderer processes
- Modern UI with clean styling
- Development mode with DevTools enabled 