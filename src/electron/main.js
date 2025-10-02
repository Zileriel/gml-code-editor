import { app, BrowserWindow, Menu, nativeImage } from 'electron';

// Node.js modules
import path from 'path';
import fs from 'fs';

// App constants
const ROOT_PATH = '/dist-react/index.html';
const DEVELOPMENT_PORT = 5123;
const DEFAULT_WINDOW_WIDTH = 800;
const DEFAULT_WINDOW_HEIGHT = 600;

// Environment and path configurations
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const APP_PATH = app.getAppPath();
const ICON_PATH = path.join(APP_PATH, 'icon.png');

// Application state
let mainWindow = null;

//#region Application Core

/**
 * Creates the main application window with appropriate settings for development and production
 */
const createWindow = () => {
	mainWindow = new BrowserWindow({
		width: DEFAULT_WINDOW_WIDTH,
		height: DEFAULT_WINDOW_HEIGHT,
		icon: ICON_PATH,
		webPreferences: {
			preload: path.join(APP_PATH, 'src', 'electron', 'preload.js'),
			webSecurity: !IS_DEVELOPMENT,
		},
	});

	mainWindow.setMenuBarVisibility(false);

	if (IS_DEVELOPMENT) {
		mainWindow.loadURL(`http://localhost:${DEVELOPMENT_PORT}`);
	} else {
		mainWindow.loadFile(path.join(app.getAppPath() + ROOT_PATH));
	}
};

//#endregion

//#region Application Initialization

/**
 * Initializes the application when ready
 */
function initializeApp() {
	createWindow();

	if (IS_DEVELOPMENT) {
		process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
	}

	const icon = nativeImage.createFromPath(ICON_PATH);
	if (process.platform === 'darwin') {
		app.dock.setIcon(icon);
	}

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
}

app.whenReady().then(initializeApp);

/**
 * Handles the window-all-closed event
 * On macOS, applications typically stay active until the user quits explicitly with Cmd + Q
 */
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
//#endregion
