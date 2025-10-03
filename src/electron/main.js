import { app, BrowserWindow, ipcMain, nativeImage, dialog } from 'electron';
import Store from 'electron-store';

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
const store = new Store();

//#region Application Core

/**
 * Creates the main application window with appropriate settings for development and production
 */
const createWindow = () => {
	mainWindow = new BrowserWindow({
		width: DEFAULT_WINDOW_WIDTH,
		height: DEFAULT_WINDOW_HEIGHT,
		backgroundColor: '#191919',
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

	// Load current project
	mainWindow.webContents.once('did-finish-load', async () => {
		const currentProject = store.get('currentProject');
		if (currentProject && fs.existsSync(currentProject)) {
			const projectData = await scanGameMakerProject(currentProject);
			mainWindow.webContents.send('project:loaded', projectData);
		}
	});

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

//#region Recent Projects Management

/**
 * Adds a project to recent projects list
 * @param {string} projectPath - Path to the project
 * @param {string} projectName - Name of the project
 */
function addToRecentProjects(projectPath, projectName) {
	const recentProjects = store.get('recentProjects', []);

	const filtered = recentProjects.filter(
		(project) => project.path !== projectPath
	);

	filtered.unshift({
		path: projectPath,
		name: projectName,
		lastOpened: new Date().toISOString(),
	});

	const limited = filtered.slice(0, 10);

	store.set('recentProjects', limited);
}

/**
 * Gets the list of recent projects
 * @returns {Array} Array of recent project objects
 */
function getRecentProjects() {
	const recentProjects = store.get('recentProjects', []);
	return recentProjects.filter((project) => {
		try {
			return fs.existsSync(project.path);
		} catch {
			return false;
		}
	});
}

//#endregion

//#region GameMaker Project Scanner

/**
 * Parses GameMaker's non-standard JSON format
 * Removes trailing commas and comments before parsing
 * @param {string} jsonString - The JSON string to parse
 * @returns {Object} Parsed JSON object
 */
function parseGameMakerJSON(jsonString) {
	try {
		// Remove single-line comments (//)
		let cleaned = jsonString.replace(/\/\/.*$/gm, '');

		// Remove multi-line comments (/* */)
		cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

		// Remove trailing commas before closing braces/brackets
		cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

		// Parse the cleaned JSON
		return JSON.parse(cleaned);
	} catch (error) {
		console.error('Failed to parse GameMaker JSON:', error);
		console.error('Original string:', jsonString.substring(0, 500));
		throw error;
	}
}

/**
 * Scans a GameMaker project and extracts scripts, objects, and notes
 * @param {string} projectPath - Path to the GameMaker project folder
 * @returns {Promise<Object>} Project data with assets
 */
async function scanGameMakerProject(projectPath) {
	const projectData = {
		path: projectPath,
		name: path.basename(projectPath),
		assets: {
			scripts: [],
			objects: [],
			notes: [],
		},
	};

	try {
		// Scan scripts folder
		const scriptsPath = path.join(projectPath, 'scripts');
		if (fs.existsSync(scriptsPath)) {
			projectData.assets.scripts = await scanScripts(scriptsPath);
		}

		// Scan objects folder
		const objectsPath = path.join(projectPath, 'objects');
		if (fs.existsSync(objectsPath)) {
			projectData.assets.objects = await scanObjects(objectsPath);
		}

		// Scan notes folder
		const notesPath = path.join(projectPath, 'notes');
		if (fs.existsSync(notesPath)) {
			projectData.assets.notes = await scanNotes(notesPath);
		}
	} catch (error) {
		console.error('Error scanning project:', error);
	}

	return projectData;
}

/**
 * Scans the scripts folder for GameMaker scripts
 * @param {string} scriptsPath - Path to the scripts folder
 * @returns {Promise<Array>} Array of script objects
 */
async function scanScripts(scriptsPath) {
	const scripts = [];
	const scriptDirs = fs
		.readdirSync(scriptsPath, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	for (const scriptDir of scriptDirs) {
		const scriptPath = path.join(scriptsPath, scriptDir);
		const gmlFile = path.join(scriptPath, `${scriptDir}.gml`);
		const yyFile = path.join(scriptPath, `${scriptDir}.yy`);

		if (fs.existsSync(gmlFile) && fs.existsSync(yyFile)) {
			try {
				const content = fs.readFileSync(gmlFile, 'utf8');
				const metadataRaw = fs.readFileSync(yyFile, 'utf8');
				const metadata = parseGameMakerJSON(metadataRaw);
				scripts.push({
					name: scriptDir,
					type: 'script',
					content,
					metadata,
					path: scriptPath,
				});
			} catch (error) {
				console.error(`Error reading script ${scriptDir}:`, error);
			}
		}
	}

	return scripts;
}

/**
 * Scans the objects folder for GameMaker objects
 * @param {string} objectsPath - Path to the objects folder
 * @returns {Promise<Array>} Array of object data
 */
async function scanObjects(objectsPath) {
	const objects = [];
	const objectDirs = fs
		.readdirSync(objectsPath, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	for (const objectDir of objectDirs) {
		const objectPath = path.join(objectsPath, objectDir);
		const yyFile = path.join(objectPath, `${objectDir}.yy`);

		if (fs.existsSync(yyFile)) {
			try {
				const metadataRaw = fs.readFileSync(yyFile, 'utf8');
				const metadata = parseGameMakerJSON(metadataRaw);

				// Scan for event GML files
				const events = [];
				const files = fs.readdirSync(objectPath);

				for (const file of files) {
					if (file.endsWith('.gml') && file !== `${objectDir}.gml`) {
						const eventPath = path.join(objectPath, file);
						const eventContent = fs.readFileSync(eventPath, 'utf8');
						events.push({
							name: file,
							content: eventContent,
							path: eventPath,
						});
					}
				}

				objects.push({
					name: objectDir,
					type: 'object',
					events,
					metadata,
					path: objectPath,
				});
			} catch (error) {
				console.error(`Error reading object ${objectDir}:`, error);
			}
		}
	}

	return objects;
}

/**
 * Scans the notes folder for GameMaker notes
 * @param {string} notesPath - Path to the notes folder
 * @returns {Promise<Array>} Array of note objects
 */
async function scanNotes(notesPath) {
	const notes = [];
	const noteDirs = fs
		.readdirSync(notesPath, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	for (const noteDir of noteDirs) {
		const notePath = path.join(notesPath, noteDir);
		const txtFile = path.join(notePath, `${noteDir}.txt`);
		const yyFile = path.join(notePath, `${noteDir}.yy`);

		if (fs.existsSync(txtFile) && fs.existsSync(yyFile)) {
			try {
				const content = fs.readFileSync(txtFile, 'utf8');
				const metadataRaw = fs.readFileSync(yyFile, 'utf8');
				const metadata = parseGameMakerJSON(metadataRaw);

				notes.push({
					name: noteDir,
					type: 'note',
					content,
					metadata,
					path: notePath,
				});
			} catch (error) {
				console.error(`Error reading note ${noteDir}:`, error);
			}
		}
	}

	return notes;
}

//#endregion

//#region Ipc Communication
//#region Menu Actions
ipcMain.on('menu:new-window', () => {
	createWindow();
});

ipcMain.handle('menu:open-project', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openDirectory'],
		title: 'Select GameMaker Project Folder',
	});

	if (result.canceled) {
		return null;
	}

	const projectPath = result.filePaths[0];

	// Check if the folder contains a .yyp file
	const files = fs.readdirSync(projectPath);
	const yypFile = files.find((file) => file.endsWith('.yyp'));

	if (!yypFile) {
		dialog.showErrorBox(
			'Invalid Project',
			'Selected folder does not contain a GameMaker project (.yyp file).'
		);
		return null;
	}

	// Save current project
	store.set('currentProject', projectPath);

	// Scan the project
	const projectData = await scanGameMakerProject(projectPath);

	// Add to recent projects
	addToRecentProjects(projectPath, projectData.name);

	// Send project data to renderer
	mainWindow.webContents.send('project:loaded', projectData);

	return projectData;
});

ipcMain.handle('menu:get-recent-projects', async () => {
	return getRecentProjects();
});

ipcMain.on('menu:save-project', () => {
	// Handle project saving
});

ipcMain.on('menu:save-project-as', () => {
	// Handle "Save As" functionality
});

ipcMain.on('menu:toggle-auto-save', () => {
	// Toggle auto-save feature
});

ipcMain.on('menu:quit-app', () => {
	app.quit();
});

ipcMain.on('menu:open-project-folder', () => {
	// Open the current project's folder in the system file explorer
});

ipcMain.handle('menu:refresh-project', async () => {
	const currentProject = store.get('currentProject');
	if (currentProject && fs.existsSync(currentProject)) {
		const projectData = await scanGameMakerProject(currentProject);

		// Update recent projects (move to top)
		addToRecentProjects(currentProject, projectData.name);

		mainWindow.webContents.send('project:loaded', projectData);
		return projectData;
	}
	return null;
});

ipcMain.handle('menu:open-recent-project', async (event, projectPath) => {
	if (!projectPath || !fs.existsSync(projectPath)) {
		dialog.showErrorBox(
			'Project Not Found',
			'The selected project no longer exists at the specified location.'
		);
		return null;
	}

	// Check if it's still a valid GameMaker project
	const files = fs.readdirSync(projectPath);
	const yypFile = files.find((file) => file.endsWith('.yyp'));

	if (!yypFile) {
		dialog.showErrorBox(
			'Invalid Project',
			'Selected folder no longer contains a GameMaker project (.yyp file).'
		);
		return null;
	}

	// Save current project
	store.set('currentProject', projectPath);

	// Scan the project
	const projectData = await scanGameMakerProject(projectPath);

	// Update recent projects (move to top)
	addToRecentProjects(projectPath, projectData.name);

	// Send project data to renderer
	mainWindow.webContents.send('project:loaded', projectData);

	return projectData;
});
//#endregion
//#endregion
