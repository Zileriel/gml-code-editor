import gmlDefinitionsParser from './gmlDefinitionsParser.js';

class GMLCompletionProvider {
	constructor() {
		this.completionItems = [];
		this.assetCompletions = [];
		this.userSymbolCompletions = [];
	}

	async initialize() {
		await gmlDefinitionsParser.loadDefinitions();
		this.buildCompletionItems();
	}

	buildCompletionItems() {
		const builtinItems = gmlDefinitionsParser
			.getAllCompletionItems()
			.map((item) => {
				const monacoKind = this.getMonacoCompletionKind(item.type);

				let insertText = item.insertText;
				let insertTextRules =
					window.monaco?.languages?.CompletionItemInsertTextRule?.None || 0;

				if (item.type === 'function') {
					const func = gmlDefinitionsParser.getFunction(item.label);
					if (func && func.parameters && func.parameters.length > 0) {
						const requiredParams = func.parameters.filter(
							(param) => !param.optional
						);
						if (requiredParams.length > 0) {
							const params = requiredParams
								.map((param, index) => `\${${index + 1}:${param.name}}`)
								.join(', ');
							insertText = `${item.label}(${params})`;
							insertTextRules =
								window.monaco?.languages?.CompletionItemInsertTextRule
									?.InsertAsSnippet || 0;
						} else {
							insertText = `${item.label}()`;
						}
					} else {
						insertText = `${item.label}()`;
					}
				}

				return {
					label: item.label,
					kind: monacoKind,
					detail: item.detail,
					documentation: {
						value: item.documentation,
						isTrusted: true,
					},
					insertText: insertText,
					insertTextRules: insertTextRules,
					sortText: this.getSortText(item.type, item.label),
				};
			});

		const codeSnippets = this.getCodeSnippets();

		this.completionItems = [...builtinItems, ...codeSnippets];
	}

	getCodeSnippets() {
		const monaco = window.monaco;
		const snippetKind = monaco?.languages?.CompletionItemKind?.Snippet || 15;
		const insertAsSnippet =
			monaco?.languages?.CompletionItemInsertTextRule?.InsertAsSnippet || 4;

		return [
			// Control Flow Snippets
			{
				label: 'for',
				kind: snippetKind,
				detail: 'for loop',
				documentation: {
					value:
						'Creates a for loop with initialization, condition, and increment',
					isTrusted: true,
				},
				insertText:
					'for (${1:var i = 0}; ${2:i < 10}; ${3:i++}) {\n\t${4:// code here}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0for',
			},
			{
				label: 'while',
				kind: snippetKind,
				detail: 'while loop',
				documentation: {
					value: 'Creates a while loop with condition',
					isTrusted: true,
				},
				insertText: 'while (${1:condition}) {\n\t${2:// code here}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0while',
			},
			{
				label: 'repeat',
				kind: snippetKind,
				detail: 'repeat loop',
				documentation: {
					value: 'Creates a repeat loop with count',
					isTrusted: true,
				},
				insertText: 'repeat (${1:count}) {\n\t${2:// code here}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0repeat',
			},
			{
				label: 'do',
				kind: snippetKind,
				detail: 'do...until loop',
				documentation: {
					value: 'Creates a do...until loop',
					isTrusted: true,
				},
				insertText: 'do {\n\t${1:// code here}\n} until (${2:condition});',
				insertTextRules: insertAsSnippet,
				sortText: '0do',
			},
			{
				label: 'with',
				kind: snippetKind,
				detail: 'with statement',
				documentation: {
					value: 'Creates a with statement for object context',
					isTrusted: true,
				},
				insertText: 'with (${1:object}) {\n\t${2:// code here}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0with',
			},
			{
				label: 'if',
				kind: snippetKind,
				detail: 'if statement',
				documentation: {
					value: 'Creates an if statement',
					isTrusted: true,
				},
				insertText: 'if (${1:condition}) {\n\t${2:// code here}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0if',
			},
			{
				label: 'ifelse',
				kind: snippetKind,
				detail: 'if...else statement',
				documentation: {
					value: 'Creates an if...else statement',
					isTrusted: true,
				},
				insertText:
					'if (${1:condition}) {\n\t${2:// if true}\n} else {\n\t${3:// if false}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0ifelse',
			},
			{
				label: 'switch',
				kind: snippetKind,
				detail: 'switch statement',
				documentation: {
					value: 'Creates a switch statement with cases',
					isTrusted: true,
				},
				insertText:
					'switch (${1:variable}) {\n\tcase ${2:value1}:\n\t\t${3:// code}\n\t\tbreak;\n\tdefault:\n\t\t${4:// default code}\n\t\tbreak;\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0switch',
			},
			{
				label: 'trycatch',
				kind: snippetKind,
				detail: 'try...catch statement',
				documentation: {
					value: 'Creates a try...catch statement for error handling',
					isTrusted: true,
				},
				insertText:
					'try {\n\t${1:// code here}\n} catch (${2:error}) {\n\t${3:// error handling}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0trycatch',
			},

			// Declaration Snippets
			{
				label: 'function',
				kind: snippetKind,
				detail: 'function declaration',
				documentation: {
					value: 'Creates a function declaration',
					isTrusted: true,
				},
				insertText:
					'function ${1:functionName}(${2:parameters}) {\n\t${3:// code here}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0function',
			},
			{
				label: 'enum',
				kind: snippetKind,
				detail: 'enum declaration',
				documentation: {
					value: 'Creates an enumeration',
					isTrusted: true,
				},
				insertText: 'enum ${1:Name} {\n\t${2:VALUE1},\n\t${3:VALUE2}\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0enum',
			},
			{
				label: 'macro',
				kind: snippetKind,
				detail: 'macro definition',
				documentation: {
					value: 'Creates a macro definition',
					isTrusted: true,
				},
				insertText: '#macro ${1:NAME} ${2:value}',
				insertTextRules: insertAsSnippet,
				sortText: '0macro',
			},

			// GameMaker Specific Snippets
			{
				label: 'icl',
				kind: snippetKind,
				detail: 'instance_create_layer',
				documentation: {
					value: 'Creates an instance at a specific layer',
					isTrusted: true,
				},
				insertText:
					'instance_create_layer(${1:x}, ${2:y}, ${3:layer}, ${4:object});',
				insertTextRules: insertAsSnippet,
				sortText: '0icl',
			},
			{
				label: 'icd',
				kind: snippetKind,
				detail: 'instance_create_depth',
				documentation: {
					value: 'Creates an instance at a specific depth',
					isTrusted: true,
				},
				insertText:
					'instance_create_depth(${1:x}, ${2:y}, ${3:depth}, ${4:object});',
				insertTextRules: insertAsSnippet,
				sortText: '0icd',
			},
			{
				label: 'id',
				kind: snippetKind,
				detail: 'instance_destroy',
				documentation: {
					value: 'Destroys an instance',
					isTrusted: true,
				},
				insertText: 'instance_destroy();',
				insertTextRules: insertAsSnippet,
				sortText: '0id',
			},
			{
				label: 'cl',
				kind: snippetKind,
				detail: 'show_debug_message',
				documentation: {
					value: 'Console log / debug message',
					isTrusted: true,
				},
				insertText: 'show_debug_message(${1:message});',
				insertTextRules: insertAsSnippet,
				sortText: '0cl',
			},
			{
				label: 'log',
				kind: snippetKind,
				detail: 'show_debug_message',
				documentation: {
					value: 'Console log / debug message',
					isTrusted: true,
				},
				insertText: 'show_debug_message(${1:message});',
				insertTextRules: insertAsSnippet,
				sortText: '0log',
			},

			// Comment Snippets
			{
				label: 'todo',
				kind: snippetKind,
				detail: 'TODO comment',
				documentation: {
					value: 'Creates a TODO comment',
					isTrusted: true,
				},
				insertText: '// TODO: ${1:description}',
				insertTextRules: insertAsSnippet,
				sortText: '0todo',
			},
			{
				label: 'note',
				kind: snippetKind,
				detail: 'NOTE comment',
				documentation: {
					value: 'Creates a NOTE comment',
					isTrusted: true,
				},
				insertText: '// NOTE: ${1:description}',
				insertTextRules: insertAsSnippet,
				sortText: '0note',
			},
			{
				label: 'jsdoc',
				kind: snippetKind,
				detail: 'JSDoc comment',
				documentation: {
					value: 'Creates a JSDoc style comment block',
					isTrusted: true,
				},
				insertText:
					'/**\n * ${1:Description}\n * @param {${2:type}} ${3:name} - ${4:Description}\n */',
				insertTextRules: insertAsSnippet,
				sortText: '0jsdoc',
			},
			{
				label: 'lorem',
				kind: snippetKind,
				detail: 'Lorem Ipsum text (10 words)',
				documentation: {
					value: 'Generates 10 words of Lorem Ipsum placeholder text',
					isTrusted: true,
				},
				insertText:
					'"Lorem ipsum dolor sit amet consectetur adipiscing elit sed do."',
				insertTextRules: insertAsSnippet,
				sortText: '0lorem',
			},
		];
	}

	/**
	 * Dynamic snippets that work like Emmet abbreviations
	 * These are context-aware and use the variable before the dot
	 */
	getDynamicSnippets() {
		return {
			// Array methods
			shuffle: {
				expand: '$VAR',
				template: 'array_shuffle($VAR)',
				description: 'Shuffle array elements randomly',
			},
			length: {
				expand: '$VAR',
				template: 'array_length($VAR)',
				description: 'Get array/string length',
			},
			copy: {
				expand: '$VAR',
				template: 'array_copy($VAR)',
				description: 'Copy array',
			},
			push: {
				expand: '$VAR',
				template: 'array_push($VAR, value)',
				description: 'Add element to end of array',
			},
			pop: {
				expand: '$VAR',
				template: 'array_pop($VAR)',
				description: 'Remove and return last element',
			},
			insert: {
				expand: '$VAR',
				template: 'array_insert($VAR, index, value)',
				description: 'Insert element at index',
			},
			delete: {
				expand: '$VAR',
				template: 'array_delete($VAR, index)',
				description: 'Delete element at index',
			},
			find: {
				expand: '$VAR',
				template: 'array_index_of($VAR, value)',
				description: 'Find index of value in array',
			},
			resize: {
				expand: '$VAR',
				template: 'array_resize($VAR, size)',
				description: 'Resize array to specified size',
			},
			sort: {
				expand: '$VAR',
				template: 'array_sort($VAR, ascending)',
				description: 'Sort array elements',
			},

			// String methods (reusing 'length' for strings)
			lower: {
				expand: '$VAR',
				template: 'string_lower($VAR)',
				description: 'Convert string to lowercase',
			},
			upper: {
				expand: '$VAR',
				template: 'string_upper($VAR)',
				description: 'Convert string to uppercase',
			},
			pos: {
				expand: '$VAR',
				template: 'string_pos(substr, $VAR)',
				description: 'Find position of substring',
			},
			replace: {
				expand: '$VAR',
				template: 'string_replace_all($VAR, search, replace)',
				description: 'Replace all occurrences in string',
			},
			split: {
				expand: '$VAR',
				template: 'string_split($VAR, delimiter)',
				description: 'Split string by delimiter',
			},

			// Math methods
			ceil: {
				expand: '$VAR',
				template: 'ceil($VAR)',
				description: 'Round up to nearest integer',
			},
			floor: {
				expand: '$VAR',
				template: 'floor($VAR)',
				description: 'Round down to nearest integer',
			},
			round: {
				expand: '$VAR',
				template: 'round($VAR)',
				description: 'Round to nearest integer',
			},
			abs: {
				expand: '$VAR',
				template: 'abs($VAR)',
				description: 'Get absolute value',
			},
			sqrt: {
				expand: '$VAR',
				template: 'sqrt($VAR)',
				description: 'Get square root',
			},
			sin: {
				expand: '$VAR',
				template: 'sin($VAR)',
				description: 'Get sine',
			},
			cos: {
				expand: '$VAR',
				template: 'cos($VAR)',
				description: 'Get cosine',
			},
			tan: {
				expand: '$VAR',
				template: 'tan($VAR)',
				description: 'Get tangent',
			},
			sign: {
				expand: '$VAR',
				template: 'sign($VAR)',
				description: 'Get sign (-1, 0, or 1)',
			},
			clamp: {
				expand: '$VAR',
				template: 'clamp($VAR, min, max)',
				description: 'Clamp value between min and max',
			},

			// Instance methods
			exists: {
				expand: '$VAR',
				template: 'instance_exists($VAR)',
				description: 'Check if instance exists',
			},
			destroy: {
				expand: '$VAR',
				template: 'instance_destroy($VAR)',
				description: 'Destroy instance',
			},
		};
	}

	getMonacoCompletionKind(type) {
		const monaco = window.monaco;
		if (!monaco) return 0;

		switch (type) {
			case 'function':
				return monaco.languages.CompletionItemKind.Function;
			case 'variable':
				return monaco.languages.CompletionItemKind.Variable;
			case 'constant':
				return monaco.languages.CompletionItemKind.Constant;
			case 'snippet':
				return monaco.languages.CompletionItemKind.Snippet;
			case 'color':
				return monaco.languages.CompletionItemKind.Color;
			default:
				return monaco.languages.CompletionItemKind.Text;
		}
	}

	getSortText(type, label) {
		switch (type) {
			case 'local':
				return '0' + label;
			case 'function':
				return '1' + label;
			case 'variable':
				return '2' + label;
			case 'constant':
				return '3' + label;
			default:
				return '9' + label;
		}
	}

	extractLocalVariables(model, position) {
		const variables = new Set();
		const text = model.getValue();

		const currentFunctionMatch = this.findCurrentFunction(
			text,
			model.getOffsetAt(position)
		);
		if (currentFunctionMatch) {
			const params = this.extractFunctionParameters(
				currentFunctionMatch.declaration
			);
			params.forEach((param) => variables.add(param));
		}

		const varMatches = text.matchAll(
			/\b(?:var|globalvar)\s+([a-zA-Z_][\w]*(?:\s*,\s*[a-zA-Z_][\w]*)*)/g
		);
		for (const match of varMatches) {
			const declaredVars = match[1].split(',').map((v) => v.trim());
			declaredVars.forEach((varName) => {
				if (varName && /^[a-zA-Z_][\w]*$/.test(varName)) {
					variables.add(varName);
				}
			});
		}

		const forMatches = text.matchAll(
			/\bfor\s*\(\s*(?:var\s+)?([a-zA-Z_][\w]*)\s*=/g
		);
		for (const match of forMatches) {
			variables.add(match[1]);
		}

		const assignmentMatches = text.matchAll(
			/\b([a-zA-Z_][\w]*)\s*[+\-*/%&|^]?=/g
		);
		for (const match of assignmentMatches) {
			if (!this.isBuiltinIdentifier(match[1])) {
				variables.add(match[1]);
			}
		}

		return Array.from(variables).map((varName) => ({
			label: varName,
			kind: monaco.languages.CompletionItemKind.Variable,
			detail: 'Local Variable',
			documentation: 'User-defined variable in current scope',
			insertText: varName,
			sortText: '0' + varName,
		}));
	}

	/**
	 * Updates the asset completions based on the current project assets
	 * @param {Object} assets - Asset data from the main process containing objects, sprites, sounds, etc.
	 */
	updateAssets(assets) {
		this.assetCompletions = [];

		if (assets) {
			const assetCategories = [
				{ items: assets.objects || [], type: 'Object', detail: 'Game Object' },
				{
					items: (assets.sprites || []).map((sprite) =>
						typeof sprite === 'object' ? sprite.name : sprite
					),
					type: 'Sprite',
					detail: 'Sprite Asset',
				},
				{ items: assets.sounds || [], type: 'Sound', detail: 'Sound Asset' },
				{ items: assets.paths || [], type: 'Path', detail: 'Path Asset' },
				{ items: assets.rooms || [], type: 'Room', detail: 'Room Asset' },
				{
					items: assets.sequences || [],
					type: 'Sequence',
					detail: 'Sequence Asset',
				},
				{ items: assets.shaders || [], type: 'Shader', detail: 'Shader Asset' },
				{
					items: assets.tilesets || [],
					type: 'Tileset',
					detail: 'Tileset Asset',
				},
				{ items: assets.fonts || [], type: 'Font', detail: 'Font Asset' },
				{
					items: assets.timelines || [],
					type: 'Timeline',
					detail: 'Timeline Asset',
				},
			];

			assetCategories.forEach((category) => {
				category.items.forEach((assetName) => {
					if (assetName && typeof assetName === 'string') {
						this.assetCompletions.push({
							label: assetName,
							kind: window.monaco?.languages?.CompletionItemKind?.File || 20,
							detail: category.detail,
							documentation: {
								value: `${category.type} asset: ${assetName}`,
								isTrusted: true,
							},
							insertText: assetName,
							sortText: '1' + assetName,
						});
					}
				});
			});
		}
	}

	updateUserSymbols(definitions) {
		this.userSymbolCompletions = [];

		const macros = Array.isArray(definitions)
			? definitions
			: definitions?.macros || [];
		const enums = Array.isArray(definitions)
			? arguments[1] || []
			: definitions?.enums || [];
		const functions = Array.isArray(definitions)
			? arguments[2] || []
			: definitions?.functions || [];
		const globals = Array.isArray(definitions)
			? arguments[3] || []
			: definitions?.globals || [];
		const globalvars = Array.isArray(definitions)
			? arguments[4] || []
			: definitions?.globalvars || [];

		macros.forEach((macro) => {
			const location = macro.location?.assetName
				? `${macro.location.assetName}${
						macro.location.eventName ? ` (${macro.location.eventName})` : ''
				  }`
				: `${macro.location?.file || 'unknown'}:${macro.location?.line || 0}`;

			this.userSymbolCompletions.push({
				label: macro.name,
				kind: window.monaco?.languages?.CompletionItemKind?.Constant || 21,
				detail: 'Macro',
				documentation: {
					value: `Macro defined in ${location}`,
					isTrusted: true,
				},
				insertText: macro.name,
				sortText: '1' + macro.name,
			});
		});

		enums.forEach((enumSym) => {
			const location = enumSym.location?.assetName
				? `${enumSym.location.assetName}${
						enumSym.location.eventName ? ` (${enumSym.location.eventName})` : ''
				  }`
				: `${enumSym.location?.file || 'unknown'}:${
						enumSym.location?.line || 0
				  }`;

			this.userSymbolCompletions.push({
				label: enumSym.name,
				kind: window.monaco?.languages?.CompletionItemKind?.Enum || 15,
				detail: 'Enum',
				documentation: {
					value: `Enum defined in ${location}`,
					isTrusted: true,
				},
				insertText: enumSym.name,
				sortText: '1' + enumSym.name,
			});
		});

		functions.forEach((func) => {
			const location = func.location?.assetName
				? `${func.location.assetName}${
						func.location.eventName ? ` (${func.location.eventName})` : ''
				  }`
				: `${func.location?.file || 'unknown'}:${func.location?.line || 0}`;

			// Build function signature for completion
			let insertText = func.name;
			let insertTextRules =
				window.monaco?.languages?.CompletionItemInsertTextRule?.None || 0;
			let detail = 'User Function';

			// Enhanced function completion with parameters
			if (func.parameters && func.parameters.length > 0) {
				const requiredParams = func.parameters.filter((p) => !p.optional);
				if (requiredParams.length > 0) {
					const params = requiredParams
						.map((param, index) => `\${${index + 1}:${param.name}}`)
						.join(', ');
					insertText = `${func.name}(${params})`;
					insertTextRules =
						window.monaco?.languages?.CompletionItemInsertTextRule
							?.InsertAsSnippet || 4;
				} else {
					insertText = `${func.name}()`;
				}

				// Create detailed signature for display
				const paramTypes = func.parameters.map(
					(p) => `${p.name}: ${p.type || 'any'}`
				);
				detail = `${func.name}(${paramTypes.join(', ')})`;
				if (func.returnType && func.returnType !== 'any') {
					detail += ` → ${func.returnType}`;
				}
			} else {
				insertText = `${func.name}()`;
			}

			let documentation = `User function defined in ${location}`;
			if (func.description) {
				documentation = `${func.description}\n\nDefined in: ${location}`;
			}
			if (func.parameters && func.parameters.length > 0) {
				const paramDocs = func.parameters
					.map(
						(p) =>
							`• **${p.name}** (${p.type || 'any'}): ${
								p.description || 'No description'
							}`
					)
					.join('\n');
				documentation += `\n\n**Parameters:**\n${paramDocs}`;
			}

			this.userSymbolCompletions.push({
				label: func.name,
				kind: window.monaco?.languages?.CompletionItemKind?.Function || 1,
				detail: detail,
				documentation: {
					value: documentation,
					isTrusted: true,
				},
				insertText: insertText,
				insertTextRules: insertTextRules,
				sortText: '1' + func.name,
			});
		});

		globals.forEach((global) => {
			const location = global.location?.assetName
				? `${global.location.assetName}${
						global.location.eventName ? ` (${global.location.eventName})` : ''
				  }`
				: `${global.location?.file || 'unknown'}:${global.location?.line || 0}`;

			this.userSymbolCompletions.push({
				label: global.name,
				kind: window.monaco?.languages?.CompletionItemKind?.Variable || 4,
				detail: 'Global Variable',
				documentation: {
					value: `Global variable defined in ${location}`,
					isTrusted: true,
				},
				insertText: global.name,
				sortText: '1' + global.name,
			});
		});

		globalvars.forEach((globalvar) => {
			const location = globalvar.location?.assetName
				? `${globalvar.location.assetName}${
						globalvar.location.eventName
							? ` (${globalvar.location.eventName})`
							: ''
				  }`
				: `${globalvar.location?.file || 'unknown'}:${
						globalvar.location?.line || 0
				  }`;

			this.userSymbolCompletions.push({
				label: globalvar.name,
				kind: window.monaco?.languages?.CompletionItemKind?.Variable || 4,
				detail: 'Global Variable',
				documentation: {
					value: `Global variable defined in ${location}`,
					isTrusted: true,
				},
				insertText: globalvar.name,
				sortText: '1' + globalvar.name,
			});
		});
	}

	findCurrentFunction(text, offset) {
		const beforeOffset = text.substring(0, offset);
		const functionMatches = [
			...beforeOffset.matchAll(
				/function\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g
			),
		];

		if (functionMatches.length === 0) return null;

		const lastFunction = functionMatches[functionMatches.length - 1];
		const functionStart = lastFunction.index;

		let braceCount = 1;
		let pos = functionStart + lastFunction[0].length;

		while (pos < text.length && braceCount > 0) {
			const char = text[pos];
			if (char === '{') braceCount++;
			else if (char === '}') braceCount--;
			pos++;
		}

		if (offset < pos) {
			return {
				name: lastFunction[1],
				declaration: lastFunction[0],
				parameters: lastFunction[2],
			};
		}

		return null;
	}

	extractFunctionParameters(declaration) {
		const paramMatch = declaration.match(/\(([^)]*)\)/);
		if (!paramMatch || !paramMatch[1].trim()) return [];

		return paramMatch[1]
			.split(',')
			.map((param) => param.trim())
			.filter((param) => param && /^[a-zA-Z_][\w]*$/.test(param));
	}

	isBuiltinIdentifier(name) {
		return (
			gmlDefinitionsParser.getFunction(name) ||
			gmlDefinitionsParser.getVariable(name) ||
			gmlDefinitionsParser.getConstant(name)
		);
	}

	/**
	 * Parse dynamic snippet chain (e.g., "myArr.shuffle.sort")
	 * @param {string} text - The text to parse
	 * @param {number} offset - Current cursor position
	 * @returns {Object|null} Parsed chain info or null
	 */
	parseDynamicSnippetChain(text, offset) {
		// Look backward from cursor to find the chain
		let chainStart = offset - 1;
		let foundDot = false;

		// Find the start of the chain (variable name)
		while (chainStart >= 0) {
			const char = text[chainStart];
			if (/[a-zA-Z0-9_]/.test(char)) {
				chainStart--;
			} else if (char === '.') {
				foundDot = true;
				chainStart--;
			} else {
				chainStart++;
				break;
			}
		}

		if (chainStart < 0) chainStart = 0;
		if (!foundDot) return null;

		const chainText = text.substring(chainStart, offset);
		const parts = chainText.split('.');

		if (parts.length < 2) return null;

		const variable = parts[0];
		const methods = parts.slice(1);

		// Validate variable name
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) return null;

		return {
			variable,
			methods,
			chainStart,
			chainEnd: offset,
			fullChain: chainText,
		};
	}

	/**
	 * Expand dynamic snippet chain
	 * @param {Object} chain - Parsed chain from parseDynamicSnippetChain
	 * @returns {string} Expanded snippet text
	 */
	expandDynamicSnippetChain(chain) {
		const dynamicSnippets = this.getDynamicSnippets();
		let result = chain.variable;

		// Process methods from left to right, nesting function calls
		for (const method of chain.methods) {
			const snippet = dynamicSnippets[method];
			if (snippet) {
				result = snippet.template.replace(/\$VAR/g, result);
			} else {
				// If method not found, just append it (fallback)
				result = `${result}.${method}`;
			}
		}

		return result;
	}

	/**
	 * Generate Lorem Ipsum text with specified word count
	 * @param {number} wordCount - Number of words to generate
	 * @returns {string} Lorem ipsum text
	 */
	generateLoremIpsum(wordCount) {
		const words = [
			'lorem',
			'ipsum',
			'dolor',
			'sit',
			'amet',
			'consectetur',
			'adipiscing',
			'elit',
			'sed',
			'do',
			'eiusmod',
			'tempor',
			'incididunt',
			'ut',
			'labore',
			'et',
			'dolore',
			'magna',
			'aliqua',
			'enim',
			'ad',
			'minim',
			'veniam',
			'quis',
			'nostrud',
			'exercitation',
			'ullamco',
			'laboris',
			'nisi',
			'aliquip',
			'ex',
			'ea',
			'commodo',
			'consequat',
			'duis',
			'aute',
			'irure',
			'in',
			'reprehenderit',
			'voluptate',
			'velit',
			'esse',
			'cillum',
			'fugiat',
			'nulla',
			'pariatur',
			'excepteur',
			'sint',
			'occaecat',
			'cupidatat',
			'non',
			'proident',
			'sunt',
			'culpa',
			'qui',
			'officia',
			'deserunt',
			'mollit',
			'anim',
			'id',
			'est',
			'laborum',
		];

		const result = [];
		for (let i = 0; i < wordCount; i++) {
			result.push(words[i % words.length]);
		}

		// Capitalize first word and add period at the end
		if (result.length > 0) {
			result[0] = result[0].charAt(0).toUpperCase() + result[0].slice(1);
		}

		return result.join(' ') + (wordCount > 1 ? '.' : '');
	}

	/**
	 * Get dynamic snippet suggestions for the current context
	 * @param {string} text - Full text
	 * @param {number} offset - Cursor offset
	 * @param {Object} wordInfo - Word info from Monaco
	 * @returns {Array} Dynamic snippet suggestions
	 */
	getDynamicSnippetSuggestions(text, offset, wordInfo, position, model) {
		const monaco = window.monaco;
		const snippetKind = monaco?.languages?.CompletionItemKind?.Method || 2;
		const insertAsSnippet =
			monaco?.languages?.CompletionItemInsertTextRule?.InsertAsSnippet || 4;

		// Validate inputs
		if (!text || !wordInfo || !position) {
			return [];
		}

		// Check if we're in a dot completion context
		const lines = text.split('\n');
		const lineNumber = position.lineNumber;
		const startColumn = wordInfo.startColumn || 0;

		if (lineNumber <= 0 || lineNumber > lines.length) {
			return [];
		}

		const lineText = lines[lineNumber - 1];
		if (!lineText || startColumn <= 0) {
			return [];
		}

		const beforeCursor = lineText.substring(0, startColumn - 1);

		// Look for pattern: any expression followed by dot
		// Use a more flexible approach that captures everything before the last dot
		if (!beforeCursor.endsWith('.')) return [];

		// Find the start of the expression by looking backwards
		let expressionStart = beforeCursor.length - 2; // Start before the dot
		let parenCount = 0;
		let bracketCount = 0;

		// Look backwards to find where the expression starts
		while (expressionStart >= 0) {
			const char = beforeCursor[expressionStart];

			if (char === ')') parenCount++;
			else if (char === '(') parenCount--;
			else if (char === ']') bracketCount++;
			else if (char === '[') bracketCount--;
			else if (
				parenCount === 0 &&
				bracketCount === 0 &&
				!/[a-zA-Z0-9_.]/.test(char)
			) {
				expressionStart++;
				break;
			}

			expressionStart--;
		}

		if (expressionStart < 0) expressionStart = 0;

		const fullExpression = beforeCursor.substring(
			expressionStart,
			beforeCursor.length - 1
		); // Remove the trailing dot

		if (!fullExpression || fullExpression.trim() === '') return [];

		const chainText = fullExpression;
		// For dynamic snippets, we'll use the entire expression as the "variable"
		// and treat any method chaining as part of the expression
		const parts = chainText.split('.');
		const variable = parts[0]; // This might be complex like "myArr[0]" or "getNumber()"
		const existingMethods = parts.slice(1);

		// Get available dynamic snippets
		const dynamicSnippets = this.getDynamicSnippets();
		const suggestions = [];

		// Create suggestions for each available method
		Object.entries(dynamicSnippets).forEach(([methodName, snippet]) => {
			// Create the full chain including existing methods
			const fullChain = {
				variable,
				methods: [...existingMethods, methodName],
			};

			const expanded = this.expandDynamicSnippetChain(fullChain);

			// Calculate where the expression starts for replacement
			const chainStartColumn = expressionStart + 1; // +1 for 1-based column indexing

			suggestions.push({
				label: methodName,
				kind: snippetKind,
				detail: `${chainText}.${methodName} → ${expanded}`,
				documentation: {
					value: `**Dynamic Snippet**\n\n${snippet.description}\n\n\`\`\`gml\n${expanded}\n\`\`\``,
					isTrusted: true,
				},
				insertText: '',
				insertTextRules: insertAsSnippet,
				sortText: '00' + methodName, // Higher priority
				filterText: methodName,
				additionalTextEdits: [
					{
						range: {
							startLineNumber: position.lineNumber,
							endLineNumber: position.lineNumber,
							startColumn: chainStartColumn,
							endColumn: startColumn, // Up to the dot
						},
						text: expanded,
					},
				],
			});
		});

		return suggestions;
	}

	provideCompletionItems(model, position, context, token) {
		if (!this.completionItems || this.completionItems.length === 0) {
			console.warn('GML completion items not initialized');
			return { suggestions: [] };
		}

		// Validate inputs
		if (!model || !position) {
			return { suggestions: [] };
		}

		const text = model.getValue();
		const offset = model.getOffsetAt(position);
		const wordInfo = model.getWordUntilPosition(position);

		// Basic validation for wordInfo
		if (!wordInfo) {
			return { suggestions: [] };
		}

		// Check for lorem ipsum with numbers (e.g., "lorem10", "lorem25")
		const loremMatch = wordInfo.word.match(/^lorem(\d+)$/);
		if (loremMatch) {
			const wordCount = parseInt(loremMatch[1]);
			if (wordCount > 0 && wordCount <= 1000) {
				const loremText = `"${this.generateLoremIpsum(wordCount)}"`;
				return {
					suggestions: [
						{
							label: `lorem${wordCount}`,
							kind: window.monaco?.languages?.CompletionItemKind?.Snippet || 15,
							detail: `Generate ${wordCount} words of Lorem Ipsum`,
							documentation: {
								value: `**Lorem Ipsum Generator**\n\nGenerates ${wordCount} words of placeholder text.\n\n\`\`\`\n${loremText.substring(
									0,
									200
								)}${loremText.length > 200 ? '...' : ''}\n\`\`\``,
								isTrusted: true,
							},
							insertText: loremText,
							sortText: '000lorem',
							range: {
								startLineNumber: position.lineNumber,
								endLineNumber: position.lineNumber,
								startColumn: wordInfo.startColumn,
								endColumn: wordInfo.endColumn,
							},
						},
					],
				};
			}
		}

		// Check for dynamic snippets first
		const dynamicSuggestions = this.getDynamicSnippetSuggestions(
			text,
			offset,
			wordInfo,
			position,
			model
		);
		if (dynamicSuggestions.length > 0) {
			return { suggestions: dynamicSuggestions };
		}

		const localVariables = this.extractLocalVariables(model, position);

		const range = {
			startLineNumber: position.lineNumber,
			endLineNumber: position.lineNumber,
			startColumn: wordInfo.startColumn,
			endColumn: wordInfo.endColumn,
		};

		const validBuiltins = this.completionItems
			.filter(
				(item) =>
					item &&
					item.label &&
					typeof item.label === 'string' &&
					item.kind !== undefined
			)
			.map((item) => ({
				...item,
				range: range,
			}));

		const validLocals = localVariables
			.filter(
				(item) =>
					item &&
					item.label &&
					typeof item.label === 'string' &&
					item.kind !== undefined
			)
			.map((item) => ({
				...item,
				range: range,
			}));

		const validAssets = this.assetCompletions
			.filter(
				(item) =>
					item &&
					item.label &&
					typeof item.label === 'string' &&
					item.kind !== undefined
			)
			.map((item) => ({
				...item,
				range: range,
			}));

		const validUserSymbols = this.userSymbolCompletions
			.filter(
				(item) =>
					item &&
					item.label &&
					typeof item.label === 'string' &&
					item.kind !== undefined
			)
			.map((item) => ({
				...item,
				range: range,
			}));

		const allSuggestions = [
			...validLocals,
			...validUserSymbols,
			...validAssets,
			...validBuiltins,
		];
		const seenLabels = new Set();
		const uniqueSuggestions = allSuggestions.filter((item) => {
			if (seenLabels.has(item.label)) {
				return false;
			}
			seenLabels.add(item.label);
			return true;
		});

		return {
			suggestions: uniqueSuggestions,
		};
	}

	resolveCompletionItem(item, token) {
		return item;
	}
}

export default new GMLCompletionProvider();
