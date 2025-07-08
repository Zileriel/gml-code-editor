// GameMaker Lite - Renderer Process
// Handles UI, code editing, and project management

// Helper functions for code analysis
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

// Code snippets for autocompletion
const codeSnippets = [
    {
        name: "for",
        code: "for (var i = 0; i < 10; i++) {\n    // code\n}"
    },
    {
        name: "while",
        code: "while (condition) {\n    // code\n}"
    },
    {
        name: "repeat",
        code: "repeat (10) {\n    // code\n}"
    },
    {
        name: "if",
        code: "if (condition) {\n    // code\n}"
    },
    {
        name: "ifelse",
        code: "if (condition) {\n    // code\n} else {\n    // else code\n}"
    },
    {
        name: "switch",
        code: "switch (variable) {\n    case value:\n        // code\n        break;\n}"
    },
    {
        name: "move4",
        code: "if (keyboard_check(vk_up)) y -= speed;\nif (keyboard_check(vk_down)) y += speed;\nif (keyboard_check(vk_left)) x -= speed;\nif (keyboard_check(vk_right)) x += speed;"
    },
    {
        name: "key",
        code: "if (keyboard_check_pressed(ord(\"X\"))) {\n    // do something\n}"
    },
    {
        name: "log",
        code: "show_debug_message(\"\");"
    }
];

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
        let inStructDeclaration = false;
        let braceLevel = 0;
        let structBraceStart = -1;
        let currentStructName = null;
        let inTryCatch = false;
        let catchVariable = null;
        let structProperties = new Set(); // Track struct properties
        let inObjectLiteral = false; // Track if we're in any object/struct literal
        let objectLiteralBraceLevel = 0; // Track brace level for object literals
        
        lines.forEach((line, lineIndex) => {
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
            
            // Track brace levels for scope management
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            braceLevel += openBraces - closeBraces;

            // Enhanced object literal and struct detection for scripts
            const scriptStructContexts = [
                /function\s*\w*\s*\([^)]*\)\s*{/,   // Function declarations
                /return\s*{/,                       // Return statements
                /=\s*{/,                           // Assignments
                /:\s*{/,                           // Property values
                /\(\s*{/,                          // Function arguments
                /,\s*{/,                           // Array/object literals in lists
                /\[\s*{/,                          // Array elements
                /^\s*{/,                           // Start of line
                /\b(?:var|let|const)\s+\w+\s*=\s*{/, // Variable declarations
                /\b(?:if|while|for)\s*\([^)]*{/,    // Control structures that might contain structs
                /[^:]\s*{/                         // Any brace not part of a ternary
            ];

            // Check for any context that might introduce a struct
            let structContextFound = false;
            let inStructContext = false;

            // First check if we're already in a struct context from previous lines
            if (braceLevel > 0 && (inObjectLiteral || line.trim().startsWith('}'))) {
                inStructContext = true;
            }

            // Then check for new struct contexts
            for (const pattern of scriptStructContexts) {
                if (pattern.test(line) && !isStringContext(line, line.indexOf('{'))) {
                    structContextFound = true;
                    inStructContext = true;
                    break;
                }
            }

            // If we found a struct context or we're already in one, process property declarations
            if (structContextFound || inStructContext || inObjectLiteral || braceLevel > 0) {
                // Look for property declarations with more lenient whitespace handling
                const propertyMatches = line.matchAll(/(?:^|\s*|[{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\s*:/g);
                for (const match of propertyMatches) {
                    if (!isStringContext(line, match.index) && !isCommentContext(line, match.index)) {
                        const propName = match[1].trim();
                        structProperties.add(propName);
                        objectLocalScope.add(propName);
                    }
                }

                // Also check for struct property access to validate usage
                const propertyAccess = line.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
                for (const match of propertyAccess) {
                    if (!isStringContext(line, match.index) && !isCommentContext(line, match.index)) {
                        const propName = match[1];
                        structProperties.add(propName);
                        objectLocalScope.add(propName);
                    }
                }

                // If this line opens a new brace level, mark as entering object literal
                if (openBraces > 0 && !inObjectLiteral) {
                    inObjectLiteral = true;
                    objectLiteralBraceLevel = braceLevel;
                }
            }

            // Check if we're exiting the object literal
            if (inObjectLiteral && braceLevel < objectLiteralBraceLevel) {
                inObjectLiteral = false;
            }

            // Handle try-catch blocks
            if (line.includes('try') && line.includes('{')) {
                inTryCatch = true;
            }
            const catchMatch = line.match(/catch\s*\((\w+)\)/);
            if (catchMatch) {
                catchVariable = catchMatch[1];
                objectLocalScope.add(catchVariable);
            }
            if (inTryCatch && braceLevel === 0) {
                inTryCatch = false;
                catchVariable = null;
            }

            // Handle struct declarations
            if (!inStructDeclaration && line.match(/=\s*{/)) {
                const structMatch = line.match(/(\w+)\s*=\s*{/);
                if (structMatch) {
                    inStructDeclaration = true;
                    structBraceStart = braceLevel;
                    currentStructName = structMatch[1];
                    objectLocalScope.add(currentStructName);
                }
            }

            // Handle constructor parameters
            const constructorMatch = line.match(/constructor\s*\((.*?)\)/);
            if (constructorMatch && constructorMatch[1]) {
                const params = constructorMatch[1].split(',').map(p => p.trim());
                    params.forEach(param => {
                        if (param) objectLocalScope.add(param);
                    });
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
            // Only if not in a struct declaration and not a comparison
            if (!inStructDeclaration) {
            const assignMatches = line.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)/g);
            for (const match of assignMatches) {
                const varName = match[1];
                const beforeAssign = line.substring(0, match.index).trim();
                    
                    // Skip if it's part of a comparison or in a control structure
                if (!beforeAssign.endsWith('=') && 
                    !beforeAssign.endsWith('<') && 
                    !beforeAssign.endsWith('>') && 
                    !beforeAssign.includes('if') && 
                    !beforeAssign.includes('while') && 
                        !beforeAssign.includes('for') && 
                        !beforeAssign.includes('return') && 
                        !beforeAssign.includes('?') && // Skip ternary operators
                        !beforeAssign.includes(':') && // Skip object property assignments
                        !line.includes('=>')) { // Skip arrow functions
                    objectLocalScope.add(varName);
                }
                }
            }

            // Handle for loop variables
            const forLoopMatch = line.match(/for\s*\(\s*(?:var\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|in|of)/);
            if (forLoopMatch) {
                objectLocalScope.add(forLoopMatch[1]);
            }
        });

        // Add struct properties to object scope
        for (const prop of structProperties) {
            objectLocalScope.add(prop);
        }
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

// Helper function to check if an identifier is an audio group
function isAudioGroup(id) {
    return id.startsWith('audiogroup_');
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
            // Remove debug log
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
        
    } catch (error) {
        console.error('Error initializing global scope:', error);
    }
}

// Call this when a project is opened
function handleProjectOpened(projectData) {
    // Remove debug log
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
    // Remove debug log
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
                let text, displayText, searchText, hint;
                
                if (itemType === 'snippet') {
                    text = item.code;
                    displayText = item.name;
                    searchText = item.name;
                    hint = item.code;
                } else {
                    text = typeof item === 'string' ? item : item.displayText;
                    displayText = typeof item === 'string' ? item : item.displayText;
                    searchText = typeof item === 'string' ? item : item.displayText;
                    hint = typeof item === 'object' ? item.hint : null;
                }
                
                // Skip audio groups in autocompletion
                if (typeof text === 'string' && text.startsWith('audiogroup_')) continue;
                
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
                            element.dataset.type = data.type; // Add data attribute for CSS styling

                            // Set tooltip for functions and snippets
                            if (hint) {
                                element.title = hint;
                            }
                        }
                    };

                    // For functions, add a custom completion handler
                    if (itemType === 'function') {
                        completion.text = text + "()";
                        completion.callback = function(cm) {
                            const pos = cm.getCursor();
                            cm.setCursor({line: pos.line, ch: pos.ch - 1});
                        };
                    }

                    // For snippets, add custom handler
                    if (itemType === 'snippet') {
                        completion.callback = function(cm) {
                            // Get indentation of current line
                            const currentLine = cm.getLine(cursor.line);
                            const indentation = currentLine.match(/^\s*/)[0];
                            
                            // Indent the snippet code
                            const indentedCode = text
                                .split('\n')
                                .map((line, i) => i === 0 ? line : indentation + line)
                                .join('\n');
                            
                            // Replace the current line with the indented snippet
                            const from = {line: cursor.line, ch: 0};
                            const to = {line: cursor.line, ch: currentLine.length};
                            cm.replaceRange(indentedCode, from, to);
                            
                            // Place cursor after the snippet
                            const newLines = indentedCode.split('\n').length - 1;
                            cm.setCursor({line: cursor.line + newLines, ch: indentation.length});
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

        // Add local scope completions
        if (objectLocalScope.size > 0) {
            addCompletions(Array.from(objectLocalScope), 'local');
        }

        // Add global scope completions
        if (globalEnums) {
            addCompletions(Array.from(globalEnums), 'enum');
        }
        if (globalMacros) {
            addCompletions(Array.from(globalMacros), 'macro');
        }
        if (globalFunctions) {
            addCompletions(Array.from(globalFunctions), 'global-function');
        }

        // Add code snippets
        addCompletions(codeSnippets, 'snippet');

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
                    parenDepth: 0,  // Track nested parentheses
                    operatorExpected: false, // Track if we expect an operator
                    inComment: false, // Track if we're in a single-line comment
                    inBlockComment: false // Track if we're in a block comment
                };
            },
            token: function(stream, state) {
                // Handle comments first
                if (!state.inString) {
                    // Check for region directives
                    if (stream.match('#region') || stream.match('#endregion')) {
                        stream.skipToEnd();
                        return 'comment';
                    }
                    
                    // Check for single-line comments
                    if (stream.match('//')) {
                        state.inComment = true;
                        stream.skipToEnd();
                        return 'comment';
                    }
                    
                    // Check for block comments
                    if (stream.match('/*')) {
                        state.inBlockComment = true;
                        return 'comment';
                    }
                    
                    if (state.inBlockComment) {
                        if (stream.match('*/')) {
                            state.inBlockComment = false;
                            return 'comment';
                        }
                        stream.next();
                        return 'comment';
                    }
                }

                // Reset comment state at the start of each line
                if (stream.sol()) {
                    state.inComment = false;
                }

                // Skip processing if in comment
                if (state.inComment || state.inBlockComment) {
                    stream.next();
                    return 'comment';
                }

                // Check for strings to avoid matching keywords inside strings
                if (!state.inString) {
                    if (stream.peek() === '"' || stream.peek() === "'") {
                        state.inString = !state.inString;
                    }
                }

                // Handle function calls and their parentheses
                if (state.isFunction && stream.peek() === '(') {
                    state.parenDepth++;
                    stream.next();
                    state.operatorExpected = false;
                    return 'bracket function-bracket';
                }

                // Handle closing parentheses for functions
                if (state.parenDepth > 0 && stream.peek() === ')') {
                    state.parenDepth--;
                    stream.next();
                    if (state.parenDepth === 0) {
                        state.isFunction = false;
                    }
                    state.operatorExpected = true;
                    return 'bracket function-bracket';
                }

                // Reset function state when not followed by parenthesis
                if (state.isFunction && stream.peek() !== '(' && state.parenDepth === 0) {
                    state.isFunction = false;
                }

                // Check for GameMaker specific tokens
                if (!state.inString) {
                    const ch = stream.peek();
                    
                    // Handle operators
                    if (/[+\-*/%=<>!&|^~]/.test(ch)) {
                        stream.next();
                        state.operatorExpected = false;
                        return 'operator';
                    }
                    
                    if (/[a-zA-Z_]/.test(ch)) {
                        const word = stream.match(/[a-zA-Z_]\w*/)[0];
                        
                        // Check each type of token
                        if (builtinSet.has(word)) {
                            state.operatorExpected = true;
                            state.lastToken = 'builtin';
                            return 'builtin';
                        }
                        if (atomSet.has(word) || globalEnums.has(word) || globalMacros.has(word) || 
                            isAssetReference(word) || isAudioGroup(word)) {
                            state.operatorExpected = true;
                            state.lastToken = 'atom';
                            return 'atom';
                        }
                        if (keywordSet.has(word)) {
                            state.operatorExpected = false;
                            state.lastToken = 'keyword';
                            return 'keyword';
                        }
                        if (functionSet.has(word) || globalFunctions.has(word)) {
                            state.lastToken = 'function';
                            state.isFunction = true;
                            state.operatorExpected = false;
                            return 'function';
                        }

                        // Let JavaScript mode handle other cases
                        stream.backUp(word.length);
                    }

                    // Handle numbers
                    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(stream.peek()))) {
                        stream.match(/\d*\.?\d*/);
                        state.operatorExpected = true;
                        return 'number';
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

        // Use the dynamically loaded sets
        const keywords = typeof keywordSet !== 'undefined' ? keywordSet : new Set();
        const builtinFunctions = typeof functionSet !== 'undefined' ? functionSet : new Set();
        const builtinAtoms = typeof atomSet !== 'undefined' ? atomSet : new Set();
        const builtinConstants = new Set([
            ...builtinSet, // Built-in variables
            'global',  // Add global as a builtin constant
            'self',    // Add self as a builtin constant
            'other',   // Add other as a builtin constant
            'all'      // Add all as a builtin constant
        ]);

        // Track local scope for this file
        const localScope = new Set();
        let inBlockComment = false;
        let braceLevel = 0;
        let inStructDeclaration = false;
        let structBraceStart = -1;
        let inTryCatch = false;
        let catchVariable = null;
        let inFunctionDecl = false;
        let currentFunction = null;
        let inConstructor = false;
        let inEnum = false;
        let inWith = false;
        let withDepth = 0;
        let structProperties = new Set(); // Track struct properties
        let inObjectLiteral = false; // Track if we're in any object/struct literal
        let objectLiteralBraceLevel = 0; // Track brace level for object literals
        let currentLine = ''; // Store current line for context

        // First pass: collect all declarations
        lines.forEach((line, lineIndex) => {
            currentLine = line; // Store current line
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

            // Track brace levels
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            braceLevel += openBraces - closeBraces;

            // Handle function declarations and their parameters
            const functionMatch = line.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)/);
            if (functionMatch) {
                currentFunction = functionMatch[1];
                objectLocalScope.add(currentFunction);
                
                // Add function parameters to object scope
                if (functionMatch[2]) {
                    const params = functionMatch[2].split(',').map(p => p.trim());
                    params.forEach(param => {
                        if (param) objectLocalScope.add(param);
                    });
                }
            }

            // Handle method declarations in object literals and class definitions
            const methodMatch = line.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*function\s*\((.*?)\)|([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)\s*{/);
            if (methodMatch) {
                const params = methodMatch[2] || methodMatch[4];
                if (params) {
                    const paramList = params.split(',').map(p => p.trim());
                    paramList.forEach(param => {
                        if (param) objectLocalScope.add(param);
                    });
                }
            }

            // Check for object literal starts (including function arguments)
            const objectLiteralStarts = [
                /=\s*{/,                    // Assignment
                /\(\s*{/,                   // Function argument
                /,\s*{/,                    // Array/argument separator
                /return\s+{/,               // Return statement
                /:\s*{/,                    // Property value
                /\[\s*{/,                   // Array element
                /new\s+\w+\s*\(\s*[^{]*{/   // Constructor argument
            ];

            for (const pattern of objectLiteralStarts) {
                if (pattern.test(line) && !isStringContext(line, line.indexOf('{'))) {
                    inObjectLiteral = true;
                    objectLiteralBraceLevel = braceLevel;
                    break;
                }
            }

            // Handle struct/object property declarations
            if (inObjectLiteral) {
                // Match property declarations in various formats, including inline and nested
                const propertyMatches = line.matchAll(/(?:^|[{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g);
                for (const match of propertyMatches) {
                    const propName = match[1].trim();
                    structProperties.add(propName);
                    objectLocalScope.add(propName);
                }

                // Check if we're exiting the object literal
                if (braceLevel < objectLiteralBraceLevel) {
                    inObjectLiteral = false;
                }
            }

            // Handle try-catch blocks
            if (line.includes('try') && line.includes('{')) {
                inTryCatch = true;
            }
            const catchMatch = line.match(/catch\s*\((\w+)\)/);
            if (catchMatch) {
                catchVariable = catchMatch[1];
                objectLocalScope.add(catchVariable);
            }
            if (inTryCatch && braceLevel === 0) {
                inTryCatch = false;
                catchVariable = null;
            }

            // Handle constructor parameters
            const constructorMatch = line.match(/constructor\s*\((.*?)\)/);
            if (constructorMatch) {
                inConstructor = true;
                if (constructorMatch[1]) {
                    const params = constructorMatch[1].split(',').map(p => p.trim());
                    params.forEach(param => {
                        if (param) localScope.add(param);
                    });
                }
            }

            // Handle array declarations
            const arrayDeclMatch = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\[[^\]]+\]\s*=(?!=)/);
            if (arrayDeclMatch) {
                localScope.add(arrayDeclMatch[1]);
            }

            // Handle for loop variables
            const forLoopMatch = line.match(/for\s*\(\s*(?:var\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|in|of)/);
            if (forLoopMatch) {
                localScope.add(forLoopMatch[1]);
            }

            // Handle implicit declarations through assignment
            if (!inStructDeclaration && !inEnum) {
                const assignMatches = line.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)/g);
                for (const match of assignMatches) {
                    const varName = match[1];
                    const beforeAssign = line.substring(0, match.index).trim();
                    
                    if (!beforeAssign.endsWith('=') && 
                        !beforeAssign.endsWith('<') && 
                        !beforeAssign.endsWith('>') && 
                        !beforeAssign.includes('if') && 
                        !beforeAssign.includes('while') && 
                        !beforeAssign.includes('for') && 
                        !beforeAssign.includes('return') && 
                        !beforeAssign.includes('?') && 
                        !beforeAssign.includes(':') && 
                        !line.includes('=>')) {
                        localScope.add(varName);
                    }
                }
            }
        });

        // Reset states for second pass
        inBlockComment = false;
        braceLevel = 0;
        inStructDeclaration = false;
        inTryCatch = false;
        catchVariable = null;
        inFunctionDecl = false;
        currentFunction = null;
        inConstructor = false;
        inEnum = false;
        inWith = false;
        withDepth = 0;
        inObjectLiteral = false;
        objectLiteralBraceLevel = 0;
        currentLine = '';

        // Second pass: check for undefined variables
        lines.forEach((line, lineIndex) => {
            currentLine = line; // Store current line
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (trimmedLine === '' || trimmedLine.startsWith('//')) return;

            // Handle block comments and region directives
            if (trimmedLine.startsWith('#region') || trimmedLine.startsWith('#endregion')) return;
            if (trimmedLine.includes('/*')) inBlockComment = true;
            if (trimmedLine.includes('*/')) {
                inBlockComment = false;
                return;
            }
            if (inBlockComment) return;

            // Track brace levels
            braceLevel += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

            // Check for object literal starts (including function arguments)
            const objectLiteralStarts = [
                /=\s*{/,                    // Assignment
                /\(\s*{/,                   // Function argument
                /,\s*{/,                    // Array/argument separator
                /return\s+{/,               // Return statement
                /:\s*{/,                    // Property value
                /\[\s*{/,                   // Array element
                /new\s+\w+\s*\(\s*[^{]*{/   // Constructor argument
            ];

            for (const pattern of objectLiteralStarts) {
                if (pattern.test(line) && !isStringContext(line, line.indexOf('{'))) {
                    inObjectLiteral = true;
                    objectLiteralBraceLevel = braceLevel;
                    break;
                }
            }

            // Check for undefined variables with improved context awareness
            const identifiers = line.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);
            if (identifiers) {
                identifiers.forEach(id => {
                    // Skip if it's a region directive
                    if (line.trim().startsWith('#region') || line.trim().startsWith('#endregion')) return;
                    
                    const idIndex = line.indexOf(id);

                    // Skip if in comment or string
                    if (isCommentContext(line, idIndex) || isStringContext(line, idIndex)) return;

                    // Skip if it's a dot accessor
                    const beforeId = line.substring(0, idIndex).trim();
                    const afterId = line.substring(idIndex + id.length);
                    if (beforeId.endsWith('.') || afterId.trim().startsWith('.')) return;

                    // Skip if it's a global variable access
                    if (beforeId.endsWith('global.')) return;
                    
                    // Get the full identifier
                    const fullId = getWordAtPosition(line, idIndex).word;

                    // Skip if it's a property name in an object literal
                    if (afterId.trim().startsWith(':')) {
                        const beforeColon = line.substring(0, idIndex + fullId.length).trim();
                        // More lenient check for property declarations
                        if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*$/.test(beforeColon)) {
                            structProperties.add(fullId);
                            objectLocalScope.add(fullId);
                            return;
                        }
                    }

                    // Skip if it's in any of our known scopes
                    if (localScope.has(fullId) || 
                        objectLocalScope.has(fullId) || 
                        builtinFunctions.has(fullId) || 
                        builtinConstants.has(fullId) || 
                        builtinAtoms.has(fullId) || 
                        keywords.has(fullId) || 
                        eventConstants.has(fullId) || 
                        globalFunctions.has(fullId) || 
                        globalEnums.has(fullId) || 
                        globalMacros.has(fullId) || 
                        isAssetReference(fullId) || 
                        isAudioGroup(fullId) ||
                        structProperties.has(fullId)) return;

                    // Add warning for undefined variable
                        found.push({
                            from: CodeMirror.Pos(lineIndex, idIndex),
                            to: CodeMirror.Pos(lineIndex, idIndex + fullId.length),
                            message: `Variable '${fullId}' is used but not declared`,
                            severity: "warning"
                        });
                });
            }

            // ... rest of the existing linting checks ...
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
        .cm-s-ambiance .cm-operator { color: #C0C0C0 !important; }
        .cm-s-ambiance .cm-number { color: #FF8080 !important; }
        .cm-s-ambiance .cm-variable-2 { color: #FFF899 !important; }
        
        /* Comment styling */
        .cm-s-ambiance .cm-comment {
            color: #5B995B !important;
            font-style: italic;
        }
        
        /* Ensure operators maintain their color in all contexts */
        .cm-s-ambiance span.cm-operator {
            color: #C0C0C0 !important;
        }
        
        /* Ensure numbers maintain their color in all contexts */
        .cm-s-ambiance span.cm-number {
            color: #FF8080 !important;
        }
        
        /* Ensure expressions maintain proper coloring */
        .cm-s-ambiance .cm-variable + .cm-operator,
        .cm-s-ambiance .cm-number + .cm-operator,
        .cm-s-ambiance .cm-atom + .cm-operator {
            color: #C0C0C0 !important;
        }
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
            },
            // Search & Replace bindings
            "Ctrl-F": () => showSearchPanel(false),
            "Ctrl-H": () => showSearchPanel(true),
            "Ctrl-G": () => jumpToMatch(searchState.currentIndex + 1),
            "Shift-Ctrl-G": () => jumpToMatch(searchState.currentIndex - 1),
            "Esc": hideSearchPanel
        }
    });

    // Initialize search panel functionality
    const searchPanel = document.getElementById('search-panel');
    const searchInput = document.getElementById('search-input');
    const replaceInput = document.getElementById('replace-input');
    const caseSensitive = document.getElementById('case-sensitive');
    const wholeWord = document.getElementById('whole-word');
    const useRegex = document.getElementById('use-regex');
    const preserveCase = document.getElementById('preserve-case');

    // Show search panel
    function showSearchPanel(replace = false) {
        searchPanel.classList.remove('hidden');
        if (replace) {
            searchPanel.classList.add('show-replace');
        } else {
            searchPanel.classList.remove('show-replace');
        }
        searchInput.focus();
        searchInput.select();
        
        // Initialize search if there's selected text
        const selection = editor.getSelection();
        if (selection) {
            searchInput.value = selection;
            searchState.query = selection;
            updateSearchMatches();
        }
    }

    // Hide search panel
    function hideSearchPanel() {
        searchPanel.classList.add('hidden');
        searchPanel.classList.remove('show-replace');
        editor.focus();
        
        // Clear search
        if (searchState.overlay) {
            editor.removeOverlay(searchState.overlay);
        }
        editor.getAllMarks().forEach(mark => mark.clear());
    }

    // Event listeners
    searchInput.addEventListener('input', () => {
        searchState.query = searchInput.value;
        searchState.currentIndex = -1;
        updateSearchMatches();
        if (searchState.matches.length > 0) {
            jumpToMatch(0);
        }
    });

    replaceInput.addEventListener('input', () => {
        searchState.replace = replaceInput.value;
    });

    document.getElementById('prev-match').addEventListener('click', () => {
        jumpToMatch(searchState.currentIndex - 1);
    });

    document.getElementById('next-match').addEventListener('click', () => {
        jumpToMatch(searchState.currentIndex + 1);
    });

    document.getElementById('close-search').addEventListener('click', hideSearchPanel);

    document.getElementById('replace').addEventListener('click', () => {
        performReplace(false);
    });

    document.getElementById('replace-all').addEventListener('click', () => {
        performReplace(true);
    });

    // Search options
    caseSensitive.addEventListener('change', () => {
        searchState.caseSensitive = caseSensitive.checked;
        updateSearchMatches();
    });

    wholeWord.addEventListener('change', () => {
        searchState.wholeWord = wholeWord.checked;
        updateSearchMatches();
    });

    useRegex.addEventListener('change', () => {
        searchState.useRegex = useRegex.checked;
        updateSearchMatches();
    });

    preserveCase.addEventListener('change', () => {
        searchState.preserveCase = preserveCase.checked;
    });

    // Handle keyboard shortcuts in search panel
    searchPanel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                jumpToMatch(searchState.currentIndex - 1);
            } else {
                jumpToMatch(searchState.currentIndex + 1);
            }
            e.preventDefault();
        } else if (e.key === 'Escape') {
            hideSearchPanel();
            e.preventDefault();
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

    // Add middle click navigation
    editor.on('mousedown', async (cm, e) => {
        if (e.button === 1) { // Middle click
            e.preventDefault(); // Prevent default middle-click behavior
            
            // Get the token at the click position
            const pos = cm.coordsChar({ left: e.clientX, top: e.clientY });
            const token = cm.getTokenAt(pos);
            
            // Only navigate for functions, enums, and macros
            if (token.type && (
                token.type.includes('function') ||
                token.string in globalFunctions ||
                globalEnums.has(token.string) ||
                globalMacros.has(token.string)
            )) {
                const identifier = token.string;
                const declaration = await findDeclarationInProject(identifier);
                
                if (declaration) {
                    // If declaration is in a different file, load it
                    if (declaration.file !== editor.filePath) {
                        const content = await loadScriptContent(declaration.file);
                        editor.setValue(content || '');
                        editor.filePath = declaration.file;
                        editor.refresh();
                        // Extract just the filename from the path
                        const fileName = declaration.file.split(/[\/\\]/).pop();
                        updateEditorHeader(`Editor - ${fileName}`);
                    }
                    
                    // Jump to the declaration line
                    const line = declaration.line;
                    editor.setCursor(line, 0);
                    editor.scrollIntoView({ line: Math.max(0, line - 5), ch: 0 }, 100);
                    
                    // Highlight the line briefly
                    const marker = editor.markText(
                        { line, ch: 0 },
                        { line: line + 1, ch: 0 },
                        { className: 'declaration-highlight' }
                    );
                    setTimeout(() => marker.clear(), 2000);
                    
                    showNotification(`Jumped to ${declaration.type} declaration`, 'info');
                }
            }
        }
    });

    // Add hover effect for clickable identifiers
    editor.on('mousemove', (cm, e) => {
        const pos = cm.coordsChar({ left: e.clientX, top: e.clientY });
        const token = cm.getTokenAt(pos);
        
        // Only show pointer for functions, enums, and macros
        if (token.type && (
            token.type.includes('function') ||
            token.string in globalFunctions ||
            globalEnums.has(token.string) ||
            globalMacros.has(token.string)
        )) {
            cm.getWrapperElement().style.cursor = 'pointer';
        } else {
            cm.getWrapperElement().style.cursor = '';
        }
    });
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
    // Remove debug log
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

// Search state
let searchState = {
    query: '',
    replace: '',
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    preserveCase: false,
    currentIndex: -1,
    matches: [],
    overlay: null
};

// Function to update search matches
function updateSearchMatches() {
    const content = editor.getValue();
    const query = searchState.query;
    searchState.matches = [];
    
    if (!query) {
        updateSearchCount();
        return;
    }

    let flags = searchState.caseSensitive ? 'g' : 'gi';
    let searchQuery = query;
    
    if (!searchState.useRegex) {
        searchQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    if (searchState.wholeWord) {
        searchQuery = `\\b${searchQuery}\\b`;
    }

    try {
        const regex = new RegExp(searchQuery, flags);
        let match;
        let lineIndex = 0;
        let lastIndex = 0;

        content.split('\n').forEach((line, lineNum) => {
            while ((match = regex.exec(line)) !== null) {
                searchState.matches.push({
                    from: { line: lineNum, ch: match.index },
                    to: { line: lineNum, ch: match.index + match[0].length },
                    match: match[0]
                });
            }
        });

        // Update search count
        updateSearchCount();
        
        // Update overlay
        if (searchState.overlay) {
            editor.removeOverlay(searchState.overlay);
        }
        
        searchState.overlay = {
            token: function(stream) {
                if (stream.match(regex)) {
                    return 'searching';
                }
                stream.next();
                stream.skipTo(query[0]) || stream.skipToEnd();
            }
        };
        
        editor.addOverlay(searchState.overlay);
    } catch (e) {
        console.error('Invalid regex:', e);
    }
}

// Function to update search count display
function updateSearchCount() {
    const countEl = document.querySelector('.search-count');
    if (searchState.matches.length > 0) {
        const current = searchState.currentIndex + 1;
        countEl.textContent = `${current} of ${searchState.matches.length}`;
    } else {
        countEl.textContent = searchState.query ? 'No results' : '';
    }
}

// Function to jump to match
function jumpToMatch(index) {
    if (searchState.matches.length === 0) return;
    
    // Wrap around
    if (index >= searchState.matches.length) index = 0;
    if (index < 0) index = searchState.matches.length - 1;
    
    searchState.currentIndex = index;
    const match = searchState.matches[index];
    
    // Remove current match highlight
    editor.getAllMarks().forEach(mark => {
        if (mark.className === 'cm-searching cm-current') {
            mark.clear();
        }
    });
    
    // Add new current match highlight
    editor.markText(match.from, match.to, {
        className: 'cm-searching cm-current'
    });
    
    // Scroll to match
    editor.scrollIntoView(match.from, 50);
    
    updateSearchCount();
}

// Function to perform replace
function performReplace(all = false) {
    if (!searchState.query) return;
    
    let replacement = searchState.replace;
    if (!searchState.useRegex && searchState.preserveCase) {
        // Preserve case function
        replacement = (match) => {
            if (match === match.toLowerCase()) return searchState.replace.toLowerCase();
            if (match === match.toUpperCase()) return searchState.replace.toUpperCase();
            if (match[0] === match[0].toUpperCase()) {
                return searchState.replace.charAt(0).toUpperCase() + 
                       searchState.replace.slice(1).toLowerCase();
            }
            return searchState.replace;
        };
    }

    if (all) {
        // Replace all matches
        let flags = searchState.caseSensitive ? 'g' : 'gi';
        let searchQuery = searchState.useRegex ? searchState.query : 
            searchState.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        if (searchState.wholeWord) {
            searchQuery = `\\b${searchQuery}\\b`;
        }

        try {
            const regex = new RegExp(searchQuery, flags);
            const content = editor.getValue();
            const newContent = content.replace(regex, replacement);
            editor.setValue(newContent);
        } catch (e) {
            console.error('Invalid regex:', e);
        }
    } else {
        // Replace current match
        if (searchState.currentIndex >= 0 && searchState.currentIndex < searchState.matches.length) {
            const match = searchState.matches[searchState.currentIndex];
            editor.replaceRange(
                typeof replacement === 'function' ? 
                    replacement(match.match) : replacement,
                match.from,
                match.to
            );
            updateSearchMatches();
            jumpToMatch(searchState.currentIndex);
        }
    }
}

// Declaration navigation functions
async function findDeclarationInFile(identifier, content) {
    const lines = content.split('\n');
    
    // Look for different types of declarations
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;
        
        // Check for function declarations
        const funcMatch = line.match(new RegExp(`function\\s+${identifier}\\s*\\(`));
        if (funcMatch) {
            return { line: i, file: editor.filePath, type: 'function' };
        }
        
        // Check for enum declarations
        const enumMatch = line.match(new RegExp(`enum\\s+${identifier}\\s*\\{`));
        if (enumMatch) {
            return { line: i, file: editor.filePath, type: 'enum' };
        }
        
        // Check for enum member declarations
        if (line.includes(identifier) && line.trim().startsWith(identifier) && line.includes(',')) {
            // Look backwards for the enum declaration
            for (let j = i; j >= 0; j--) {
                if (lines[j].includes('enum')) {
                    return { line: i, file: editor.filePath, type: 'enum-member' };
                }
            }
        }
        
        // Check for macro declarations
        const macroMatch = line.match(new RegExp(`#macro\\s+${identifier}\\b`));
        if (macroMatch) {
            return { line: i, file: editor.filePath, type: 'macro' };
        }
    }
    
    return null;
}

async function findDeclarationInProject(identifier) {
    try {
        // First check current file
        if (editor.filePath) {
            const content = editor.getValue();
            const result = await findDeclarationInFile(identifier, content);
            if (result) return result;
        }
        
        // Then check all project files
        const scripts = await window.api.invoke('get-all-scripts');
        for (const script of scripts) {
            if (script === editor.filePath) continue; // Skip current file
            
            const content = await window.api.invoke('read-script-content', script);
            const result = await findDeclarationInFile(identifier, content);
            if (result) {
                result.file = script;
                return result;
            }
        }
    } catch (error) {
        console.error('Error finding declaration:', error);
    }
    
    return null;
}