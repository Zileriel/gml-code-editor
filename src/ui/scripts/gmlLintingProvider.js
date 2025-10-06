import gmlDefinitionsParser from './gmlDefinitionsParser.js';
import gmlLanguage from './gmlLanguage.js';

class GMLLintingProvider {
	constructor() {
		this.initialized = false;
		this.diagnostics = new Map();
		this.declaredMacros = new Set();
		this.declaredEnums = new Set();
	}

	async initialize() {
		if (!this.initialized) {
			this.initialized = true;
		}
	}

	/**
	 * Update asset information for linting
	 * @param {Object} assets - Asset data from the main process
	 */
	updateAssets(assets) {
		gmlLanguage.updateAssets(assets);
	}

	/**
	 * Validate GML code and return diagnostics
	 * @param {*} model Monaco editor model
	 * @returns Array of diagnostics
	 */
	validateCode(model) {
		if (!model) return [];

		const diagnostics = [];
		const text = model.getValue();
		const lines = text.split('\n');

		this.diagnostics.set(model.uri.toString(), diagnostics);

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			const lineNumber = lineIndex + 1;

			if (this.isCommentOrEmpty(line)) continue;

			const lineWithoutStrings = this.removeStrings(line);

			diagnostics.push(
				...this.checkDeprecatedFunctions(lineWithoutStrings, lineNumber, model)
			);

			diagnostics.push(
				...this.checkLineSyntaxErrors(lineWithoutStrings, lineNumber, model)
			);
		}

		const textWithoutStrings = this.removeStringsFromText(text);
		diagnostics.push(
			...this.checkMultiLineSyntaxErrors(textWithoutStrings, lines, model)
		);

		// Reset macro and enum tracking for this validation
		this.declaredMacros.clear();
		this.declaredEnums.clear();

		// Check for read-only variable assignments and redeclarations
		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			const lineNumber = lineIndex + 1;

			if (this.isCommentOrEmpty(line)) continue;

			const lineWithoutStrings = this.removeStrings(line);

			diagnostics.push(
				...this.checkReadOnlyAssignments(lineWithoutStrings, lineNumber, model)
			);

			diagnostics.push(
				...this.checkMacroRedeclarations(lineWithoutStrings, lineNumber, model)
			);

			diagnostics.push(
				...this.checkEnumRedeclarations(lineWithoutStrings, lineNumber, model)
			);

			diagnostics.push(
				...this.checkFunctionRedeclarations(
					lineWithoutStrings,
					lineNumber,
					model
				)
			);
		}

		return diagnostics;
	}

	/**
	 * Check if line is a comment or empty
	 */
	isCommentOrEmpty(line) {
		const trimmed = line.trim();
		return (
			trimmed === '' ||
			trimmed.startsWith('//') ||
			trimmed.startsWith('/*') ||
			trimmed.startsWith('*') ||
			trimmed.endsWith('*/')
		);
	}

	/**
	 * Check if a position in the text is inside a comment
	 * @param {string} text - The full text
	 * @param {number} position - Character position to check
	 * @returns {boolean} True if position is inside a comment
	 */
	isPositionInComment(text, position) {
		let inBlockComment = false;
		let inString = false;
		let stringChar = '';
		let escaped = false;

		for (let i = 0; i < Math.min(position, text.length); i++) {
			const char = text[i];
			const nextChar = i + 1 < text.length ? text[i + 1] : '';

			if (escaped) {
				escaped = false;
				continue;
			}

			if (char === '\\' && inString) {
				escaped = true;
				continue;
			}

			if (!inBlockComment && !inString && (char === '"' || char === "'")) {
				inString = true;
				stringChar = char;
				continue;
			}

			if (inString && char === stringChar) {
				inString = false;
				stringChar = '';
				continue;
			}

			if (inString) {
				continue;
			}

			// Handle block comments
			if (!inBlockComment && char === '/' && nextChar === '*') {
				inBlockComment = true;
				i++; // Skip the *
				continue;
			}

			if (inBlockComment && char === '*' && nextChar === '/') {
				inBlockComment = false;
				i++; // Skip the /
				continue;
			}

			// Handle line comments
			if (!inBlockComment && char === '/' && nextChar === '/') {
				// Check if position is on this line
				const lineStart = i;
				let lineEnd = i;
				while (lineEnd < text.length && text[lineEnd] !== '\n') {
					lineEnd++;
				}
				if (position >= lineStart && position < lineEnd) {
					return true;
				}
				// Skip to end of line
				i = lineEnd - 1; // -1 because loop will increment
				continue;
			}
		}

		return inBlockComment;
	}

	/**
	 * Remove string literals from entire text
	 */
	removeStringsFromText(text) {
		return text
			.split('\n')
			.map((line) => this.removeStrings(line))
			.join('\n');
	}

	/**
	 * Remove string literals from line to avoid false positives in linting
	 */
	removeStrings(line) {
		let result = '';
		let inString = false;
		let stringChar = '';
		let escaped = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (escaped) {
				escaped = false;
				if (inString) {
					result += ' ';
				} else {
					result += char;
				}
				continue;
			}

			if (char === '\\' && inString) {
				escaped = true;
				result += ' ';
				continue;
			}

			if (!inString && (char === '"' || char === "'")) {
				inString = true;
				stringChar = char;
				result += ' ';
			} else if (inString && char === stringChar) {
				inString = false;
				stringChar = '';
				result += ' ';
			} else if (inString) {
				result += ' ';
			} else {
				result += char;
			}
		}

		return result;
	}

	/**
	 * Check for simple line-level syntax errors
	 */
	checkLineSyntaxErrors(line, lineNumber, model) {
		const diagnostics = [];

		// Double semicolons
		if (line.includes(';;')) {
			const index = line.indexOf(';;');
			diagnostics.push({
				severity: 4,
				message: 'Double semicolon found',
				startLineNumber: lineNumber,
				startColumn: index + 1,
				endLineNumber: lineNumber,
				endColumn: index + 3,
				code: 'double-semicolon',
			});
		}

		// Invalid operators
		const invalidOperators = /===|!==|<==|>==/g;
		let match;
		while ((match = invalidOperators.exec(line)) !== null) {
			diagnostics.push({
				severity: 8, // Monaco Error
				message: `Invalid operator '${match[0]}'. Did you mean '==' or '!='?`,
				startLineNumber: lineNumber,
				startColumn: match.index + 1,
				endLineNumber: lineNumber,
				endColumn: match.index + match[0].length + 1,
				code: 'invalid-operator',
			});
		}

		// Missing semicolon
		const trimmed = line.trim();
		const commentIndex = line.indexOf('//');
		const lineBeforeComment =
			commentIndex !== -1 ? line.substring(0, commentIndex).trim() : trimmed;

		if (
			lineBeforeComment.length > 0 &&
			!lineBeforeComment.endsWith(';') &&
			!lineBeforeComment.endsWith('{') &&
			!lineBeforeComment.endsWith('}') &&
			!trimmed.startsWith('//') &&
			!lineBeforeComment.includes('if') &&
			!lineBeforeComment.includes('for') &&
			!lineBeforeComment.includes('while') &&
			!lineBeforeComment.includes('function') &&
			!lineBeforeComment.includes('enum') &&
			!lineBeforeComment.includes('switch') &&
			!lineBeforeComment.includes('case') &&
			!lineBeforeComment.includes('default') &&
			(lineBeforeComment.includes('=') ||
				lineBeforeComment.includes('(') ||
				/^\w+\s*\[/.test(lineBeforeComment))
		) {
			const insertPosition = commentIndex !== -1 ? commentIndex : line.length;

			diagnostics.push({
				severity: 1,
				message: 'Missing semicolon',
				startLineNumber: lineNumber,
				startColumn: insertPosition,
				endLineNumber: lineNumber,
				endColumn: insertPosition + 1,
				code: 'missing-semicolon',
			});
		}

		return diagnostics;
	}

	/**
	 * Check for deprecated functions
	 */
	checkDeprecatedFunctions(line, lineNumber, model) {
		const diagnostics = [];
		const functionMatches = line.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);

		for (const match of functionMatches) {
			const functionName = match[1];
			const func = gmlDefinitionsParser.getFunction(functionName);

			if (func && func.deprecated) {
				const startColumn = match.index + 1;
				const endColumn = startColumn + functionName.length;

				diagnostics.push({
					severity: 4,
					message: `Function '${functionName}' is deprecated`,
					startLineNumber: lineNumber,
					startColumn: startColumn,
					endLineNumber: lineNumber,
					endColumn: endColumn,
					code: 'deprecated-function',
				});
			}
		}

		return diagnostics;
	}

	/**
	 * Check for multi-line syntax errors using bracket/brace tracking
	 */
	checkMultiLineSyntaxErrors(text, lines, model) {
		const diagnostics = [];

		// Track bracket/brace/parenthesis balance
		let parenStack = [];
		let bracketStack = [];
		let braceStack = [];

		const chars = text.split('');
		let currentLine = 1;
		let currentColumn = 1;

		for (let i = 0; i < chars.length; i++) {
			const char = chars[i];

			if (char === '\n') {
				currentLine++;
				currentColumn = 1;
				continue;
			}

			// Skip if position is in a comment
			if (this.isPositionInComment(text, i)) {
				currentColumn++;
				continue;
			}

			switch (char) {
				case '(':
					parenStack.push({ line: currentLine, column: currentColumn });
					break;
				case ')':
					if (parenStack.length === 0) {
						diagnostics.push({
							severity: 8,
							message: 'Unexpected closing parenthesis',
							startLineNumber: currentLine,
							startColumn: currentColumn,
							endLineNumber: currentLine,
							endColumn: currentColumn + 1,
							code: 'unexpected-closing-paren',
						});
					} else {
						parenStack.pop();
					}
					break;
				case '[':
					bracketStack.push({ line: currentLine, column: currentColumn });
					break;
				case ']':
					if (bracketStack.length === 0) {
						diagnostics.push({
							severity: 8,
							message: 'Unexpected closing bracket',
							startLineNumber: currentLine,
							startColumn: currentColumn,
							endLineNumber: currentLine,
							endColumn: currentColumn + 1,
							code: 'unexpected-closing-bracket',
						});
					} else {
						bracketStack.pop();
					}
					break;
				case '{':
					braceStack.push({ line: currentLine, column: currentColumn });
					break;
				case '}':
					if (braceStack.length === 0) {
						diagnostics.push({
							severity: 8,
							message: 'Unexpected closing brace',
							startLineNumber: currentLine,
							startColumn: currentColumn,
							endLineNumber: currentLine,
							endColumn: currentColumn + 1,
							code: 'unexpected-closing-brace',
						});
					} else {
						braceStack.pop();
					}
					break;
			}

			currentColumn++;
		}

		for (const paren of parenStack) {
			diagnostics.push({
				severity: 8,
				message: 'Unclosed parenthesis',
				startLineNumber: paren.line,
				startColumn: paren.column,
				endLineNumber: paren.line,
				endColumn: paren.column + 1,
				code: 'unclosed-paren',
			});
		}

		for (const bracket of bracketStack) {
			diagnostics.push({
				severity: 8,
				message: 'Unclosed bracket',
				startLineNumber: bracket.line,
				startColumn: bracket.column,
				endLineNumber: bracket.line,
				endColumn: bracket.column + 1,
				code: 'unclosed-bracket',
			});
		}

		for (const brace of braceStack) {
			diagnostics.push({
				severity: 8,
				message: 'Unclosed brace',
				startLineNumber: brace.line,
				startColumn: brace.column,
				endLineNumber: brace.line,
				endColumn: brace.column + 1,
				code: 'unclosed-brace',
			});
		}

		return diagnostics;
	}

	/**
	 * Check for assignments to read-only identifiers (constants, keywords, assets, etc.)
	 */
	checkReadOnlyAssignments(line, lineNumber, model) {
		const diagnostics = [];
		const assignmentMatches = line.matchAll(
			/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*([+\-*/%&|^]?=)/g
		);

		for (const match of assignmentMatches) {
			const identifier = match[1];
			const operator = match[2];
			const startColumn = match.index + 1;
			const endColumn = startColumn + identifier.length;

			let isReadOnly = false;
			let errorMessage = '';

			// Check if it's a built-in constant
			const constant = gmlDefinitionsParser.getConstant(identifier);
			if (constant && !constant.deprecated) {
				isReadOnly = true;
				errorMessage = `Cannot assign to built-in constant '${identifier}'`;
			}

			// Check if it's a built-in variable that cannot be set
			const variable = gmlDefinitionsParser.getVariable(identifier);
			if (variable && !variable.deprecated && !variable.canSet) {
				isReadOnly = true;
				errorMessage = `Cannot assign to read-only built-in variable '${identifier}'`;
			}

			// Check if it's a built-in function
			const func = gmlDefinitionsParser.getFunction(identifier);
			if (func && !func.deprecated) {
				isReadOnly = true;
				errorMessage = `Cannot assign to built-in function '${identifier}'`;
			}

			// Check if it's a language keyword
			if (this.isLanguageKeyword(identifier)) {
				isReadOnly = true;
				errorMessage = `Cannot assign to language keyword '${identifier}'`;
			}

			// Check if it's an asset name
			if (gmlLanguage.assetNames.has(identifier)) {
				isReadOnly = true;
				errorMessage = `Cannot assign to asset name '${identifier}'`;
			}

			// Check if it's a user-defined macro
			if (gmlLanguage.userMacros.has(identifier)) {
				isReadOnly = true;
				errorMessage = `Cannot assign to macro '${identifier}'. Macros are read-only`;
			}

			// Check if it's a user-defined enum
			if (gmlLanguage.userEnums.has(identifier)) {
				isReadOnly = true;
				errorMessage = `Cannot assign to enum '${identifier}'. Enums are read-only`;
			}

			if (isReadOnly) {
				diagnostics.push({
					severity: 8,
					message: errorMessage,
					startLineNumber: lineNumber,
					startColumn: startColumn,
					endLineNumber: lineNumber,
					endColumn: endColumn,
					code: 'read-only-assignment',
				});
			}
		}

		return diagnostics;
	}

	/**
	 * Check for macro redeclarations
	 */
	checkMacroRedeclarations(line, lineNumber, model) {
		const diagnostics = [];

		const macroMatches = line.matchAll(/#macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);

		for (const match of macroMatches) {
			const macroName = match[1];
			const startColumn = match.index + match[0].indexOf(macroName) + 1;
			const endColumn = startColumn + macroName.length;

			if (this.declaredMacros.has(macroName)) {
				diagnostics.push({
					severity: 8,
					message: `Macro '${macroName}' has already been declared`,
					startLineNumber: lineNumber,
					startColumn: startColumn,
					endLineNumber: lineNumber,
					endColumn: endColumn,
					code: 'macro-redeclaration',
				});
			} else {
				this.declaredMacros.add(macroName);
			}
		}

		return diagnostics;
	}

	/**
	 * Check for enum redeclarations
	 */
	checkEnumRedeclarations(line, lineNumber, model) {
		const diagnostics = [];

		const enumMatches = line.matchAll(/enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);

		for (const match of enumMatches) {
			const enumName = match[1];
			const startColumn = match.index + match[0].indexOf(enumName) + 1;
			const endColumn = startColumn + enumName.length;

			if (this.declaredEnums.has(enumName)) {
				diagnostics.push({
					severity: 8,
					message: `Enum '${enumName}' has already been declared`,
					startLineNumber: lineNumber,
					startColumn: startColumn,
					endLineNumber: lineNumber,
					endColumn: endColumn,
					code: 'enum-redeclaration',
				});
			} else {
				this.declaredEnums.add(enumName);
			}
		}

		return diagnostics;
	}

	/**
	 * Check for function redeclarations (trying to redefine built-in functions)
	 */
	checkFunctionRedeclarations(line, lineNumber, model) {
		const diagnostics = [];

		const functionMatches = line.matchAll(
			/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
		);

		for (const match of functionMatches) {
			const functionName = match[1];
			const startColumn = match.index + match[0].indexOf(functionName) + 1;
			const endColumn = startColumn + functionName.length;

			const builtinFunc = gmlDefinitionsParser.getFunction(functionName);
			if (builtinFunc && !builtinFunc.deprecated) {
				diagnostics.push({
					severity: 8,
					message: `Cannot redefine built-in function '${functionName}'`,
					startLineNumber: lineNumber,
					startColumn: startColumn,
					endLineNumber: lineNumber,
					endColumn: endColumn,
					code: 'builtin-function-redeclaration',
				});
			}

			// Check if it's an asset name
			if (gmlLanguage.assetNames.has(functionName)) {
				diagnostics.push({
					severity: 8,
					message: `Cannot use asset name '${functionName}' as function name`,
					startLineNumber: lineNumber,
					startColumn: startColumn,
					endLineNumber: lineNumber,
					endColumn: endColumn,
					code: 'asset-function-name-conflict',
				});
			}
		}

		return diagnostics;
	}

	/**
	 * Check if an identifier is a language keyword
	 */
	isLanguageKeyword(identifier) {
		const keywords = [
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
		];
		return keywords.includes(identifier);
	}

	/**
	 * Get diagnostics for a specific model
	 */
	getDiagnostics(model) {
		return this.diagnostics.get(model.uri.toString()) || [];
	}

	/**
	 * Clear diagnostics for a model
	 */
	clearDiagnostics(model) {
		this.diagnostics.delete(model.uri.toString());
	}
}

export default new GMLLintingProvider();
