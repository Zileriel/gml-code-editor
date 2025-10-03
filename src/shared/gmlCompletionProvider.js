import gmlDefinitionsParser from './gmlDefinitionsParser.js';

class GMLCompletionProvider {
	constructor() {
		this.completionItems = [];
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
				label: 'if',
				kind: snippetKind,
				detail: 'if statement',
				documentation: { value: 'Creates an if statement', isTrusted: true },
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
					'switch (${1:variable}) {\n\tcase ${2:value1}:\n\t\t${3:// code}\n\t\tbreak;\n\t\tdefault:\n\t\t${4:// default code}\n\t\tbreak;\n}',
				insertTextRules: insertAsSnippet,
				sortText: '0switch',
			},
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
		];
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

	provideCompletionItems(model, position, context, token) {
		if (!this.completionItems || this.completionItems.length === 0) {
			console.warn('GML completion items not initialized');
			return { suggestions: [] };
		}

		const localVariables = this.extractLocalVariables(model, position);

		const wordInfo = model.getWordUntilPosition(position);
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

		const allSuggestions = [...validLocals, ...validBuiltins];
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
