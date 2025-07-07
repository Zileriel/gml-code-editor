// This file contains the renderer process code
// You can safely use the exposed 'api' object here

let editor; // CodeMirror instance
let selectedObject = null; // Currently selected object

// Example of sending a message to the main process
document.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer process started');
    
    // Initialize CodeMirror
    editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        mode: 'javascript',
        theme: 'monokai',
        lineNumbers: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: false,
        readOnly: false
    });

    // Initialize panel resizing
    initializePanelResizing();

    // Initialize project handling
    initializeProjectHandling();
});

function initializeProjectHandling() {
    // Handle project errors
    window.api.receive('project-error', (errorMessage) => {
        showNotification(errorMessage, 'error');
    });

    // Handle project opened
    window.api.receive('project-opened', (projectData) => {
        console.log('Project opened:', projectData);
        showNotification(`Project opened: ${projectData.path}`, 'success');
        renderAssetTree(projectData.assets);
    });
}

function renderAssetTree(assets) {
    const scriptsRoot = document.querySelector('#scripts-root .tree-content');
    const objectsRoot = document.querySelector('#objects-root .tree-content');
    
    // Clear existing content
    scriptsRoot.innerHTML = '';
    objectsRoot.innerHTML = '';

    // Create folder structure for scripts
    const scriptFolders = createFolderStructure(assets.scripts);
    renderFolderStructure(scriptsRoot, scriptFolders, 'script');

    // Create folder structure for objects
    const objectFolders = createFolderStructure(assets.objects);
    renderFolderStructure(objectsRoot, objectFolders, 'object');
}

function createFolderStructure(items) {
    const root = { children: {}, items: [] };

    for (const item of items) {
        // If path is empty, add to root items
        if (!item.path) {
            root.items.push(item);
            continue;
        }

        const pathParts = item.path.split('/').filter(Boolean); // Remove empty strings
        let current = root;

        // Create folder structure
        for (const part of pathParts) {
            if (!current.children[part]) {
                current.children[part] = { children: {}, items: [] };
            }
            current = current.children[part];
        }

        // Add item to the final folder
        current.items.push(item);
    }

    // Sort items in each folder
    function sortFolderContents(folder) {
        // Sort items
        folder.items.sort((a, b) => {
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
        });

        // Sort child folders
        const sortedChildren = {};
        Object.keys(folder.children)
            .sort((a, b) => {
                // Extract numbers from the start of names if they exist
                const aMatch = a.match(/^(\d+)/);
                const bMatch = b.match(/^(\d+)/);
                
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
                return a.localeCompare(b);
            })
            .forEach(key => {
                sortedChildren[key] = folder.children[key];
                sortFolderContents(sortedChildren[key]); // Recursively sort children
            });
        
        folder.children = sortedChildren;
    }

    // Sort the entire structure
    sortFolderContents(root);

    return root;
}

function renderFolderStructure(parentElement, folder, itemType, level = 0) {
    // Render items in this folder
    for (const item of folder.items) {
        const itemElement = createTreeItem(item, itemType);
        parentElement.appendChild(itemElement);
    }

    // Render subfolders
    for (const [folderName, subFolder] of Object.entries(folder.children)) {
        const folderElement = document.createElement('div');
        folderElement.className = 'tree-folder';

        // Create folder header
        const headerElement = document.createElement('div');
        headerElement.className = 'tree-item folder';
        headerElement.innerHTML = `
            <i class="bi bi-chevron-right"></i>
            <i class="bi bi-folder"></i>
            <span>${folderName}</span>
        `;

        // Create folder content
        const contentElement = document.createElement('div');
        contentElement.className = 'tree-content';
        contentElement.style.display = 'none';

        // Add click handler for folder
        headerElement.addEventListener('click', () => {
            headerElement.classList.toggle('expanded');
            contentElement.style.display = headerElement.classList.contains('expanded') ? 'flex' : 'none';
        });

        folderElement.appendChild(headerElement);
        folderElement.appendChild(contentElement);
        parentElement.appendChild(folderElement);

        // Render folder contents
        renderFolderStructure(contentElement, subFolder, itemType, level + 1);
    }
}

function createTreeItem(item, itemType) {
    const element = document.createElement('div');
    element.className = `tree-item ${itemType}`;
    
    const icon = itemType === 'script' ? 'bi-file-earmark-code' : 'bi-box';
    element.innerHTML = `
        <i class="bi ${icon}"></i>
        <span>${item.name}</span>
    `;

    element.addEventListener('click', async (e) => {
        // Remove selection from other items
        document.querySelectorAll('.tree-item.selected').forEach(item => {
            if (item !== element) {
                item.classList.remove('selected');
            }
        });

        // Toggle selection on this item
        element.classList.toggle('selected');

        if (element.classList.contains('selected')) {
            if (itemType === 'script') {
                // Clear the inspector
                clearInspector();
                
                // Load script content into editor
                try {
                    const content = await window.api.invoke('read-script-content', item.gmlFile);
                    editor.setValue(content || '');
                    editor.refresh();
                } catch (error) {
                    showNotification(`Failed to load script: ${error.message}`, 'error');
                }
            } else if (itemType === 'object') {
                // Store selected object
                selectedObject = item;
                
                // Display object events in inspector
                displayObjectEvents(item);
                
                // Clear the editor
                editor.setValue('');
                editor.refresh();
            }
        } else {
            // If deselected, clear everything
            selectedObject = null;
            clearInspector();
            editor.setValue('');
            editor.refresh();
        }

        // Log the item details
        console.log(`Selected ${itemType}:`, item);
    });

    return element;
}

function clearInspector() {
    const inspectorContent = document.querySelector('#inspector .panel-content');
    inspectorContent.innerHTML = '';
}

function displayObjectEvents(object) {
    const inspectorContent = document.querySelector('#inspector .panel-content');
    clearInspector();

    // Create Sprite section if the object has a sprite
    if (object.sprite) {
        const spriteSection = document.createElement('div');
        spriteSection.className = 'inspector-section';

        const spriteHeader = document.createElement('div');
        spriteHeader.className = 'inspector-section-header';
        spriteHeader.innerHTML = '<i class="bi bi-image"></i> Sprite';
        spriteSection.appendChild(spriteHeader);

        const spriteContent = document.createElement('div');
        spriteContent.className = 'inspector-section-content';

        const spritePreview = document.createElement('div');
        spritePreview.className = 'sprite-preview';

        // Create image element
        const img = document.createElement('img');
        img.alt = object.sprite.name;

        // Load sprite image
        window.api.invoke('read-sprite-image', object.sprite.imagePath)
            .then(base64Image => {
                img.src = base64Image;
            })
            .catch(error => {
                showNotification(`Failed to load sprite: ${error.message}`, 'error');
            });

        // Add sprite name
        const spriteName = document.createElement('div');
        spriteName.className = 'sprite-name';
        spriteName.textContent = object.sprite.name;

        spritePreview.appendChild(img);
        spritePreview.appendChild(spriteName);
        spriteContent.appendChild(spritePreview);
        spriteSection.appendChild(spriteContent);
        inspectorContent.appendChild(spriteSection);
    }

    // Create Properties section
    const propertiesSection = document.createElement('div');
    propertiesSection.className = 'inspector-section';

    const propertiesHeader = document.createElement('div');
    propertiesHeader.className = 'inspector-section-header';
    propertiesHeader.innerHTML = '<i class="bi bi-gear"></i> Properties';
    propertiesSection.appendChild(propertiesHeader);

    const propertiesContent = document.createElement('div');
    propertiesContent.className = 'inspector-section-content';

    // Add property checkboxes
    const properties = [
        { name: 'visible', label: 'Visible' },
        { name: 'persistent', label: 'Persistent' },
        { name: 'solid', label: 'Solid' }
    ];

    properties.forEach(prop => {
        const propertyItem = document.createElement('div');
        propertyItem.className = 'property-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `property-${prop.name}`;
        checkbox.checked = object.yy ? object.yy[prop.name] : true; // Default to true if no yy data

        checkbox.addEventListener('change', async () => {
            try {
                await window.api.invoke('update-object-property', {
                    objectPath: object.yyPath,
                    property: prop.name,
                    value: checkbox.checked
                });
                showNotification(`Updated ${prop.label.toLowerCase()} property`, 'success');
            } catch (error) {
                showNotification(`Failed to update property: ${error.message}`, 'error');
                checkbox.checked = !checkbox.checked; // Revert the checkbox
            }
        });

        const label = document.createElement('label');
        label.htmlFor = `property-${prop.name}`;
        label.textContent = prop.label;

        propertyItem.appendChild(checkbox);
        propertyItem.appendChild(label);
        propertiesContent.appendChild(propertyItem);
    });

    propertiesSection.appendChild(propertiesContent);
    inspectorContent.appendChild(propertiesSection);

    // Create Events section
    const eventsSection = document.createElement('div');
    eventsSection.className = 'inspector-section';

    const eventsHeader = document.createElement('div');
    eventsHeader.className = 'inspector-section-header';
    eventsHeader.innerHTML = '<i class="bi bi-code-square"></i> Events';
    eventsSection.appendChild(eventsHeader);

    // Create events list
    const eventsList = document.createElement('div');
    eventsList.className = 'events-list';

    // Add each event
    object.events.forEach(event => {
        const eventItem = document.createElement('div');
        eventItem.className = 'event-item';
        
        // Format event name for display
        const displayName = event.name
            .replace(/_event/g, '') // Remove _event
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        eventItem.innerHTML = `
            <i class="bi bi-code-square"></i>
            <span>${displayName}</span>
        `;

        eventItem.addEventListener('click', async () => {
            // Remove selection from other events
            document.querySelectorAll('.event-item.selected').forEach(item => {
                if (item !== eventItem) {
                    item.classList.remove('selected');
                }
            });

            // Toggle selection on this event
            eventItem.classList.toggle('selected');

            if (eventItem.classList.contains('selected')) {
                // Load event code into editor
                try {
                    const content = await window.api.invoke('read-script-content', event.file);
                    editor.setValue(content || '');
                    editor.refresh();
                } catch (error) {
                    showNotification(`Failed to load event code: ${error.message}`, 'error');
                }
            }
        });

        eventsList.appendChild(eventItem);
    });

    eventsSection.appendChild(eventsList);
    inspectorContent.appendChild(eventsSection);
}

function showNotification(message, type = 'info') {
    // Create notification container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add to container
    container.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, 5000);
}

function initializePanelResizing() {
    const inspectorDivider = document.getElementById('inspector-divider');
    const editorDivider = document.getElementById('editor-divider');
    const inspector = document.getElementById('inspector');
    const editor = document.getElementById('editor');
    const assetBrowser = document.getElementById('asset-browser');

    // Setup inspector-editor divider
    let startInspectorDrag = 0;
    let startInspectorWidth = 0;

    inspectorDivider.addEventListener('mousedown', (e) => {
        startInspectorDrag = e.pageX;
        startInspectorWidth = inspector.offsetWidth;
        inspectorDivider.classList.add('dragging');
        
        const mouseMoveHandler = (e) => {
            const delta = e.pageX - startInspectorDrag;
            let newWidth = startInspectorWidth + delta;
            
            // Enforce min and max sizes
            newWidth = Math.max(150, Math.min(400, newWidth));
            inspector.style.width = `${newWidth}px`;
        };
        
        const mouseUpHandler = () => {
            inspectorDivider.classList.remove('dragging');
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            document.body.style.userSelect = '';
        };
        
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        document.body.style.userSelect = 'none';
    });

    // Setup editor-asset browser divider
    let startAssetDrag = 0;
    let startAssetWidth = 0;

    editorDivider.addEventListener('mousedown', (e) => {
        startAssetDrag = e.pageX;
        startAssetWidth = assetBrowser.offsetWidth;
        editorDivider.classList.add('dragging');
        
        const mouseMoveHandler = (e) => {
            const delta = startAssetDrag - e.pageX;
            let newWidth = startAssetWidth + delta;
            
            // Enforce min and max sizes
            newWidth = Math.max(150, Math.min(400, newWidth));
            assetBrowser.style.width = `${newWidth}px`;
        };
        
        const mouseUpHandler = () => {
            editorDivider.classList.remove('dragging');
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            document.body.style.userSelect = '';
        };
        
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        document.body.style.userSelect = 'none';
    });
}

// Example of using the IPC bridge
window.api.send('toMain', 'Hello from renderer!');

// Example of receiving messages from main process
window.api.receive('fromMain', (data) => {
    console.log('Received from main process:', data);
}); 