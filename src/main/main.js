const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load the index.html file
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Open DevTools in development mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    createMenu();
}

function createMenu() {
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
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'toggleDevTools' },
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

async function validateAndOpenProject(projectPath) {
    try {
        // Check if directory contains .yyp file
        const files = await fs.readdir(projectPath);
        const hasYypFile = files.some(file => file.endsWith('.yyp'));

        if (!hasYypFile) {
            mainWindow.webContents.send('project-error', 'Invalid project directory. Please select a GameMaker project folder containing a .yyp file.');
            return;
        }

        // Scan for scripts and objects
        const assets = await scanProjectAssets(projectPath);

        // Send the project data to renderer
        mainWindow.webContents.send('project-opened', {
            path: projectPath,
            assets: assets
        });

    } catch (error) {
        mainWindow.webContents.send('project-error', `Error opening project: ${error.message}`);
    }
}

// Helper function to process folder path
function processFolderPath(path) {
    // Skip paths that don't represent folders (e.g. .yyp files)
    if (!path.includes('folders/') || path.endsWith('.yyp')) {
        return '';
    }
    // Remove 'folders/' prefix and '.yy' extension
    return path.replace(/^folders\//, '').replace(/\.yy$/, '');
}

// Helper function to compare items for sorting
function compareItems(a, b) {
    const aName = a.name || '';
    const bName = b.name || '';
    
    // Extract numbers from the start of names if they exist
    const aMatch = aName.match(/^(\d+)/);
    const bMatch = bName.match(/^(\d+)/);
    
    // If both items start with numbers, compare numerically
    if (aMatch && bMatch) {
        const aNum = parseInt(aMatch[1], 10);
        const bNum = parseInt(bMatch[1], 10);
        if (aNum !== bNum) {
            return aNum - bNum;
        }
    }
    // If only one starts with a number, put it first
    else if (aMatch) return -1;
    else if (bMatch) return 1;
    
    // Otherwise compare alphabetically
    return aName.localeCompare(bName);
}

async function scanProjectAssets(projectPath) {
    const assets = {
        scripts: [],
        objects: []
    };

    // Helper function to read .yy file
    async function readYyFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // Remove trailing commas
            const noTrailingCommas = content.replace(/,(\s*[}\]])/g, '$1');
            
            // Quote all property names that aren't already quoted
            const quotedContent = noTrailingCommas.replace(/([\{\,]\s*)([%$\w]+)(\s*:)/g, '$1"$2"$3');
            
            return JSON.parse(quotedContent);
        } catch (error) {
            console.error(`Error reading .yy file ${filePath}:`, error);
            return null;
        }
    }

    // Helper function to process folder path
    function processFolderPath(path) {
        // Skip paths that don't represent folders (e.g. .yyp files)
        if (!path.includes('folders/') || path.endsWith('.yyp')) {
            return '';
        }
        // Remove 'folders/' prefix and '.yy' extension
        return path.replace(/^folders\//, '').replace(/\.yy$/, '');
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