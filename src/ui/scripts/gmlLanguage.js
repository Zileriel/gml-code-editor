import gmlDefinitionsParser from './gmlDefinitionsParser.js';

class GMLLanguageDefinition {
	constructor() {
		this.languageId = 'gml';
		this.functions = new Set();
		this.variables = new Set();
		this.constants = new Set();
		this.globals = new Set();
		this.globalvars = new Set();

		this.userMacros = new Set();
		this.userEnums = new Set();
		this.localVariables = new Map();
		this.functionParameters = new Map();

		this.assetNames = new Set();
	}

	addUserMacro(name) {
		this.userMacros.add(name);
	}

	addUserEnum(name) {
		this.userEnums.add(name);
	}

	addLocalVariable(scope, name) {
		if (!this.localVariables.has(scope)) {
			this.localVariables.set(scope, new Set());
		}
		this.localVariables.get(scope).add(name);
	}

	addFunctionParameter(functionName, paramName) {
		if (!this.functionParameters.has(functionName)) {
			this.functionParameters.set(functionName, new Set());
		}
		this.functionParameters.get(functionName).add(paramName);
	}

	/**
	 * Updates the asset names for syntax highlighting
	 * @param {Object} assets - Asset data from the main process containing objects, sprites, sounds, etc.
	 */
	updateAssets(assets) {
		this.assetNames.clear();

		if (assets) {
			const allAssets = [
				...(assets.objects || []),
				...(assets.sprites || []).map((sprite) =>
					typeof sprite === 'object' ? sprite.name : sprite
				),
				...(assets.sounds || []),
				...(assets.paths || []),
				...(assets.rooms || []),
				...(assets.sequences || []),
				...(assets.shaders || []),
				...(assets.tilesets || []),
				...(assets.fonts || []),
				...(assets.timelines || []),
			];

			allAssets.forEach((assetName) => {
				if (assetName && typeof assetName === 'string') {
					this.assetNames.add(assetName);
				}
			});
		}
		// Update the tokenizer with new assets
		this.updateTokenizer(window.monaco);
	}

	isUserMacro(name) {
		return this.userMacros.has(name);
	}

	isUserEnum(name) {
		return this.userEnums.has(name);
	}

	clearUserIdentifiers() {
		this.userMacros.clear();
		this.userEnums.clear();
		this.localVariables.clear();
		this.functionParameters.clear();
	}

	/**
	 * Updates user-defined symbols (macros, enums, functions) from project definitions
	 * @param {Object} definitions - Definitions object containing macros, enums, and functions arrays
	 */
	updateUserSymbols(definitions) {
		if (!definitions) return;

		// Clear existing user symbols
		this.userMacros.clear();
		this.userEnums.clear();
		this.localVariables.clear();
		this.functionParameters.clear();
		this.globals.clear();
		this.globalvars.clear();

		// Add macros
		if (definitions.macros) {
			definitions.macros.forEach((macro) => {
				this.userMacros.add(macro.name);
			});
		}

		// Add enums
		if (definitions.enums) {
			definitions.enums.forEach((enumDef) => {
				this.userEnums.add(enumDef.name);
			});
		}

		// Add functions
		if (definitions.functions) {
			definitions.functions.forEach((func) => {
				this.functions.add(func.name);
			});
		}

		// Add globals
		if (definitions.globals) {
			definitions.globals.forEach((global) => {
				this.globals.add(global.name);
			});
		}

		// Add globalvars
		if (definitions.globalvars) {
			definitions.globalvars.forEach((globalvar) => {
				this.globalvars.add(globalvar.name);
			});
		}

		// Update the tokenizer
		this.updateTokenizer(window.monaco);
	}

	updateTokenizer(monaco) {
		if (monaco && monaco.languages) {
			const monarchDefinition = this.getMonarchDefinition();
			monaco.languages.setMonarchTokensProvider('gml', monarchDefinition);
		}
	}

	async initialize() {
		await gmlDefinitionsParser.loadDefinitions();

		gmlDefinitionsParser.getFunctions().forEach((func) => {
			if (!func.deprecated) {
				this.functions.add(func.name);
			}
		});

		gmlDefinitionsParser.getVariables().forEach((variable) => {
			if (!variable.deprecated) {
				this.variables.add(variable.name);
			}
		});

		gmlDefinitionsParser.getConstants().forEach((constant) => {
			if (!constant.deprecated && constant.name !== '$$implicit_argument$$') {
				this.constants.add(constant.name);
			}
		});
	}

	getMonarchDefinition() {
		const builtinFunctions = Array.from(this.functions);
		const builtinVariables = Array.from(this.variables);
		const builtinConstants = Array.from(this.constants);
		const userMacros = Array.from(this.userMacros);
		const userEnums = Array.from(this.userEnums);
		const assetNames = Array.from(this.assetNames);
		const userGlobals = Array.from(this.globals);
		const userGlobalvars = Array.from(this.globalvars);
		const userFunctions = Array.from(this.functions).filter(
			(name) => !builtinFunctions.includes(name)
		);

		const userLocalVars = [];
		for (const scopeVars of this.localVariables.values()) {
			userLocalVars.push(...scopeVars);
		}
		for (const paramVars of this.functionParameters.values()) {
			userLocalVars.push(...paramVars);
		}

		return {
			defaultToken: '',
			ignoreCase: false,

			keywords: [
				'if',
				'else',
				'while',
				'for',
				'do',
				'until',
				'repeat',
				'switch',
				'case',
				'default',
				'break',
				'continue',
				'exit',
				'return',
				'function',
				'var',
				'constructor',
				'static',
				'new',
				'delete',
				'try',
				'catch',
				'throw',
				'finally',
				'with',
				'begin',
				'end',
				'then',
				'not',
				'and',
				'or',
				'xor',
				'mod',
				'div',
			],

			atoms: [
				'true',
				'false',
				'undefined',
				'noone',
				'all',
				'other',
				'self',
				'infinity',
				'global',
				'globalvar',
				'enum',
				'$',
			],

			builtinFunctions: builtinFunctions,
			builtinVariables: builtinVariables,
			builtinConstants: builtinConstants,
			userMacros: userMacros,
			userEnums: userEnums,
			userLocalVars: userLocalVars,
			userGlobals: userGlobals,
			userGlobalvars: userGlobalvars,
			userFunctions: userFunctions,
			assetNames: assetNames,

			operators: [
				'=',
				'>',
				'<',
				'!',
				'~',
				'?',
				':',
				'==',
				'<=',
				'>=',
				'!=',
				'<>',
				'&&',
				'||',
				'++',
				'--',
				'+',
				'-',
				'*',
				'/',
				'&',
				'|',
				'^',
				'%',
				'<<',
				'>>',
				'+=',
				'-=',
				'*=',
				'/=',
				'&=',
				'|=',
				'^=',
				'%=',
				'<<=',
				'>>=',
				':=',
				'??',
				'??=',
			],

			symbols: /[=><!~?:&|+\-*\/\^%]+/,
			escapes:
				/\\(?:[abfnrtv\\"'@#]|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

			tokenizer: {
				root: [
					// Macro definitions
					[
						/(#macro)(\s+)([a-zA-Z_][\w]*)/,
						['keyword.preprocessor', 'white', 'atom'],
					],

					// Enum definitions
					[
						/(enum)(\s+)([a-zA-Z_][\w]*)(\s*)(\{)/,
						[
							'keyword',
							'white',
							'atom',
							'white',
							{ token: '@brackets', next: '@enumBody' },
						],
					],

					// Function definitions
					[
						/(function)(\s+)([a-zA-Z_][\w]*)(\s*)(\()/,
						[
							'keyword',
							'white',
							'function.definition',
							'white',
							{ token: '@brackets', next: '@functionParams' },
						],
					],

					// Variable declarations with assignment
					[
						/(var|static)(\s+)([a-zA-Z_][\w]*)(\s*=)/,
						['keyword', 'white', 'variable.local', 'operator'],
					],
					// Variable declarations without assignment
					[
						/(var|static)(\s+)([a-zA-Z_][\w]*)/,
						['keyword', 'white', 'variable.local'],
					],
					// Global variable declarations
					[/(globalvar)(\s+)([a-zA-Z_][\w]*)/, ['keyword', 'white', 'atom']],
					[/(global)(\.)([a-zA-Z_][\w]*)/, ['atom', 'atom', 'atom']],

					// Enum member access
					[
						/([A-Z][a-zA-Z0-9_]*)(\.)([a-zA-Z_][\w]*)/,
						['atom', 'delimiter', 'atom'],
					],

					// Global variable assignments (simplified for debugging)
					[
						/([a-zA-Z_][\w]*)\s*=/,
						{
							cases: {
								'@userGlobalvars': 'atom',
								'@userGlobals': 'atom',
								'@default': 'identifier',
							},
						},
					],

					// Function calls (check before general identifiers)
					[
						/([a-zA-Z_][\w]*)\s*(?=\()/,
						{
							cases: {
								'@builtinFunctions': 'function.builtin',
								'@userFunctions': 'function.call',
								'@default': 'function.call',
							},
						},
					],

					// Identifiers and keywords
					[
						/[a-zA-Z_][\w]*/,
						{
							cases: {
								'@keywords': 'keyword',
								'@atoms': 'atom',
								'@builtinFunctions': 'function.builtin',
								'@builtinVariables': 'variable.builtin',
								'@builtinConstants': 'constant.builtin',
								'@userMacros': 'atom',
								'@userEnums': 'atom',
								'@assetNames': 'atom',
								'@userGlobals': 'atom',
								'@userGlobalvars': 'atom',
								'@userLocalVars': 'variable.local',
								'@default': 'identifier',
							},
						},
					],

					// Whitespace
					{ include: '@whitespace' },

					// Delimiters and operators
					[/[{}()\[\]]/, '@brackets'],
					[/[<>](?!@symbols)/, '@brackets'],
					[
						/@symbols/,
						{
							cases: {
								'@operators': 'operator',
								'@default': '',
							},
						},
					],

					// Numbers
					[/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
					[/0[xX][0-9a-fA-F]+/, 'number.hex'],
					[/#[0-9a-fA-F]+/, 'number.hex'],
					[/\$[0-9a-fA-F]+/, 'number.hex'],
					[/\d+/, 'number'],

					// Delimiter: after number because of .\d floats
					[/[;,.]/, 'delimiter'],

					// Strings
					[/"([^"\\]|\\.)*$/, 'string.invalid'],
					[
						/"/,
						{ token: 'string.quote', bracket: '@open', next: '@string_double' },
					],
					[/'([^'\\]|\\.)*$/, 'string.invalid'],
					[
						/'/,
						{ token: 'string.quote', bracket: '@open', next: '@string_single' },
					],
					[
						/@"/,
						{
							token: 'string.quote',
							bracket: '@open',
							next: '@string_verbatim',
						},
					],

					// Macros and preprocessor
					[/#macro\s+/, 'keyword.preprocessor'],
					[/#region\s+/, 'keyword.preprocessor'],
					[/#endregion/, 'keyword.preprocessor'],
				],

				comment: [
					[/[^\/*]+/, 'comment'],
					[/\/\*/, 'comment', '@push'],
					['\\*/', 'comment', '@pop'],
					[/[\/*]/, 'comment'],
				],

				string_double: [
					[/[^\\"]+/, 'string'],
					[/@escapes/, 'string.escape'],
					[/\\./, 'string.escape.invalid'],
					[/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
				],

				string_single: [
					[/[^\\']+/, 'string'],
					[/@escapes/, 'string.escape'],
					[/\\./, 'string.escape.invalid'],
					[/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
				],

				string_verbatim: [
					[/[^"]+/, 'string'],
					[/""/, 'string.escape'],
					[/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
				],

				functionParams: [
					[/([a-zA-Z_][\w]*)/, 'variable.parameter'],
					[/,/, 'delimiter'],
					[/\s+/, 'white'],
					[/\)/, { token: '@brackets', next: '@pop' }],
				],

				enumBody: [
					[/([a-zA-Z_][\w]*)/, 'atom'],
					[/,/, 'delimiter'],
					[/=/, 'operator'],
					[/\d+/, 'number'],
					[/\s+/, 'white'],
					[/\/\/.*$/, 'comment'],
					[/\/\*/, 'comment', '@comment'],
					[/\}/, { token: '@brackets', next: '@pop' }],
				],

				whitespace: [
					[/[ \t\r\n]+/, 'white'],
					[/\/\*/, 'comment', '@comment'],
					[/\/\/.*$/, 'comment'],
				],
			},
		};
	}

	getLanguageConfiguration() {
		return {
			comments: {
				lineComment: '//',
				blockComment: ['/*', '*/'],
			},
			brackets: [
				['{', '}'],
				['[', ']'],
				['(', ')'],
			],
			autoClosingPairs: [
				{ open: '{', close: '}' },
				{ open: '[', close: ']' },
				{ open: '(', close: ')' },
				{ open: '"', close: '"', notIn: ['string'] },
				{ open: "'", close: "'", notIn: ['string'] },
			],
			surroundingPairs: [
				{ open: '{', close: '}' },
				{ open: '[', close: ']' },
				{ open: '(', close: ')' },
				{ open: '"', close: '"' },
				{ open: "'", close: "'" },
			],
			indentationRules: {
				increaseIndentPattern:
					/^(.*\{[^}]*|\s*begin\s*|\s*(if|else|while|for|repeat|with|switch|case|default|function|enum|try|catch|finally)\b.*)$/,
				decreaseIndentPattern: /^\s*(\}|end\s*;?|until\b)/,
			},
			folding: {
				markers: {
					start: /^\s*#region/,
					end: /^\s*#endregion/,
				},
			},
		};
	}
}

export default new GMLLanguageDefinition();
