const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// State management
const STATE_FILE = path.join(app.getPath('userData'), 'app-state.json');

async function loadState() {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Return default state if file doesn't exist or is invalid
        return { lastProjectPath: null };
    }
}

async function saveState(state) {
    try {
        await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

let mainWindow;

// Initialize main application window with security settings
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.webContents.openDevTools();
    createMenu();

    // Load last opened project
    const state = await loadState();
    if (state.lastProjectPath) {
        // Wait a bit for the renderer to initialize
        setTimeout(() => {
            validateAndOpenProject(state.lastProjectPath);
        }, 1000);
    }
}

// Create application menu with file operations and view controls
async function createMenu() {
    const state = await loadState();
    
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Project',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openDirectory']
                        });

                        if (!result.canceled) {
                            const projectPath = result.filePaths[0];
                            validateAndOpenProject(projectPath);
                        }
                    }
                },
                {
                    label: 'Recent Project',
                    enabled: state.lastProjectPath !== null,
                    click: async () => {
                        if (state.lastProjectPath) {
                            validateAndOpenProject(state.lastProjectPath);
                        }
                    }
                },
                {
                    label: 'Save Project',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('save-project');
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Feather',
                    accelerator: 'CmdOrCtrl+Shift+L',
                    click: () => {
                        mainWindow.webContents.send('toggle-feather');
                    }
                },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Validate and load GameMaker project directory
async function validateAndOpenProject(projectPath) {
    try {
        const files = await fs.readdir(projectPath);
        const hasYypFile = files.some(file => file.endsWith('.yyp'));

        if (!hasYypFile) {
            mainWindow.webContents.send('project-error', 'Invalid project directory. Please select a GameMaker project folder containing a .yyp file.');
            return;
        }

        const assets = await scanProjectAssets(projectPath);
        mainWindow.webContents.send('project-opened', {
            path: projectPath,
            assets: assets
        });

        // Save the project path in app state
        await saveState({ lastProjectPath: projectPath });

    } catch (error) {
        mainWindow.webContents.send('project-error', `Error opening project: ${error.message}`);
    }
}

// Extract folder path from GameMaker project structure
function processFolderPath(path) {
    if (!path.includes('folders/') || path.endsWith('.yyp')) {
        return '';
    }
    return path.replace(/^folders\//, '').replace(/\.yy$/, '');
}

// Sort items by numeric prefix if present, then alphabetically
function compareItems(a, b) {
    const aName = a.name || '';
    const bName = b.name || '';
    
    const aMatch = aName.match(/^(\d+)/);
    const bMatch = bName.match(/^(\d+)/);
    
    if (aMatch && bMatch) {
        const aNum = parseInt(aMatch[1], 10);
        const bNum = parseInt(bMatch[1], 10);
        if (aNum !== bNum) {
            return aNum - bNum;
        }
    }
    else if (aMatch) return -1;
    else if (bMatch) return 1;
    
    return aName.localeCompare(bName);
}

// Scan project directory for scripts and objects
async function scanProjectAssets(projectPath) {
    const assets = {
        scripts: [],
        objects: []
    };

    // Parse GameMaker YY file format
    async function readYyFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const noTrailingCommas = content.replace(/,(\s*[}\]])/g, '$1');
            const quotedContent = noTrailingCommas.replace(/([\{\,]\s*)([%$\w]+)(\s*:)/g, '$1"$2"$3');
            return JSON.parse(quotedContent);
        } catch (error) {
            console.error(`Error reading .yy file ${filePath}:`, error);
            return null;
        }
    }

    // Scan scripts directory
    try {
        const scriptsPath = path.join(projectPath, 'scripts');
        const scriptFolders = await fs.readdir(scriptsPath);
        
        for (const folder of scriptFolders) {
            const folderPath = path.join(scriptsPath, folder);
            const stats = await fs.stat(folderPath);
            
            if (stats.isDirectory()) {
                const files = await fs.readdir(folderPath);
                const yyFile = files.find(f => f.endsWith('.yy'));
                const gmlFile = files.find(f => f.endsWith('.gml'));
                
                if (yyFile && gmlFile) {
                    const yyData = await readYyFile(path.join(folderPath, yyFile));
                    if (yyData && yyData.parent) {
                        assets.scripts.push({
                            name: folder,
                            path: processFolderPath(yyData.parent.path),
                            type: 'script',
                            gmlFile: path.join(folderPath, gmlFile)
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error scanning scripts:', error);
    }

    // Scan objects directory
    try {
        const objectsPath = path.join(projectPath, 'objects');
        const objectFolders = await fs.readdir(objectsPath);
        
        for (const folder of objectFolders) {
            const folderPath = path.join(objectsPath, folder);
            const stats = await fs.stat(folderPath);
            
            if (stats.isDirectory()) {
                const files = await fs.readdir(folderPath);
                const yyFile = files.find(f => f.endsWith('.yy'));
                const eventFiles = files.filter(f => f.endsWith('.gml'));
                
                if (yyFile && eventFiles.length > 0) {
                    const yyData = await readYyFile(path.join(folderPath, yyFile));
                    if (yyData && yyData.parent) {
                        // Get sprite information if available
                        let spriteInfo = null;
                        if (yyData.spriteId) {
                            const spritePath = path.join(projectPath, yyData.spriteId.path);
                            try {
                                const spriteYyData = await readYyFile(spritePath);
                                if (spriteYyData && spriteYyData.frames && spriteYyData.frames.length > 0) {
                                    const frameName = spriteYyData.frames[0].name;
                                    const spriteDirPath = path.dirname(spritePath);
                                    const imagePath = path.join(spriteDirPath, frameName + '.png');
                                    // Verify the file exists
                                    await fs.access(imagePath);
                                    spriteInfo = {
                                        name: yyData.spriteId.name,
                                        imagePath: imagePath,
                                        width: spriteYyData.width,
                                        height: spriteYyData.height
                                    };
                                }
                            } catch (error) {
                                console.error('Error reading sprite data:', error);
                            }
                        }

                        assets.objects.push({
                            name: folder,
                            path: processFolderPath(yyData.parent.path),
                            type: 'object',
                            yyPath: path.join(folderPath, yyFile),
                            yy: {
                                visible: yyData.visible,
                                persistent: yyData.persistent,
                                solid: yyData.solid
                            },
                            sprite: spriteInfo,
                            events: eventFiles.map(f => ({
                                name: f.replace('.gml', ''),
                                file: path.join(folderPath, f)
                            }))
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error scanning objects:', error);
    }

    // Sort the assets
    assets.scripts.sort(compareItems);
    assets.objects.sort(compareItems);

    return assets;
}

// Add IPC handler for reading script content
ipcMain.handle('read-script-content', async (event, scriptPath) => {
    try {
        const content = await fs.readFile(scriptPath, 'utf8');
        return content;
    } catch (error) {
        throw new Error(`Failed to read script: ${error.message}`);
    }
});

// Add IPC handler for updating object properties
ipcMain.handle('update-object-property', async (event, { objectPath, property, value }) => {
    try {
        // Read the .yy file
        const content = await fs.readFile(objectPath, 'utf8');
        
        // First, try to parse the content as-is
        let yyData;
        try {
            yyData = JSON.parse(content);
        } catch (e) {
            // If parsing fails, try to clean up the content first
            const cleanContent = content
                // Remove multiple consecutive commas
                .replace(/,\s*,/g, ',')
                // Remove trailing commas before closing brackets/braces
                .replace(/,(\s*[}\]])/g, '$1')
                // Ensure property names are quoted
                .replace(/([\{\,]\s*)([%$\w]+)(\s*:)/g, '$1"$2"$3');
            
            yyData = JSON.parse(cleanContent);
        }

        // Update the property
        yyData[property] = value;

        // Convert back to string with proper GameMaker formatting
        let updatedContent = JSON.stringify(yyData, null, 2);

        // Apply GameMaker's formatting style
        updatedContent = updatedContent
            // Add trailing commas after closing quotes and braces when followed by a closing brace
            .replace(/(".*?"|[}\]])([\r\n]\s*[}\]])/g, '$1,$2')
            // Remove any double commas that might have been created
            .replace(/,\s*,/g, ',')
            // Remove trailing comma at the very end of the file
            .replace(/,(\s*})$/, '$1');

        // Write back to file
        await fs.writeFile(objectPath, updatedContent, 'utf8');
        return true;
    } catch (error) {
        throw new Error(`Failed to update object property: ${error.message}`);
    }
});

// Add IPC handler for reading sprite images
ipcMain.handle('read-sprite-image', async (event, imagePath) => {
    try {
        const imageBuffer = await fs.readFile(imagePath);
        return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
        throw new Error(`Failed to read sprite image: ${error.message}`);
    }
});

ipcMain.handle('read-functions-xml', async () => {
    try {
        const xmlPath = path.join(app.getAppPath(), 'functions.xml');
        return await fs.readFile(xmlPath, 'utf8');
    } catch (error) {
        throw new Error(`Failed to read functions.xml: ${error.message}`);
    }
});

// Save project file handler
ipcMain.handle('save-file', async (event, { filePath, content }) => {
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Error saving file:', error);
        return { success: false, error: error.message };
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});