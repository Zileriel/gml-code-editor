const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Assets
let objects = [];
let paths = [];
let rooms = [];
let sequences = [];
let shaders = [];
let sounds = [];
let sprites = [];
let tilesets = [];
let fonts = [];
let timelines = [];

// Definitions
let macros = [];
let enums = [];
let functions = [];
let globals = [];
let globalvars = [];

contextBridge.exposeInMainWorld('api', {
	send: (channel, data) => {
		ipcRenderer.send(channel, data);
	},
	on: (channel, func) => {
		ipcRenderer.on(channel, (event, ...args) => func(...args));
	},
	invoke: (channel, data) => {
		return ipcRenderer.invoke(channel, data);
	},

	onProjectLoaded: (callback) => {
		const listener = (event, projectData) => callback(projectData);
		ipcRenderer.on('project:loaded', listener);

		return () => {
			ipcRenderer.removeListener('project:loaded', listener);
		};
	},

	replaceInFiles: (replaceOptions) => {
		return ipcRenderer.invoke('api:replace-in-files', replaceOptions);
	},

	getCurrentProjectData: () => {
		return ipcRenderer.invoke('api:get-current-project-data');
	},

	// Git operations
	getGitStatus: () => {
		return ipcRenderer.invoke('api:get-git-status');
	},

	initGitRepo: () => {
		return ipcRenderer.invoke('api:init-git-repo');
	},

	gitCommit: (message) => {
		return ipcRenderer.invoke('api:git-commit', message);
	},

	gitPull: () => {
		return ipcRenderer.invoke('api:git-pull');
	},

	gitPush: () => {
		return ipcRenderer.invoke('api:git-push');
	},

	gitFetch: () => {
		return ipcRenderer.invoke('api:git-fetch');
	},

	gitStageFile: (filePath) => {
		return ipcRenderer.invoke('api:git-stage-file', filePath);
	},

	gitUnstageFile: (filePath) => {
		return ipcRenderer.invoke('api:git-unstage-file', filePath);
	},

	gitRevertFile: (filePath) => {
		return ipcRenderer.invoke('api:git-revert-file', filePath);
	},

	getCurrentBranch: () => {
		return ipcRenderer.invoke('api:get-current-branch');
	},

	gitDiff: (filePath) => {
		return ipcRenderer.invoke('api:git-diff', filePath);
	},

	gitAddRemote: (name, url) => {
		return ipcRenderer.invoke('api:git-add-remote', name, url);
	},

	gitSetUpstream: (remote, branch) => {
		return ipcRenderer.invoke('api:git-set-upstream', remote, branch);
	},

	gitGetRemotes: () => {
		return ipcRenderer.invoke('api:git-get-remotes');
	},

	readFile: (filePath) => {
		return ipcRenderer.invoke('api:read-file', filePath);
	},
});

contextBridge.exposeInMainWorld('menu', {
	/*======= File =======*/
	newWindow: () => ipcRenderer.send('menu:new-window'),
	openProject: () => ipcRenderer.invoke('menu:open-project'),
	openRecentProject: (projectPath) =>
		ipcRenderer.invoke('menu:open-recent-project', projectPath),
	refreshProject: () => ipcRenderer.invoke('menu:refresh-project'),
	getRecentProjects: () => ipcRenderer.invoke('menu:get-recent-projects'),
	saveProject: () => ipcRenderer.send('menu:save-project'),
	saveProjectAs: () => ipcRenderer.send('menu:save-project-as'),
	toggleAutoSave: () => ipcRenderer.send('menu:toggle-auto-save'),
	quitApp: () => ipcRenderer.send('menu:quit-app'),

	/*======= Edit =======*/
	undo: () => document.execCommand('undo'),
	redo: () => document.execCommand('redo'),
	cut: () => document.execCommand('cut'),
	copy: () => document.execCommand('copy'),
	paste: () => document.execCommand('paste'),

	/*======= View =======*/
	reload: () => window.location.reload(),
	toggleFullScreen: (enable) => {
		if (enable) {
			document.body.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	},
	resetZoom: () => webFrame.setZoomLevel(0),
	zoomIn: () => webFrame.setZoomLevel(webFrame.getZoomLevel() + 1),
	zoomOut: () => webFrame.setZoomLevel(webFrame.getZoomLevel() - 1),
	toggleDevTools: () => document.execCommand('toggleDevTools'),
	searchFile: () => ipcRenderer.send('menu:search-file'),
	searchFolder: () => ipcRenderer.send('menu:search-folder'),
	openProjectFolder: () => ipcRenderer.send('menu:open-project-folder'),

	/*======= Help =======*/
	welcome: () => ipcRenderer.send('menu:welcome'),
	documentation: () => ipcRenderer.send('menu:documentation'),
	discord: () => ipcRenderer.send('menu:discord'),
	github: () => ipcRenderer.send('menu:github'),
	checkForUpdates: () => ipcRenderer.send('menu:check-for-updates'),
	reportIssue: () => ipcRenderer.send('menu:report-issue'),
	about: () => ipcRenderer.send('menu:about'),
});

contextBridge.exposeInMainWorld('assets', {
	getObjects: () => objects.map((obj) => obj.name),
	getPaths: () => paths,
	getRooms: () => rooms,
	getSequences: () => sequences,
	getShaders: () => shaders,
	getSounds: () => sounds,
	getSprites: () => sprites,
	getTilesets: () => tilesets,
	getFonts: () => fonts,
	getTimelines: () => timelines,

	getAssets: () => ({
		objects: objects.map((obj) => obj.name),
		paths,
		rooms,
		sequences,
		shaders,
		sounds,
		sprites,
		tilesets,
		fonts,
		timelines,
	}),
});

contextBridge.exposeInMainWorld('definitions', {
	getMacros: () => macros,
	getEnums: () => enums,
	getFunctions: () => functions,
	getGlobals: () => globals,
	getGlobalVars: () => globalvars,

	getDefinitions: () => ({
		macros,
		enums,
		functions,
		globals,
		globalvars,
	}),

	findDefinition: (symbolName) => {
		const macro = macros.find((m) => m.name === symbolName);
		if (macro) return macro;

		const enumDef = enums.find((e) => e.name === symbolName);
		if (enumDef) return enumDef;

		const func = functions.find((f) => f.name === symbolName);
		if (func) return func;

		const global = globals.find((g) => g.name === symbolName);
		if (global) return global;

		const globalvar = globalvars.find((gv) => gv.name === symbolName);
		if (globalvar) return globalvar;

		return null;
	},

	// Add symbol to definitions
	addSymbol: (symbolType, symbol) => {
		let targetArray;
		switch (symbolType) {
			case 'macros':
				targetArray = macros;
				break;
			case 'enums':
				targetArray = enums;
				break;
			case 'functions':
				targetArray = functions;
				break;
			case 'globals':
				targetArray = globals;
				break;
			case 'globalvars':
				targetArray = globalvars;
				break;
			default:
				return;
		}

		// Check if symbol already exists
		const exists = targetArray.find((s) => s.name === symbol.name);
		if (!exists) {
			targetArray.push(symbol);
		}
	},

	// Remove symbol from definitions
	removeSymbol: (symbolType, symbolName) => {
		let targetArray;
		switch (symbolType) {
			case 'macros':
				targetArray = macros;
				break;
			case 'enums':
				targetArray = enums;
				break;
			case 'functions':
				targetArray = functions;
				break;
			case 'globals':
				targetArray = globals;
				break;
			case 'globalvars':
				targetArray = globalvars;
				break;
			default:
				return;
		}

		const index = targetArray.findIndex((s) => s.name === symbolName);
		if (index !== -1) {
			targetArray.splice(index, 1);
		}
	},
});

ipcRenderer.on('project:loaded', (event, projectData) => {
	window.currentProjectData = projectData;

	// Get assets
	objects = projectData.assets.objects || [];
	paths = projectData.assets.paths || [];
	rooms = projectData.assets.rooms || [];
	sequences = projectData.assets.sequences || [];
	shaders = projectData.assets.shaders || [];
	sounds = projectData.assets.sounds || [];
	sprites = projectData.assets.sprites || [];
	tilesets = projectData.assets.tilesets || [];
	fonts = projectData.assets.fonts || [];
	timelines = projectData.assets.timelines || [];

	// Get definitions
	if (projectData.definitions) {
		macros = projectData.definitions.macros || [];
		enums = projectData.definitions.enums || [];
		functions = projectData.definitions.functions || [];
		globals = projectData.definitions.globals || [];
		globalvars = projectData.definitions.globalvars || [];
	}
});
