// GameMaker Lite - Renderer Process
// Handles UI, code editing, and project management

// Core editor state
let editor;                  // CodeMirror instance
let selectedObject = null;   // Currently selected object
let featherEnabled = true;   // Code linting state
let modifiedFiles = new Set(); // Track unsaved changes

// Asset tracking for autocompletion
let assetCompletions = {
    objects: new Set(),  // Set of object names
    scripts: new Set()   // Set of script names
};

// Object-level scope tracking
let currentObjectEvents = new Map(); // Map of event file paths to their content
let objectLocalScope = new Set();    // Set of variables declared in any event of current object

// Add this function near the top with other core functions
async function loadScriptContent(scriptPath) {
    try {
        const content = await window.api.invoke('read-script-content', scriptPath);
        // Update global scope with this script's content
        updateGlobalScope(content);
        
        // If this is an object event, update object-level scope
        if (selectedObject && selectedObject.events.some(e => e.file === scriptPath)) {
            currentObjectEvents.set(scriptPath, content);
            updateObjectScope();
        }
        
        return content;
    } catch (error) {
        console.error(`Error loading script ${scriptPath}:`, error);
        showNotification(`Failed to load script: ${error.message}`, 'error');
        return '';
    }
}

// Function to update object-level scope
function updateObjectScope() {
    objectLocalScope.clear();
    
    // Process each event's content
    for (const content of currentObjectEvents.values()) {
        const lines = content.split('\n');
        
        let inBlockComment = false;
        let currentFunction = null;
        let inFunctionParams = false;
        
        lines.forEach(line => {
            const trimmedLine = line.trim();
            
            // Skip empty lines
            if (trimmedLine === '') return;
            
            // Handle block comments and region directives
            if (trimmedLine.startsWith('#region') || trimmedLine.startsWith('#endregion')) return;
            if (trimmedLine.includes('/*')) inBlockComment = true;
            if (trimmedLine.includes('*/')) {
                inBlockComment = false;
                return;
            }
            if (inBlockComment) return;
            
            // Skip single-line comments
            if (trimmedLine.startsWith('//')) return;
            
            // Check for variable declarations
            const varMatch = line.match(/\b(?:var|globalvar)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (varMatch) {
                objectLocalScope.add(varMatch[1]);
            }
            
            // Check for function declarations and parameters
            const funcMatch = line.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)/);
            if (funcMatch) {
                currentFunction = funcMatch[1];
                if (funcMatch[2]) {
                    const params = funcMatch[2].split(',').map(p => p.trim());
                    params.forEach(param => {
                        if (param) objectLocalScope.add(param);
                    });
                }
            }
            
            // Track function parameters in multi-line declarations
            if (currentFunction) {
                if (line.includes('(')) inFunctionParams = true;
                if (inFunctionParams) {
                    const params = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]+)\b(?=[,\)])/g);
                    if (params) {
                        params.forEach(param => objectLocalScope.add(param));
                    }
                }
                if (line.includes(')')) {
                    inFunctionParams = false;
                    if (line.includes('{')) currentFunction = null;
                }
            }
            
            // Check for array declarations
            const arrayDeclMatch = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\[[^\]]+\]\s*=(?!=)/);
            if (arrayDeclMatch) {
                objectLocalScope.add(arrayDeclMatch[1]);
            }
            
            // Check for implicit declarations through assignment
            const assignMatches = line.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)/g);
            for (const match of assignMatches) {
                const varName = match[1];
                // Skip if it's part of a comparison or in a control structure
                const beforeAssign = line.substring(0, match.index).trim();
                if (!beforeAssign.endsWith('=') && 
                    !beforeAssign.endsWith('<') && 
                    !beforeAssign.endsWith('>') && 
                    !beforeAssign.includes('if') && 
                    !beforeAssign.includes('while') && 
                    !beforeAssign.includes('for')) {
                    objectLocalScope.add(varName);
                }
            }
        });
    }
}

// Language specification data
let gmFunctions = [];  // Functions from XML
let gmBuiltins = [];   // Built-in variables
let gmAtoms = [];      // Constants
let builtinSet = new Set();
let atomSet = new Set();
let functionSet = new Set();
let macroSet = new Set();  // Track defined macros
let enumSet = new Set();   // Track enum values

// GameMaker language keywords
const keywordSet = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue',
    'function', 'return', 'var', 'globalvar', 'enum', 'macro', 'with', 'exit', 'try', 'catch',
    'finally', 'throw', 'delete', 'new', 'constructor', 'static', 'noone', 'global', 'local',
    'and', 'or', 'xor', 'not', 'div', 'mod', 'repeat', 'until', 'with'
]);

// GameMaker asset prefixes
const assetPrefixes = new Set([
    'spr_',  // Sprites
    'obj_',  // Objects
    'rm_',   // Rooms
    'fnt_',  // Fonts
    'snd_',  // Sounds
    'snd_',  // Music
    'path_', // Paths
    'scr_',  // Scripts
    'sh_',   // Shaders
    'seq_',  // Sequences
    'psys_', // Particle Systems
    'ts_',   // Tile sets (alternate)
]);

// Helper function to check if an identifier is an asset reference
function isAssetReference(id) {
    for (const prefix of assetPrefixes) {
        if (id.startsWith(prefix)) return true;
    }
    return false;
}

// Global scope tracking
const globalFunctions = new Set();
const globalEnums = new Set();
const globalMacros = new Set();

// Update global scope from a script
function updateGlobalScope(content) {
    const lines = content.split('\n');
    
    // Track multi-line comment state
    let inBlockComment = false;
    let currentEnum = null;
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (trimmedLine === '') return;
        
        // Handle block comments
        if (trimmedLine.startsWith('/*')) {
            inBlockComment = true;
        }
        if (trimmedLine.endsWith('*/')) {
            inBlockComment = false;
            return;
        }
        if (inBlockComment) return;
        
        // Skip single-line comments
        if (trimmedLine.startsWith('//')) return;
        
        // Check for function declarations
        const funcMatch = line.match(/\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (funcMatch) {
            globalFunctions.add(funcMatch[1]);
        }
        
        // Check for enum declarations
        if (currentEnum === null) {
            const enumMatch = line.match(/\benum\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{?/);
            if (enumMatch) {
                currentEnum = enumMatch[1];
                globalEnums.add(currentEnum);
                
                // If enum is declared on a single line
                if (line.includes('{') && line.includes('}')) {
                    const enumContent = line.substring(line.indexOf('{') + 1, line.lastIndexOf('}'));
                    const members = enumContent.split(',').map(m => m.trim().split('=')[0].trim());
                    members.forEach(member => {
                        if (member) {
                            globalEnums.add(member);
                        }
                    });
                    currentEnum = null;
                }
            }
        } else {
            // Inside an enum declaration
            if (line.includes('}')) {
                currentEnum = null;
            } else {
                // Extract enum members
                const members = line.split(',').map(m => m.trim().split('=')[0].trim());
                members.forEach(member => {
                    if (member && member !== '}') {
                        globalEnums.add(member);
                    }
                });
            }
        }
        
        // Check for macro declarations
        const macroMatch = line.match(/#macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (macroMatch) {
            globalMacros.add(macroMatch[1]);
        }
    });
}

// Initialize global scope by scanning all scripts
async function initializeGlobalScope() {
    try {
        const scripts = await window.api.invoke('get-all-scripts');
        if (!scripts || scripts.length === 0) {
            console.log('No scripts found or no project open');
            return;
        }
        
        // Clear existing global scope
        globalFunctions.clear();
        globalEnums.clear();
        globalMacros.clear();
        
        // First pass: collect all global declarations
        for (const script of scripts) {
            try {
                const content = await window.api.invoke('read-script-content', script);
                updateGlobalScope(content);
            } catch (error) {
                console.error(`Error reading script ${script}:`, error);
            }
        }
        
        console.log('Global scope initialized:', {
            functions: Array.from(globalFunctions),
            enums: Array.from(globalEnums),
            macros: Array.from(globalMacros)
        });
    } catch (error) {
        console.error('Error initializing global scope:', error);
    }
}

// Call this when a project is opened
function handleProjectOpened(projectData) {
    console.log('Project opened:', projectData);
    showNotification(`Project opened: ${projectData.path}`, 'success');
    
    // Clear all panels
    clearEditor();
    clearInspector();
    clearAssetBrowser();
    
    // Clear existing global scope
    globalFunctions.clear();
    globalEnums.clear();
    globalMacros.clear();
    
    // Initialize global scope
    initializeGlobalScope().then(() => {
        // Render new asset tree
        renderAssetTree(projectData.assets);
    });
}

// File Management Functions
function markFileModified(filePath) {
    modifiedFiles.add(filePath);
}

async function saveProject() {
    const promises = [];
    
    for (const filePath of modifiedFiles) {
        let content;
        if (editor && editor.filePath === filePath) {
            content = editor.getValue();
        } else {
            const objectEvent = selectedObject?.events?.find(e => e.gmlFile === filePath);
            if (objectEvent) {
                content = objectEvent.content;
            }
        }

        if (content !== undefined) {
            promises.push(
                window.api.invoke('save-file', { filePath, content })
                    .then(result => {
                        if (result.success) {
                            modifiedFiles.delete(filePath);
                            return { filePath, success: true };
                        } else {
                            return { filePath, success: false, error: result.error };
                        }
                    })
                    .catch(error => ({ filePath, success: false, error: error.message }))
            );
        }
    }

    const results = await Promise.all(promises);
    
    const failed = results.filter(r => !r.success);
    if (failed.length === 0) {
        if (results.length > 0) {
            showNotification('All files saved successfully', 'success');
        } else {
            showNotification('No files needed saving', 'info');
        }
    } else {
        const message = `Failed to save ${failed.length} file(s):\n${failed.map(f => `${path.basename(f.filePath)}: ${f.error}`).join('\n')}`;
        showNotification(message, 'error');
    }
}

// Listen for save project command
window.api.receive('save-project', saveProject);

// Language Specification Functions
function updateLookupSets() {
    builtinSet = new Set(gmBuiltins.map(b => b.text));
    atomSet = new Set(gmAtoms.map(a => a.text));
    functionSet = new Set(gmFunctions.map(f => f.displayText));
}

// Load and parse GameMaker language specification from XML
async function loadGMLanguageSpec() {
    try {
        const xmlContent = await window.api.invoke('read-functions-xml');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
        
        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Failed to parse functions.xml: Invalid XML format');
        }

        // Parse functions with parameters and descriptions
        const functions = xmlDoc.getElementsByTagName("Function");
        if (!functions || functions.length === 0) {
            throw new Error('No functions found in functions.xml');
        }
        
        gmFunctions = Array.from(functions).map(func => {
            const name = func.getAttribute("Name");
            const description = func.getElementsByTagName("Description")[0]?.textContent?.trim() || '';
            const parameters = Array.from(func.getElementsByTagName("Parameter")).map(param => ({
                name: param.getAttribute("Name"),
                type: param.getAttribute("Type"),
                optional: param.getAttribute("Optional") === "true",
                description: param.textContent?.trim() || ''
            }));

            const signature = name + "(" + parameters.map(p => 
                p.optional ? `[${p.name}]` : p.name
            ).join(", ") + ")";

            const hintText = description + "\n\nParameters:" + (parameters.length > 0 
                ? "\n" + parameters.map(p => {
                    let paramText = `${p.name} (${p.type})`;
                    if (p.optional) paramText = `[${paramText}]`;
                    return `• ${paramText}: ${p.description}`;
                }).join("\n")
                : "\nNone");

            return {
                text: signature,
                displayText: name,
                hint: hintText
            };
        });

        // Parse built-in variables
        const variables = xmlDoc.getElementsByTagName("Variable");
        if (variables && variables.length > 0) {
            gmBuiltins = Array.from(variables).map(variable => ({
                text: variable.getAttribute("Name"),
                displayText: variable.getAttribute("Name"),
                hint: `${variable.getElementsByTagName("Description")[0]?.textContent?.trim() || ''}\nType: ${variable.getAttribute("Type") || ''}`
            }));
        }

        // Parse constants
        const constants = xmlDoc.getElementsByTagName("Constant");
        if (constants && constants.length > 0) {
            gmAtoms = Array.from(constants).map(constant => ({
                text: constant.getAttribute("Name"),
                displayText: constant.getAttribute("Name"),
                hint: `${constant.getElementsByTagName("Description")[0]?.textContent?.trim() || ''}\nValue: ${constant.getAttribute("Value") || ''}`
            }));
        }

        updateLookupSets();
        console.log(`Successfully loaded GameMaker language spec:
            • ${gmFunctions.length} functions
            • ${gmBuiltins.length} variables
            • ${gmAtoms.length} constants`);
        showNotification(`Loaded GameMaker language specification`, 'success');

        if (editor) editor.refresh();
    } catch (error) {
        console.error("Error loading GM language spec:", error);
        showNotification(`Failed to load GameMaker language spec: ${error.message}`, 'error');
        gmFunctions = [];
        gmBuiltins = [];
        gmAtoms = [];
        updateLookupSets();
    }
}

// Initialize editor and load language spec
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Renderer process started');
    await loadGMLanguageSpec();
    
    // Register custom hint function for code completion
    CodeMirror.registerHelper("hint", "gamemaker", function(editor, options) {
        const cursor = editor.getCursor();
        const token = editor.getTokenAt(cursor);
        const start = token.start;
        const end = cursor.ch;
        const line = cursor.line;
        const currentWord = token.string;

        const list = [];

        // Function to add completions that match the current word
        function addCompletions(items, itemType) {
            for (const item of items) {
                const text = typeof item === 'string' ? item : item.displayText;
                const displayText = typeof item === 'string' ? item : item.displayText;
                const searchText = typeof item === 'string' ? item : item.displayText;
                
                if (searchText.toLowerCase().startsWith(currentWord.toLowerCase())) {
                    const completion = {
                        text: text,
                        displayText: displayText,
                        type: itemType,
                        from: CodeMirror.Pos(line, start),
                        to: CodeMirror.Pos(line, end),
                        render: function(element, self, data) {
                            const div = document.createElement('div');
                            div.style.display = 'flex';
                            div.style.justifyContent = 'space-between';
                            div.style.alignItems = 'center';
                            
                            const textSpan = document.createElement('span');
                            textSpan.textContent = data.displayText;
                            div.appendChild(textSpan);
                            
                            if (data.type) {
                                const typeSpan = document.createElement('span');
                                typeSpan.textContent = data.type;
                                typeSpan.style.marginLeft = '10px';
                                typeSpan.style.opacity = '0.7';
                                typeSpan.style.fontSize = '0.9em';
                                div.appendChild(typeSpan);
                            }
                            
                            element.appendChild(div);

                            // Set tooltip for functions
                            if (itemType === 'function' && typeof item === 'object' && item.hint) {
                                element.title = item.hint;
                            }
                        }
                    };

                    // For functions, add a custom completion handler
                    if (itemType === 'function') {
                        const originalText = completion.text;
                        completion.text = originalText + "()";
                        completion.callback = function(cm) {
                            const pos = cm.getCursor();
                            cm.setCursor({line: pos.line, ch: pos.ch - 1});
                        };
                    }

                    list.push(completion);
                }
            }
        }

        // Add different types of completions
        addCompletions(gmBuiltins, 'builtin');
        addCompletions(Array.from(keywordSet), 'keyword');
        addCompletions(gmAtoms, 'constant');
        addCompletions(gmFunctions, 'function');
        
        // Add asset completions
        addCompletions(Array.from(assetCompletions.objects), 'asset');
        addCompletions(Array.from(assetCompletions.scripts), 'asset');

        return {
            list: list,
            from: CodeMirror.Pos(line, start),
            to: CodeMirror.Pos(line, end)
        };
    });

    // Define a custom mode that extends JavaScript
    CodeMirror.defineMode("gamemaker", function(config) {
        const jsMode = CodeMirror.getMode(config, "javascript");
        
        return {
            startState: function() {
                return {
                    jsState: CodeMirror.startState(jsMode),
                    inString: false,
                    lastToken: null,
                    isFunction: false,
                    parenDepth: 0  // Track nested parentheses
                };
            },
            token: function(stream, state) {
                // Check for strings first to avoid matching keywords inside strings
                if (!state.inString) {
                    if (stream.peek() === '"' || stream.peek() === "'") {
                        state.inString = !state.inString;
                    }
                }

                // Handle function calls and their parentheses
                if (state.isFunction && stream.peek() === '(') {
                    state.parenDepth++;
                    stream.next();
                    return 'bracket function-bracket';
                }

                // Handle closing parentheses for functions
                if (state.parenDepth > 0 && stream.peek() === ')') {
                    state.parenDepth--;
                    stream.next();
                    if (state.parenDepth === 0) {
                        state.isFunction = false;
                    }
                    return 'bracket function-bracket';
                }

                // Reset function state when not followed by parenthesis
                if (state.isFunction && stream.peek() !== '(' && state.parenDepth === 0) {
                    state.isFunction = false;
                }

                // Check for GameMaker specific tokens
                if (!state.inString) {
                    const ch = stream.peek();
                    if (/[a-zA-Z_]/.test(ch)) {
                        const word = stream.match(/[a-zA-Z_]\w*/)[0];
                        
                        // Check each type of token
                        if (builtinSet.has(word)) {
                            state.lastToken = 'builtin';
                            return 'builtin';
                        }
                        if (atomSet.has(word) || globalEnums.has(word) || globalMacros.has(word) || isAssetReference(word)) {
                            state.lastToken = 'atom';
                            return 'atom';
                        }
                        if (keywordSet.has(word)) {
                            state.lastToken = 'keyword';
                            return 'keyword';
                        }
                        if (functionSet.has(word) || globalFunctions.has(word)) {
                            state.lastToken = 'function';
                            state.isFunction = true;
                            return 'function';
                        }

                        // Let JavaScript mode handle other cases
                        stream.backUp(word.length);
                    }
                }

                // Handle strings to avoid matching keywords inside them
                if (stream.peek() === '"' || stream.peek() === "'") {
                    state.inString = !state.inString;
                }

                // Get the token from JavaScript mode
                const token = jsMode.token(stream, state.jsState);
                state.lastToken = token;
                return token;
            },
            indent: function(state, textAfter) {
                return jsMode.indent(state.jsState, textAfter);
            },
            electricInput: jsMode.electricInput,
            lineComment: jsMode.lineComment,
            blockCommentStart: jsMode.blockCommentStart,
            blockCommentEnd: jsMode.blockCommentEnd,
            fold: jsMode.fold,
            closeBrackets: jsMode.closeBrackets
        };
    });

    // Advanced GameMaker Language (GML) Linter
    CodeMirror.registerHelper("lint", "gamemaker", function(text, options, editor) {
        const found = [];
        const lines = text.split('\n');
        
        // Use the dynamically loaded sets
        const keywords = typeof keywordSet !== 'undefined' ? keywordSet : new Set();
        const builtinFunctions = typeof functionSet !== 'undefined' ? functionSet : new Set();
        const builtinAtoms = typeof atomSet !== 'undefined' ? atomSet : new Set();
        const builtinConstants = new Set([
            ...builtinSet, // Built-in variables
            'global',  // Add global as a builtin constant
        ]);
        
        // Common GML event constants
        const eventConstants = new Set([
            'ev_create', 'ev_destroy', 'ev_step', 'ev_alarm', 'ev_keyboard', 'ev_mouse',
            'ev_collision', 'ev_other', 'ev_draw', 'ev_keypress', 'ev_keyrelease',
            'ev_left_button', 'ev_right_button', 'ev_middle_button', 'ev_no_button',
            'ev_left_press', 'ev_right_press', 'ev_middle_press', 'ev_left_release',
            'ev_right_release', 'ev_middle_release', 'ev_mouse_enter', 'ev_mouse_leave',
            'ev_mouse_wheel_up', 'ev_mouse_wheel_down', 'ev_global_left_button',
            'ev_global_right_button', 'ev_global_middle_button', 'ev_global_left_press',
            'ev_global_right_press', 'ev_global_middle_press', 'ev_global_left_release',
            'ev_global_right_release', 'ev_global_middle_release', 'ev_joystick1_left',
            'ev_joystick1_right', 'ev_joystick1_up', 'ev_joystick1_down', 'ev_joystick1_button1',
            'ev_joystick1_button2', 'ev_joystick1_button3', 'ev_joystick1_button4',
            'ev_joystick1_button5', 'ev_joystick1_button6', 'ev_joystick1_button7',
            'ev_joystick1_button8', 'ev_joystick2_left', 'ev_joystick2_right', 'ev_joystick2_up',
            'ev_joystick2_down', 'ev_joystick2_button1', 'ev_joystick2_button2',
            'ev_joystick2_button3', 'ev_joystick2_button4', 'ev_joystick2_button5',
            'ev_joystick2_button6', 'ev_joystick2_button7', 'ev_joystick2_button8',
            'ev_outside', 'ev_boundary', 'ev_game_start', 'ev_game_end', 'ev_room_start',
            'ev_room_end', 'ev_no_more_lives', 'ev_animation_end', 'ev_end_of_path',
            'ev_no_more_health', 'ev_user0', 'ev_user1', 'ev_user2', 'ev_user3', 'ev_user4',
            'ev_user5', 'ev_user6', 'ev_user7', 'ev_user8', 'ev_user9', 'ev_user10',
            'ev_user11', 'ev_user12', 'ev_user13', 'ev_user14', 'ev_user15', 'ev_step_normal',
            'ev_step_begin', 'ev_step_end', 'ev_gui', 'ev_gui_begin', 'ev_gui_end'
        ]);

        // Helper functions
        function isStringContext(line, pos) {
            let inString = false;
            let stringChar = null;
            for (let i = 0; i < pos && i < line.length; i++) {
                if ((line[i] === '"' || line[i] === "'") && (i === 0 || line[i-1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = line[i];
                    } else if (line[i] === stringChar) {
                        inString = false;
                    }
                }
            }
            return inString;
        }

        function isCommentContext(line, pos) {
            // Check for single-line comments
            const commentStart = line.indexOf('//');
            if (commentStart !== -1 && pos >= commentStart) {
                // Make sure the comment isn't inside a string
                let inString = false;
                let stringChar = null;
                for (let i = 0; i < commentStart; i++) {
                    if ((line[i] === '"' || line[i] === "'") && (i === 0 || line[i-1] !== '\\')) {
                        if (!inString) {
                            inString = true;
                            stringChar = line[i];
                        } else if (line[i] === stringChar) {
                            inString = false;
                        }
                    }
                }
                return !inString;
            }
            return false;
        }

        function getWordAtPosition(line, pos) {
            let start = pos;
            let end = pos;
            
            // Find start of word
            while (start > 0 && /[a-zA-Z0-9_]/.test(line[start - 1])) {
                start--;
            }
            
            // Find end of word
            while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) {
                end++;
            }
            
            return {
                word: line.substring(start, end),
                start: start,
                end: end
            };
        }

        // Track variables and functions across the entire script
        const declaredVariables = new Set();
        const declaredFunctions = new Set();
        const usedVariables = new Set();
        const functionArguments = new Set(); // Track function arguments

        // Global bracket/brace tracking for multi-line structures
        let globalOpenBraces = 0;
        let globalOpenParens = 0;
        let globalOpenBrackets = 0;
        let globalInString = false;
        let globalStringChar = null;
        let globalInBlockComment = false;
        let currentEnum = null;
        let currentFunction = null;
        let inFunctionParams = false;

        // First pass: collect declarations and function arguments
        lines.forEach((line, lineIndex) => {
            const trimmedLine = line.trim();
            
            // Skip region directives
            if (trimmedLine.startsWith('#region') || trimmedLine.startsWith('#endregion')) {
                return;
            }

            // Handle block comments
            if (trimmedLine.includes('/*')) {
                globalInBlockComment = true;
            }
            if (trimmedLine.includes('*/')) {
                globalInBlockComment = false;
                return;
            }
            if (globalInBlockComment) {
                return;
            }
            
            // Skip empty lines and comments
            if (trimmedLine === '' || trimmedLine.startsWith('//')) {
                return;
            }

            // Check for function declarations and arguments
            const funcMatch = line.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)/);
            if (funcMatch) {
                currentFunction = funcMatch[1];
                declaredFunctions.add(currentFunction);
                if (funcMatch[2]) {
                    const params = funcMatch[2].split(',').map(p => p.trim());
                    params.forEach(param => {
                        if (param) {
                            functionArguments.add(param);
                            declaredVariables.add(param);
                        }
                    });
                }
            }

            // Track function parameters in multi-line declarations
            if (currentFunction) {
                if (line.includes('(')) inFunctionParams = true;
                if (inFunctionParams) {
                    const params = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]+)\b(?=[,\)])/g);
                    if (params) {
                        params.forEach(param => {
                            functionArguments.add(param);
                            declaredVariables.add(param);
                        });
                    }
                }
                if (line.includes(')')) {
                    inFunctionParams = false;
                    if (line.includes('{')) currentFunction = null;
                }
            }

            // Check for array declarations
            const arrayDeclMatch = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\[[^\]]+\]\s*=(?!=)/);
            if (arrayDeclMatch) {
                declaredVariables.add(arrayDeclMatch[1]);
            }

            // Check for implicit declarations through assignment
            const assignMatches = line.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)/g);
            for (const match of assignMatches) {
                const varName = match[1];
                // Skip if it's part of a comparison or in a control structure
                const beforeAssign = line.substring(0, match.index).trim();
                if (!beforeAssign.endsWith('=') && 
                    !beforeAssign.endsWith('<') && 
                    !beforeAssign.endsWith('>') && 
                    !beforeAssign.includes('if') && 
                    !beforeAssign.includes('while') && 
                    !beforeAssign.includes('for')) {
                    declaredVariables.add(varName);
                }
            }

            // Track enum declarations
            const enumMatch = line.match(/\benum\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{/);
            if (enumMatch) {
                currentEnum = enumMatch[1];
            }
            if (currentEnum && line.includes('}')) {
                currentEnum = null;
            }
        });

        // Reset block comment state and enum state for second pass
        globalInBlockComment = false;
        currentEnum = null;
        currentFunction = null;
        inFunctionParams = false;

        // Process each line
        lines.forEach((line, lineIndex) => {
            const trimmedLine = line.trim();
            
            // Skip region directives
            if (trimmedLine.startsWith('#region') || trimmedLine.startsWith('#endregion')) {
                return;
            }

            // Handle block comments
            if (trimmedLine.includes('/*')) {
                globalInBlockComment = true;
            }
            if (trimmedLine.includes('*/')) {
                globalInBlockComment = false;
                return;
            }
            if (globalInBlockComment) return;
            
            // Skip empty lines and single-line comments
            if (trimmedLine === '' || trimmedLine.startsWith('//')) {
                return;
            }

            // Check for undefined variables
            const identifiers = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);
            if (identifiers) {
                identifiers.forEach(id => {
                    const idIndex = line.indexOf(id);

                    // Skip if in comment or string
                    if (isCommentContext(line, idIndex) || isStringContext(line, idIndex) || 
                        line.includes('/*') || line.includes('*/') || globalInBlockComment) {
                        return;
                    }

                    // Handle global variables
                    if (id === 'global') return;
                    
                    // Check if this is a dot accessor
                    const beforeId = line.substring(0, idIndex).trim();
                    const afterId = line.substring(idIndex + id.length);
                    if (beforeId.endsWith('.') || afterId.trim().startsWith('.')) return;

                    // Check if this is a global variable access
                    if (beforeId.endsWith('global.')) {
                        declaredVariables.add(id);
                        return;
                    }

                    // Check if this is a struct property declaration
                    const isInStruct = globalOpenBraces > 0 && line.includes(':') && !line.includes('function');
                    if (isInStruct && idIndex < line.indexOf(':')) {
                        declaredVariables.add(id);
                        return;
                    }
                    
                    // Get the full identifier
                    const fullId = getWordAtPosition(line, idIndex).word;

                    // Check if it's an asset reference
                    if (isAssetReference(fullId)) return;
                    
                    // Check if it's in object-level scope
                    if (objectLocalScope.has(fullId)) return;

                    // Check if it's a function argument
                    if (functionArguments.has(fullId)) return;

                    // Check if it's a color literal
                    const colorMatch = line.match(/#[0-9a-fA-F]{6}\b/);
                    if (colorMatch && line.includes(colorMatch[0])) return;

                    // Check global scope
                    if (globalFunctions.has(fullId) || globalEnums.has(fullId) || globalMacros.has(fullId)) return;

                    // Check if it's a builtin
                    if (builtinFunctions.has(fullId) || builtinConstants.has(fullId) || 
                        builtinAtoms.has(fullId) || keywords.has(fullId) || eventConstants.has(fullId)) return;

                    // Check if it's a declared function
                    if (declaredFunctions.has(fullId)) return;
                    
                    // Skip if it's an explicit declaration
                    if (line.includes('var ' + fullId) || line.includes('globalvar ' + fullId)) {
                        declaredVariables.add(fullId);
                        return;
                    }

                    // Add to used variables if not already handled
                    usedVariables.add(fullId);
                    
                    // Check if variable is undeclared
                    if (!declaredVariables.has(fullId) && !objectLocalScope.has(fullId)) {
                        found.push({
                            from: CodeMirror.Pos(lineIndex, idIndex),
                            to: CodeMirror.Pos(lineIndex, idIndex + fullId.length),
                            message: `Variable '${fullId}' is used but not declared`,
                            severity: "warning"
                        });
                    }
                });
            }

            // 1. Check for empty assignments
            const emptyAssignMatch = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*$/);
            if (emptyAssignMatch || /=\s*;/.test(line)) {
                const match = line.match(/=/);
                if (match) {
                    found.push({
                        from: CodeMirror.Pos(lineIndex, match.index),
                        to: CodeMirror.Pos(lineIndex, line.length),
                        message: "Empty assignment - value is required",
                        severity: "error"
                    });
                }
            }

            // 2. Check for missing semicolons
            if (!/^\s*$/.test(line) && // not empty line
                !/^\s*\/\//.test(line) && // not a comment
                !/^\s*\/\*/.test(line) && // not a block comment
                !/^\s*\*/.test(line) && // not inside block comment
                !/^\s*\*\//.test(line) && // not end of block comment
                !/;\s*$/.test(line) && // doesn't end with semicolon
                !/^\s*\}/.test(line) && // not closing brace
                !/\{\s*$/.test(line) && // doesn't end with opening brace
                !/^\s*#/.test(line) && // not a preprocessor directive
                !/^\s*(if|else|for|while|do|switch|case|default|with|repeat|function|enum|macro)\b/.test(line) && // not control structure
                !/^\s*\w+:/.test(line) && // not a label
                // Skip comma-separated lines inside curly braces
                !(/,\s*$/.test(line) && globalOpenBraces > 0)) {
                found.push({
                    from: CodeMirror.Pos(lineIndex, line.length),
                    to: CodeMirror.Pos(lineIndex, line.length),
                    message: "Missing semicolon",
                    severity: "info"
                });
            }

            // 3. Check for incorrect assignment operators
            const assignmentMatch = line.match(/\b(\w+)\s*(==|!=|<=|>=|<|>)\s*([^;]+);/);
            if (assignmentMatch && !line.includes('if') && !line.includes('while') && !line.includes('for') && !line.includes('return')) {
                // Additional check: make sure it's not part of a boolean expression
                const beforeMatch = line.substring(0, assignmentMatch.index);
                if (!beforeMatch.includes('(') && !beforeMatch.includes('return')) {
                    found.push({
                        from: CodeMirror.Pos(lineIndex, assignmentMatch.index + assignmentMatch[1].length),
                        to: CodeMirror.Pos(lineIndex, assignmentMatch.index + assignmentMatch[1].length + assignmentMatch[2].length + 1),
                        message: `Comparison operator '${assignmentMatch[2]}' used in assignment context. Did you mean '='?`,
                        severity: "error"
                    });
                }
            }

            // 4. Check for assignment in conditions
            const conditionAssignMatch = line.match(/\b(if|while)\s*\(\s*([^)]*[^=!<>]=(?!=)[^)]*)\s*\)/);
            if (conditionAssignMatch) {
                // Make sure it's actually an assignment (single =) and not a comparison (==, !=, <=, >=)
                const conditionPart = conditionAssignMatch[2];
                if (conditionPart.includes('=') && !conditionPart.includes('==') && !conditionPart.includes('!=') && !conditionPart.includes('<=') && !conditionPart.includes('>=')) {
                    found.push({
                        from: CodeMirror.Pos(lineIndex, conditionAssignMatch.index),
                        to: CodeMirror.Pos(lineIndex, conditionAssignMatch.index + conditionAssignMatch[0].length),
                        message: "Assignment in condition. Did you mean '==' for comparison?",
                        severity: "info"
                    });
                }
            }

            // 5. Check for incorrect string concatenation
            const stringConcatMatch = line.match(/["'][^"']*["']\s*\+\s*\d+/);
            if (stringConcatMatch) {
                found.push({
                    from: CodeMirror.Pos(lineIndex, stringConcatMatch.index),
                    to: CodeMirror.Pos(lineIndex, stringConcatMatch.index + stringConcatMatch[0].length),
                    message: "String concatenation with number may not work as expected. Use string() function.",
                    severity: "warning"
                });
            }

            // 6. Check for magic numbers
            const magicNumberMatch = line.match(/\b(\d{3,})\b/);
            if (magicNumberMatch && !line.includes('//') && !isStringContext(line, magicNumberMatch.index)) {
                const number = parseInt(magicNumberMatch[1]);
                // Skip if it's a variable declaration, assignment, macro, or enum value
                const isAssignment = line.match(new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*=\\s*${magicNumberMatch[1]}\\b`));
                const isMacro = line.match(/#macro\s+[A-Z_][A-Z0-9_]*\s+/);
                const isEnum = currentEnum || line.match(/enum\s+[A-Z_][A-Z0-9_]*\s*\{/);
                
                if (number > 255 && number !== 1000 && number !== 1024 && 
                    !isAssignment && !isMacro && !isEnum) {
                    found.push({
                        from: CodeMirror.Pos(lineIndex, magicNumberMatch.index),
                        to: CodeMirror.Pos(lineIndex, magicNumberMatch.index + magicNumberMatch[1].length),
                        message: `Magic number '${magicNumberMatch[1]}' should be replaced with a named constant`,
                        severity: "info"
                    });
                }
            }

            // 7. Check for potential infinite loops
            if (line.includes('while (true)') || line.includes('while(true)') || line.includes('while (1)') || line.includes('while(1)')) {
                found.push({
                    from: CodeMirror.Pos(lineIndex, line.indexOf('while')),
                    to: CodeMirror.Pos(lineIndex, line.indexOf(')') + 1),
                    message: "Potential infinite loop detected. Ensure there's a break condition.",
                    severity: "warning"
                });
            }



            // 9. Check for bracket and parenthesis matching
            let openParens = 0;
            let openBrackets = 0;
            let openBraces = 0;
            let inString = false;
            let stringChar = null;
            let inComment = false;

            // Update global state from previous lines
            openParens = globalOpenParens;
            openBrackets = globalOpenBrackets;
            openBraces = globalOpenBraces;
            inString = globalInString;
            stringChar = globalStringChar;

            for (let i = 0; i < line.length; i++) {
                // Handle comment start
                if (line[i] === '/' && i + 1 < line.length && line[i + 1] === '/') {
                    inComment = true;
                    break;
                }

                // Handle string boundaries
                if ((line[i] === '"' || line[i] === "'") && (i === 0 || line[i-1] !== '\\')) {
                    if (!inString) {
                        inString = true;
                        stringChar = line[i];
                    } else if (line[i] === stringChar) {
                        inString = false;
                    }
                    continue;
                }

                // Skip if in string or comment
                if (inString || inComment) continue;

                // Count brackets and parentheses
                if (line[i] === '(') openParens++;
                if (line[i] === ')') openParens--;
                if (line[i] === '[') openBrackets++;
                if (line[i] === ']') openBrackets--;
                if (line[i] === '{') openBraces++;
                if (line[i] === '}') openBraces--;
                
                // Check for immediate mismatches
                if (openParens < 0 || openBrackets < 0 || openBraces < 0) {
                    found.push({
                        from: CodeMirror.Pos(lineIndex, i),
                        to: CodeMirror.Pos(lineIndex, i + 1),
                        message: `Unmatched closing ${line[i] === ')' ? 'parenthesis' : line[i] === ']' ? 'bracket' : 'brace'}`,
                        severity: "error"
                    });
                    // Reset the negative count but keep other counts
                    if (openParens < 0) openParens = 0;
                    if (openBrackets < 0) openBrackets = 0;
                    if (openBraces < 0) openBraces = 0;
                }
            }
            
            // Update global state for next lines
            globalOpenParens = openParens;
            globalOpenBrackets = openBrackets;
            globalOpenBraces = openBraces;
            globalInString = inString;
            globalStringChar = stringChar;

            // Only report unclosed brackets/parentheses if they're clearly within a single statement
            // i.e., if the line ends with a semicolon or is the last line
            if (line.includes(';') || lineIndex === lines.length - 1) {
                if (openParens > 0) {
                    found.push({
                        from: CodeMirror.Pos(lineIndex, line.length),
                        to: CodeMirror.Pos(lineIndex, line.length),
                        message: "Unclosed parenthesis",
                        severity: "error"
                    });
                }
                if (openBrackets > 0) {
                    found.push({
                        from: CodeMirror.Pos(lineIndex, line.length),
                        to: CodeMirror.Pos(lineIndex, line.length),
                        message: "Unclosed bracket",
                        severity: "error"
                    });
                }
            }

            // Check for unclosed strings
            if (inString) {
                found.push({
                    from: CodeMirror.Pos(lineIndex, line.length),
                    to: CodeMirror.Pos(lineIndex, line.length),
                    message: "Unclosed string",
                    severity: "error"
                });
            }

            // 10. Check for incorrect function calls
            const functionCallMatch = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
            if (functionCallMatch) {
                functionCallMatch.forEach(match => {
                    const funcName = match.replace(/\s*\($/, '');
                    // Skip if in comment, string, or accessed with dot
                    const funcIndex = line.indexOf(match);
                    if (isCommentContext(line, funcIndex) || isStringContext(line, funcIndex) || 
                        line.includes('/*') || line.includes('*/') || globalInBlockComment) {
                        return;
                    }
                    
                    // Skip if accessed with dot notation
                    const beforeFunc = line.substring(0, funcIndex).trim();
                    if (beforeFunc.endsWith('.')) {
                        return;
                    }

                    if (!builtinFunctions.has(funcName) && !declaredFunctions.has(funcName) && 
                        !keywords.has(funcName) && !globalFunctions.has(funcName)) {
                        const index = line.indexOf(match);
                        found.push({
                            from: CodeMirror.Pos(lineIndex, index),
                            to: CodeMirror.Pos(lineIndex, index + funcName.length),
                            message: `Function '${funcName}' is not defined`,
                            severity: "error"
                        });
                    }
                });
            }

            // 11. Check for incorrect variable naming
            const variableMatch = line.match(/\b(var|globalvar)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
            if (variableMatch) {
                variableMatch.forEach(match => {
                    const varName = match.replace(/\b(var|globalvar)\s+/, '');
                    if (keywords.has(varName) || builtinFunctions.has(varName) || builtinAtoms.has(varName) || builtinConstants.has(varName)) {
                        const index = line.indexOf(varName);
                        found.push({
                            from: CodeMirror.Pos(lineIndex, index),
                            to: CodeMirror.Pos(lineIndex, index + varName.length),
                            message: `Variable name '${varName}' conflicts with keyword or built-in function`,
                            severity: "error"
                        });
                    }
                    if (varName.length < 2) {
                        const index = line.indexOf(varName);
                        found.push({
                            from: CodeMirror.Pos(lineIndex, index),
                            to: CodeMirror.Pos(lineIndex, index + varName.length),
                            message: "Variable name should be at least 2 characters long",
                            severity: "info"
                        });
                    }
                });
            }

            // 13. Check for common GML mistakes
            if (line.includes('alarm[0] = -1')) {
                found.push({
                    from: CodeMirror.Pos(lineIndex, line.indexOf('alarm[0] = -1')),
                    to: CodeMirror.Pos(lineIndex, line.indexOf('alarm[0] = -1') + 'alarm[0] = -1'.length),
                    message: "Setting alarm to -1 stops it. Use positive values to set alarm duration.",
                    severity: "info"
                });
            }

            // 16. Check for incorrect event usage
            const eventMatch = line.match(/\bevent_perform\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/);
            if (eventMatch) {
                const eventType = eventMatch[1];
                const eventNumber = eventMatch[2];
                if (!eventConstants.has(eventType) && isNaN(parseInt(eventType))) {
                    found.push({
                        from: CodeMirror.Pos(lineIndex, eventMatch.index),
                        to: CodeMirror.Pos(lineIndex, eventMatch.index + eventMatch[0].length),
                        message: `Unknown event type '${eventType}'. Use event constants like ev_step, ev_create, etc.`,
                        severity: "warning"
                    });
                }
            }
        });

        return found;
    });

    // Add custom CSS for linting
    const lintingCSS = `
        .CodeMirror-lint-tooltip {
            background-color: #252526;
            border: 1px solid #3c3c3c;
            border-radius: 4px;
            color: #d4d4d4;
            font-family: inherit;
            font-size: 12px;
            padding: 4px 8px;
        }

        .CodeMirror-lint-message-error {
            color: #f44747;
        }

        .CodeMirror-lint-message-warning {
            color: #ff8800;
        }

        .CodeMirror-lint-marker-error {
            color: #f44747;
        }

        .CodeMirror-lint-marker-warning {
            color: #ff8800;
        }

        .CodeMirror-lint-marker {
            width: 16px;
            height: 16px;
        }
    `;

    // Add the linting CSS
    const lintStyle = document.createElement('style');
    lintStyle.textContent = lintingCSS;
    document.head.appendChild(lintStyle);

    // Update CSS classes for syntax highlighting
    const customCSS = `
        .cm-s-ambiance .cm-builtin { color: #58E55A !important; }
        .cm-s-ambiance .cm-atom { color: #FF8080 !important; }
        .cm-s-ambiance .cm-keyword, .cm-s-ambiance .cm-function { color: #FFB871 !important; }
        .cm-s-ambiance .cm-function-bracket { color: #FFB871 !important; }
    `;

    // Add custom CSS to the document
    const style = document.createElement('style');
    style.textContent = customCSS;
    document.head.appendChild(style);
    
    // Initialize CodeMirror with linting enabled
    editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        mode: 'gamemaker',
        theme: 'ambiance',
        lineNumbers: true,
        
        // Linting options
        lint: featherEnabled,
        gutters: featherEnabled ? 
            ["CodeMirror-lint-markers", "CodeMirror-linenumbers", "CodeMirror-foldgutter"] :
            ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        
        // Auto brackets and matching
        autoCloseBrackets: true,
        matchBrackets: true,
        
        // Code folding
        foldGutter: true,
        foldOptions: {
            widget: '...',
            minFoldSize: 2
        },
        
        // Indentation
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        smartIndent: true,
        
        // Line handling
        lineWrapping: false,
        firstLineNumber: 1,
        
        // Editor features
        readOnly: false,
        autofocus: true,
        scrollbarStyle: "native",
        
        // Key bindings
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Ctrl-Q": function(cm) { cm.foldCode(cm.getCursor()); },
            "Ctrl-/": "toggleComment",
            "Cmd-/": "toggleComment",
            "Shift-Tab": "indentLess",
            "Tab": function(cm) {
                if (cm.somethingSelected()) {
                    cm.indentSelection("add");
                } else {
                    cm.replaceSelection("    ", "end", "+input");
                }
            }
        },
        
        // Enable automatic autocompletion
        hintOptions: {
            hint: CodeMirror.hint.gamemaker,
            completeSingle: false,
            alignWithWord: true,
            closeOnUnfocus: true,
            completeOnSingleClick: true,
            customKeys: {
                Up: function(cm, handle) { handle.moveFocus(-1); },
                Down: function(cm, handle) { handle.moveFocus(1); },
                PageUp: function(cm, handle) { handle.moveFocus(-10); },
                PageDown: function(cm, handle) { handle.moveFocus(10); },
                Home: function(cm, handle) { handle.setFocus(0); },
                End: function(cm, handle) { handle.setFocus(handle.length - 1); },
                Enter: function(cm, handle) {
                    handle.pick();
                }
            }
        }
    });

    // Enable real-time linting
    editor.on("change", function(cm, change) {
        if (editor.filePath) {
            markFileModified(editor.filePath);
        }
        // Force lint refresh after each change
        cm.performLint();
    });

    // Enable automatic autocompletion as you type
    editor.on("inputRead", function(cm, change) {
        if (!change.text[0] || change.text[0] === ' ' || change.text[0] === '\n') return;
        const token = cm.getTokenAt(cm.getCursor());
        if (token.string.length >= 1) {
            cm.showHint({ completeSingle: false });
        }
    });

    // Handle completion selection
    editor.on("pick", function(item) {
        if (item.callback) {
            item.callback(editor);
        }
    });

    // Add key handler for Tab
    editor.on("keydown", function(cm, event) {
        if (event.key === 'Tab' && cm.state.completionActive) {
            event.preventDefault();
            event.stopPropagation();
        }
    });

    // Add mouse click handling for autocompletion
    editor.on("mousedown", function(cm, e) {
        const target = e.target;
        if (target.className === 'CodeMirror-hint') {
            const data = cm.state.completionActive.data;
            const completion = data.list[target.hintId];
            if (completion.hint && typeof completion.hint === 'function') {
                completion.hint(cm, data, completion);
            } else {
                data.pick();
            }
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Initialize panel resizing
    initializePanelResizing();

    // Initialize project handling
    initializeProjectHandling();
});

function updateEditorHeader(title = 'Editor') {
    const editorHeader = document.querySelector('#editor .panel-header');
    editorHeader.textContent = title;
}

function clearEditor() {
    if (editor) {
        editor.setValue('');
        editor.filePath = null; // Clear the file path
        editor.refresh();
        updateEditorHeader();
    }
}

function clearInspector() {
    const inspectorContent = document.querySelector('#inspector .panel-content');
    inspectorContent.innerHTML = '';
}

function clearAssetBrowser() {
    const scriptsRoot = document.querySelector('#scripts-root .tree-content');
    const objectsRoot = document.querySelector('#objects-root .tree-content');
    scriptsRoot.innerHTML = '';
    objectsRoot.innerHTML = '';
    
    // Clear asset completions
    assetCompletions.objects.clear();
    assetCompletions.scripts.clear();
}

function initializeProjectHandling() {
    // Handle project errors
    window.api.receive('project-error', (errorMessage) => {
        showNotification(errorMessage, 'error');
    });

    // Handle project opened
    window.api.receive('project-opened', handleProjectOpened);
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

    // Add to asset completions
    if (itemType === 'script' || itemType === 'object') {
        assetCompletions[itemType + 's'].add(item.name);
    }

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
                
                // Load script content into editor and update global scope
                const content = await loadScriptContent(item.gmlFile);
                editor.setValue(content || '');
                editor.filePath = item.gmlFile;
                editor.refresh();
                updateEditorHeader(`Editor - ${item.name}`);
            } else if (itemType === 'object') {
                // Store selected object
                selectedObject = item;
                
                // Display object events in inspector
                displayObjectEvents(item);
                
                // Clear the editor
                clearEditor();
            }
        } else {
            // If deselected, clear everything
            selectedObject = null;
            clearInspector();
            clearEditor();
        }

        // Log the item details
        console.log(`Selected ${itemType}:`, item);
    });

    return element;
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

            // Toggle selection on this item
            eventItem.classList.toggle('selected');

            if (eventItem.classList.contains('selected')) {
                // Load event content into editor and update scopes
                const content = await loadScriptContent(event.file);
                editor.setValue(content || '');
                editor.filePath = event.file;
                editor.refresh();
                updateEditorHeader(`Editor - ${object.name} - ${displayName}`);
            } else {
                // Clear editor when deselected
                clearEditor();
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

// Handle feather toggle
window.api.receive('toggle-feather', () => {
    featherEnabled = !featherEnabled;
    
    // Update editor options
    editor.setOption('lint', featherEnabled);
    
    // Update gutters
    const gutters = ["CodeMirror-linenumbers", "CodeMirror-foldgutter"];
    if (featherEnabled) {
        gutters.unshift("CodeMirror-lint-markers");
    }
    editor.setOption('gutters', gutters);
    
    // Clear lint markers if disabling
    if (!featherEnabled) {
        editor.clearGutter("CodeMirror-lint-markers");
    } else {
        // Force a lint refresh if enabling
        editor.performLint();
    }
    
    // Show notification
    showNotification(`Feather ${featherEnabled ? 'enabled' : 'disabled'}`, 'info');
}); 