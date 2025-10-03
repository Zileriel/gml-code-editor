import gmlDefinitionsParser from './gmlDefinitionsParser.js';

class GMLLintingProvider {
	constructor() {
		this.initialized = false;
		this.diagnostics = new Map();
	}

	async initialize() {
		if (!this.initialized) {
			this.initialized = true;
		}
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

		// First pass: check individual lines for simple errors
		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			const lineNumber = lineIndex + 1;

			if (this.isCommentOrEmpty(line)) continue;

			const lineWithoutStrings = this.removeStrings(line);

			// Check for deprecated functions
			diagnostics.push(...this.checkDeprecatedFunctions(lineWithoutStrings, lineNumber, model));
			
			// Check for simple line-level syntax errors
			diagnostics.push(...this.checkLineSyntaxErrors(lineWithoutStrings, lineNumber, model));
		}

		// Second pass: check multi-line syntax issues
		const textWithoutStrings = this.removeStringsFromText(text);
		diagnostics.push(...this.checkMultiLineSyntaxErrors(textWithoutStrings, lines, model));

		return diagnostics;
	}

	/**
	 * Check if line is a comment or empty
	 */
	isCommentOrEmpty(line) {
		const trimmed = line.trim();
		return trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
	}

	/**
	 * Remove string literals from entire text
	 */
	removeStringsFromText(text) {
		return text.split('\n').map(line => this.removeStrings(line)).join('\n');
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
		
		// Check for obvious syntax mistakes that should be caught on a single line
		// Double semicolons
		if (line.includes(';;')) {
			const index = line.indexOf(';;');
			diagnostics.push({
				severity: 4, // Monaco Warning
				message: 'Double semicolon found',
				startLineNumber: lineNumber,
				startColumn: index + 1,
				endLineNumber: lineNumber,
				endColumn: index + 3,
				code: 'double-semicolon'
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
				code: 'invalid-operator'
			});
		}

		// Missing semicolon at end of statement (common GML patterns)
		const trimmed = line.trim();
		
		// Check if line has a semicolon before any comment
		const commentIndex = line.indexOf('//');
		const lineBeforeComment = commentIndex !== -1 ? line.substring(0, commentIndex).trim() : trimmed;
		
		if (lineBeforeComment.length > 0 && 
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
			(lineBeforeComment.includes('=') || lineBeforeComment.includes('(') || /^\w+\s*\[/.test(lineBeforeComment))) {
				
				// Find the position after the code but before the comment
				const insertPosition = commentIndex !== -1 ? commentIndex : line.length;
				
				diagnostics.push({
					severity: 1, // Monaco Hint (suggestion)
					message: 'Missing semicolon',
					startLineNumber: lineNumber,
					startColumn: insertPosition,
					endLineNumber: lineNumber,
					endColumn: insertPosition + 1,
					code: 'missing-semicolon'
				});
		}

		return diagnostics;
	}



	/**
	 * Check for deprecated functions
	 */
	checkDeprecatedFunctions(line, lineNumber, model) {
		const diagnostics = [];
		
		// Find function calls
		const functionMatches = line.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
		
		for (const match of functionMatches) {
			const functionName = match[1];
			const func = gmlDefinitionsParser.getFunction(functionName);
			
			if (func && func.deprecated) {
				const startColumn = match.index + 1;
				const endColumn = startColumn + functionName.length;
				
				diagnostics.push({
					severity: 4, // Monaco Warning
					message: `Function '${functionName}' is deprecated`,
					startLineNumber: lineNumber,
					startColumn: startColumn,
					endLineNumber: lineNumber,
					endColumn: endColumn,
					code: 'deprecated-function'
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
		
		// Track bracket/brace/parenthesis balance across the entire file
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
			
			switch (char) {
				case '(':
					parenStack.push({ line: currentLine, column: currentColumn });
					break;
				case ')':
					if (parenStack.length === 0) {
						diagnostics.push({
							severity: 8, // Monaco Error
							message: 'Unexpected closing parenthesis',
							startLineNumber: currentLine,
							startColumn: currentColumn,
							endLineNumber: currentLine,
							endColumn: currentColumn + 1,
							code: 'unexpected-closing-paren'
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
							severity: 8, // Monaco Error
							message: 'Unexpected closing bracket',
							startLineNumber: currentLine,
							startColumn: currentColumn,
							endLineNumber: currentLine,
							endColumn: currentColumn + 1,
							code: 'unexpected-closing-bracket'
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
							severity: 8, // Monaco Error
							message: 'Unexpected closing brace',
							startLineNumber: currentLine,
							startColumn: currentColumn,
							endLineNumber: currentLine,
							endColumn: currentColumn + 1,
							code: 'unexpected-closing-brace'
						});
					} else {
						braceStack.pop();
					}
					break;
			}
			
			currentColumn++;
		}
		
		// Report unclosed brackets/braces/parentheses
		for (const paren of parenStack) {
			diagnostics.push({
				severity: 8, // Monaco Error
				message: 'Unclosed parenthesis',
				startLineNumber: paren.line,
				startColumn: paren.column,
				endLineNumber: paren.line,
				endColumn: paren.column + 1,
				code: 'unclosed-paren'
			});
		}
		
		for (const bracket of bracketStack) {
			diagnostics.push({
				severity: 8, // Monaco Error
				message: 'Unclosed bracket',
				startLineNumber: bracket.line,
				startColumn: bracket.column,
				endLineNumber: bracket.line,
				endColumn: bracket.column + 1,
				code: 'unclosed-bracket'
			});
		}
		
		for (const brace of braceStack) {
			diagnostics.push({
				severity: 8, // Monaco Error
				message: 'Unclosed brace',
				startLineNumber: brace.line,
				startColumn: brace.column,
				endLineNumber: brace.line,
				endColumn: brace.column + 1,
				code: 'unclosed-brace'
			});
		}
		
		return diagnostics;
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