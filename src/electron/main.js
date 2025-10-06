import { app, BrowserWindow, ipcMain, nativeImage, dialog } from 'electron';
import Store from 'electron-store';
import http from 'http';
import { createCanvas, loadImage } from 'canvas';

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

// HTTP server for images
let imageServer = null;
const IMAGE_PORT = 8080;
const spriteFiles = new Map();

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
			webSecurity: false,
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

//#region Simple Image Server

function startImageServer() {
	if (imageServer) return;

	imageServer = http.createServer((req, res) => {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET');

		if (req.method !== 'GET') {
			res.writeHead(405);
			res.end();
			return;
		}

		// Parse URL and size parameter
		const urlParts = req.url.split('?');
		const match = urlParts[0].match(/^\/sprite\/(.+)$/);
		if (!match) {
			res.writeHead(404);
			res.end();
			return;
		}

		const spriteName = match[1];
		const filePath = spriteFiles.get(spriteName);

		let maxSize = null;
		if (urlParts[1]) {
			const params = new URLSearchParams(urlParts[1]);
			const sizeParam = params.get('size');
			if (sizeParam) {
				maxSize = parseInt(sizeParam, 10);
				if (isNaN(maxSize) || maxSize <= 0 || maxSize > 512) {
					maxSize = null;
				}
			}
		}

		if (!filePath || !fs.existsSync(filePath)) {
			res.writeHead(404);
			res.end();
			return;
		}

		try {
			res.setHeader('Content-Type', 'image/png');
			res.setHeader('Cache-Control', 'public, max-age=3600');

			if (maxSize) {
				// Use Canvas for resizing to avoid GLib errors
				loadImage(filePath)
					.then((image) => {
						// Calculate new dimensions maintaining aspect ratio
						let { width, height } = image;
						if (width > maxSize || height > maxSize) {
							if (width > height) {
								height = (height * maxSize) / width;
								width = maxSize;
							} else {
								width = (width * maxSize) / height;
								height = maxSize;
							}
						}

						// Create canvas and draw resized image
						const canvas = createCanvas(Math.round(width), Math.round(height));
						const ctx = canvas.getContext('2d');
						ctx.drawImage(image, 0, 0, Math.round(width), Math.round(height));

						// Send PNG buffer
						const buffer = canvas.toBuffer('image/png');
						res.end(buffer);
					})
					.catch((err) => {
						console.error('Canvas processing error:', err);
						if (!res.headersSent) {
							res.writeHead(500);
							res.end();
						}
					});
			} else {
				// No resizing needed, serve original file
				const stream = fs.createReadStream(filePath);
				stream.pipe(res);
				stream.on('error', () => {
					if (!res.headersSent) {
						res.writeHead(500);
						res.end();
					}
				});
			}
		} catch (error) {
			console.error('Error processing image:', error);
			if (!res.headersSent) {
				res.writeHead(500);
				res.end();
			}
		}
	});

	imageServer.listen(IMAGE_PORT, 'localhost', () => {
		console.log(`Image server running on http://localhost:${IMAGE_PORT}`);
	});
}

function stopImageServer() {
	if (imageServer) {
		imageServer.close();
		imageServer = null;
		spriteFiles.clear();
	}
}

//#endregion

//#region Application Initialization

/**
 * Initializes the application when ready
 */
function initializeApp() {
	// Set environment variables to suppress GLib warnings
	if (process.platform === 'linux') {
		process.env.G_MESSAGES_DEBUG = '';
		process.env.GLIB_MESSAGES_DEBUG = '';
		process.env.G_SLICE = 'always-malloc';
		process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

		process.env.G_DEBUG = '';
	}

	startImageServer();
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
		stopImageServer();
		app.quit();
	}
});

app.on('before-quit', () => {
	stopImageServer();
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
			paths: [],
			rooms: [],
			sequences: [],
			shaders: [],
			sounds: [],
			sprites: [],
			tilesets: [],
			fonts: [],
			timelines: [],
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

		// Get paths
		const pathsPath = path.join(projectPath, 'paths');
		if (fs.existsSync(pathsPath)) {
			projectData.assets.paths = await getAssetNames(pathsPath);
		}

		// Get rooms
		const roomsPath = path.join(projectPath, 'rooms');
		if (fs.existsSync(roomsPath)) {
			projectData.assets.rooms = await getAssetNames(roomsPath);
		}

		// Get sequences
		const sequencesPath = path.join(projectPath, 'sequences');
		if (fs.existsSync(sequencesPath)) {
			projectData.assets.sequences = await getAssetNames(sequencesPath);
		}

		// Get shaders
		const shadersPath = path.join(projectPath, 'shaders');
		if (fs.existsSync(shadersPath)) {
			projectData.assets.shaders = await getAssetNames(shadersPath);
		}

		// Get sounds
		const soundsPath = path.join(projectPath, 'sounds');
		if (fs.existsSync(soundsPath)) {
			projectData.assets.sounds = await getAssetNames(soundsPath);
		}

		// Get sprites
		const spritesPath = path.join(projectPath, 'sprites');
		if (fs.existsSync(spritesPath)) {
			projectData.assets.sprites = await scanSprites(spritesPath);
		}

		// Get tilesets
		const tilesetsPath = path.join(projectPath, 'tilesets');
		if (fs.existsSync(tilesetsPath)) {
			projectData.assets.tilesets = await getAssetNames(tilesetsPath);
		}

		// Get fonts
		const fontsPath = path.join(projectPath, 'fonts');
		if (fs.existsSync(fontsPath)) {
			projectData.assets.fonts = await getAssetNames(fontsPath);
		}

		// Get timelines
		const timelinesPath = path.join(projectPath, 'timelines');
		if (fs.existsSync(timelinesPath)) {
			projectData.assets.timelines = await getAssetNames(timelinesPath);
		}
	} catch (error) {
		console.error('Error scanning project:', error);
	}

	// Compile all definitions from scripts and objects
	const allDefinitions = {
		macros: [],
		enums: [],
		functions: [],
		globals: [],
		globalvars: [],
	};

	// Add definitions from scripts
	if (projectData.assets.scripts) {
		projectData.assets.scripts.forEach((script) => {
			if (script.definitions) {
				allDefinitions.macros.push(...script.definitions.macros);
				allDefinitions.enums.push(...script.definitions.enums);
				allDefinitions.functions.push(...script.definitions.functions);
				allDefinitions.globals.push(...script.definitions.globals);
				allDefinitions.globalvars.push(...script.definitions.globalvars);
			}
		});
	}

	// Add definitions from objects
	if (projectData.assets.objects) {
		projectData.assets.objects.forEach((object) => {
			if (object.definitions) {
				allDefinitions.macros.push(...object.definitions.macros);
				allDefinitions.enums.push(...object.definitions.enums);
				allDefinitions.functions.push(...object.definitions.functions);
				allDefinitions.globals.push(...object.definitions.globals);
				allDefinitions.globalvars.push(...object.definitions.globalvars);
			}
		});
	}

	projectData.definitions = allDefinitions;

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
				const definitions = extractDefinitions(content, scriptDir);
				scripts.push({
					name: scriptDir,
					type: 'script',
					content,
					metadata,
					path: scriptPath,
					definitions,
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
				const allDefinitions = {
					macros: [],
					enums: [],
					functions: [],
					globals: [],
					globalvars: [],
				};
				const files = fs.readdirSync(objectPath);

				for (const file of files) {
					if (file.endsWith('.gml') && file !== `${objectDir}.gml`) {
						const eventPath = path.join(objectPath, file);
						const eventContent = fs.readFileSync(eventPath, 'utf8');
						const eventName = file.replace('.gml', '');
						const definitions = extractDefinitions(
							eventContent,
							objectDir,
							eventName
						);

						// Combine all definitions from this object
						allDefinitions.macros.push(...definitions.macros);
						allDefinitions.enums.push(...definitions.enums);
						allDefinitions.functions.push(...definitions.functions);
						allDefinitions.globals.push(...definitions.globals);
						allDefinitions.globalvars.push(...definitions.globalvars);

						events.push({
							name: file,
							content: eventContent,
							path: eventPath,
							definitions,
						});
					}
				}

				objects.push({
					name: objectDir,
					type: 'object',
					events,
					metadata,
					path: objectPath,
					definitions: allDefinitions,
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

/**
 * Scans the sprites folder for GameMaker sprites
 * @param {string} spritesPath - Path to the sprites folder
 * @returns {Promise<Array>} Array of sprite objects
 */
async function scanSprites(spritesPath) {
	const sprites = [];
	const spriteDirs = fs
		.readdirSync(spritesPath, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	for (const spriteDir of spriteDirs) {
		const spritePath = path.join(spritesPath, spriteDir);
		const yyFile = path.join(spritePath, `${spriteDir}.yy`);
		const pngFile = fs
			.readdirSync(spritePath)
			.find((file) => file.endsWith('.png'));

		let httpUrl = null;
		if (pngFile) {
			const fullImagePath = path.join(spritePath, pngFile);
			// Store the mapping for the HTTP server
			spriteFiles.set(spriteDir, fullImagePath);
			// Create HTTP URL
			httpUrl = `http://localhost:${IMAGE_PORT}/sprite/${spriteDir}`;
		}

		sprites.push({
			name: spriteDir,
			type: 'sprite',
			path: httpUrl,
			localPath: pngFile ? path.join(spritePath, pngFile) : null,
			yyFile,
		});
	}

	return sprites;
}

/**
 * Remove GameMaker comments from text while preserving line structure
 * @param {string} text - The text to process
 * @returns {string} Text with comments replaced by spaces
 */
function removeGameMakerComments(text) {
	let result = '';
	let inBlockComment = false;
	let inString = false;
	let stringChar = '';
	let escaped = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const nextChar = i + 1 < text.length ? text[i + 1] : '';
		const prevChar = i > 0 ? text[i - 1] : '';

		if (escaped) {
			escaped = false;
			result += inString ? ' ' : char;
			continue;
		}

		if (char === '\\' && inString) {
			escaped = true;
			result += ' ';
			continue;
		}

		if (!inBlockComment && !inString && (char === '"' || char === "'")) {
			inString = true;
			stringChar = char;
			result += ' ';
			continue;
		}

		if (inString && char === stringChar) {
			inString = false;
			stringChar = '';
			result += ' ';
			continue;
		}

		if (inString) {
			result += ' ';
			continue;
		}

		// Handle block comments
		if (!inBlockComment && char === '/' && nextChar === '*') {
			inBlockComment = true;
			result += '  '; // Replace /* with spaces
			i++; // Skip the *
			continue;
		}

		if (inBlockComment && char === '*' && nextChar === '/') {
			inBlockComment = false;
			result += '  '; // Replace */ with spaces
			i++; // Skip the /
			continue;
		}

		if (inBlockComment) {
			// Preserve newlines in block comments
			result += char === '\n' ? '\n' : ' ';
			continue;
		}

		// Handle line comments
		if (char === '/' && nextChar === '/') {
			// Replace everything to end of line with spaces
			while (i < text.length && text[i] !== '\n') {
				result += text[i] === '\n' ? '\n' : ' ';
				i++;
			}
			i--; // Adjust for the loop increment
			continue;
		}

		result += char;
	}

	return result;
}

/**
 * Parse JSDoc comments for function documentation
 * @param {Array} lines - Array of code lines
 * @param {number} functionLineIndex - Line index where function is declared
 * @returns {Object|null} Parsed JSDoc information or null
 */
function parseJSDoc(lines, functionLineIndex) {
	const jsdoc = {
		description: '',
		params: [],
		returns: null,
	};

	let foundJSDoc = false;
	let currentLineIndex = functionLineIndex - 1;

	// Look backwards for JSDoc comments
	while (currentLineIndex >= 0) {
		const line = lines[currentLineIndex].trim();

		// Check for /** style JSDoc end
		if (line.endsWith('*/')) {
			foundJSDoc = true;
			break;
		}

		// Check for /// style JSDoc
		if (line.startsWith('///')) {
			foundJSDoc = true;
			break;
		}

		// If we hit a non-whitespace, non-comment line, stop looking
		if (
			line &&
			!line.startsWith('//') &&
			!line.startsWith('*') &&
			line !== ''
		) {
			break;
		}

		currentLineIndex--;
	}

	if (!foundJSDoc) {
		return null;
	}

	// Parse the JSDoc block
	let parseStartIndex = currentLineIndex;
	let isBlockComment = false;

	// Determine if it's a block comment or line comments
	const startLine = lines[currentLineIndex].trim();
	if (startLine.includes('/**') || startLine.endsWith('*/')) {
		isBlockComment = true;
		// Find the start of the block comment
		while (
			parseStartIndex >= 0 &&
			!lines[parseStartIndex].trim().includes('/**')
		) {
			parseStartIndex--;
		}
	}

	// Parse JSDoc content
	for (let i = parseStartIndex; i < functionLineIndex; i++) {
		const line = lines[i].trim();

		// Skip comment markers
		let content = line;
		if (isBlockComment) {
			content = content.replace(/^\/\*\*|^\*\/|^\*\s?/, '');
		} else {
			content = content.replace(/^\/\/\/\s?/, '');
		}

		if (!content) continue;

		// Parse @description or @desc
		const descMatch = content.match(/^@(?:description|desc)\s+(.+)$/);
		if (descMatch) {
			jsdoc.description = descMatch[1];
			continue;
		}

		// Parse @param or @arg
		const paramMatch = content.match(
			/^@(?:param|arg)\s+\{([^}]+)\}\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*-?\s*(.*)$/
		);
		if (paramMatch) {
			jsdoc.params.push({
				type: paramMatch[1],
				name: paramMatch[2],
				description: paramMatch[3] || '',
			});
			continue;
		}

		// Parse @returns or @return
		const returnMatch = content.match(
			/^@(?:returns?|return)\s+\{([^}]+)\}\s*(.*)$/
		);
		if (returnMatch) {
			jsdoc.returns = {
				type: returnMatch[1],
				description: returnMatch[2] || '',
			};
			continue;
		}

		// If no specific tag, add to description
		if (!jsdoc.description && content && !content.startsWith('@')) {
			jsdoc.description = content;
		}
	}

	return jsdoc.description || jsdoc.params.length > 0 || jsdoc.returns
		? jsdoc
		: null;
}

/**
 * Extract function parameters from function declaration
 * @param {string} functionDeclaration - The function declaration line
 * @returns {Array} Array of parameter objects
 */
function extractFunctionParameters(functionDeclaration) {
	const paramMatch = functionDeclaration.match(
		/function\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)/
	);
	if (!paramMatch || !paramMatch[1].trim()) {
		return [];
	}

	const paramString = paramMatch[1].trim();
	return paramString
		.split(',')
		.map((param) => param.trim())
		.filter((param) => param && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param))
		.map((param) => ({ name: param, type: 'any', optional: false }));
}

/**
 * Extract definitions from GML content
 * @param {string} content - GML code content
 * @param {string} assetName - Name of the asset (script or object)
 * @param {string} eventName - Event name (for objects) or null
 * @returns {Object} Object containing arrays of macros, enums, and functions
 */
function extractDefinitions(content, assetName, eventName = null) {
	const definitions = {
		macros: [],
		enums: [],
		functions: [],
		globals: [],
		globalvars: [],
	};

	if (!content) return definitions;

	const lines = content.split('\n');
	const cleanedContent = removeGameMakerComments(content);
	const cleanedLines = cleanedContent.split('\n');

	cleanedLines.forEach((line, index) => {
		const lineNumber = index + 1;
		const trimmedLine = line.trim();

		if (!trimmedLine) return;

		const macroMatch = trimmedLine.match(/#macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
		if (macroMatch) {
			definitions.macros.push({
				name: macroMatch[1],
				location: {
					file: eventName ? `${assetName}_${eventName}` : `${assetName}.gml`,
					line: lineNumber,
					column: line.indexOf(macroMatch[1]) + 1,
					assetName,
					eventName,
				},
				content: lines[index].trim(), // Use original line for content
			});
		}

		const enumMatch = trimmedLine.match(/enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
		if (enumMatch) {
			definitions.enums.push({
				name: enumMatch[1],
				location: {
					file: eventName ? `${assetName}_${eventName}` : `${assetName}.gml`,
					line: lineNumber,
					column: line.indexOf(enumMatch[1]) + 1,
					assetName,
					eventName,
				},
				content: lines[index].trim(), // Use original line for content
			});
		}

		const functionMatch = trimmedLine.match(
			/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/
		);
		if (functionMatch) {
			// Parse JSDoc if available
			const jsdoc = parseJSDoc(lines, index);

			// Extract parameters from function declaration
			const extractedParams = extractFunctionParameters(lines[index]);

			// Merge JSDoc params with extracted params
			let parameters = extractedParams;
			if (jsdoc && jsdoc.params.length > 0) {
				// Use JSDoc params if available, fall back to extracted params
				parameters = jsdoc.params.map((jsdocParam) => {
					const extractedParam = extractedParams.find(
						(p) => p.name === jsdocParam.name
					);
					return {
						name: jsdocParam.name,
						type: jsdocParam.type || 'any',
						description: jsdocParam.description || '',
						optional: false, // GameMaker doesn't have optional params, but JSDoc might indicate this
					};
				});

				// Add any extracted params not in JSDoc
				extractedParams.forEach((param) => {
					if (!parameters.find((p) => p.name === param.name)) {
						parameters.push(param);
					}
				});
			}

			definitions.functions.push({
				name: functionMatch[1],
				location: {
					file: eventName ? `${assetName}_${eventName}` : `${assetName}.gml`,
					line: lineNumber,
					column: line.indexOf(functionMatch[1]) + 1,
					assetName,
					eventName,
				},
				content: lines[index].trim(), // Use original line for content
				parameters: parameters,
				description: jsdoc?.description || '',
				returnType: jsdoc?.returns?.type || 'any',
				returnDescription: jsdoc?.returns?.description || '',
				jsdoc: jsdoc,
			});
		}

		const globalMatch = trimmedLine.match(
			/global\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=/
		);
		if (globalMatch) {
			definitions.globals.push({
				name: globalMatch[1],
				location: {
					file: eventName ? `${assetName}_${eventName}` : `${assetName}.gml`,
					line: lineNumber,
					column: line.indexOf(globalMatch[1]) + 1,
					assetName,
					eventName,
				},
				content: lines[index].trim(), // Use original line for content
			});
		}

		// Handle globalvar declarations (can be multiple in one line)
		const globalvarMatch = trimmedLine.match(
			/globalvar\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)/
		);
		if (globalvarMatch) {
			const varNames = globalvarMatch[1].split(',').map((name) => name.trim());
			varNames.forEach((varName) => {
				if (varName && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
					definitions.globalvars.push({
						name: varName,
						location: {
							file: eventName
								? `${assetName}_${eventName}`
								: `${assetName}.gml`,
							line: lineNumber,
							column: line.indexOf(varName) + 1,
							assetName,
							eventName,
						},
						content: lines[index].trim(), // Use original line for content
					});
				}
			});
		}
	});

	return definitions;
}
/**
 * Gets asset names from a given asset folder
 * @param {string} assetPath - Path to the asset folder
 * @returns {Promise<Array>} Array of asset names
 */
async function getAssetNames(assetPath) {
	return fs
		.readdirSync(assetPath, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);
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
