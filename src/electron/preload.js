const { contextBridge, ipcRenderer, webFrame } = require('electron');

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
