import gmlDefinitionsParser from './gmlDefinitionsParser.js';

class GMLSignatureHelpProvider {
	constructor() {
		this.initialized = false;
		this.triggerCharacters = ['(', ','];
		this.retriggerCharacters = [','];
	}

	async initialize() {
		if (!this.initialized) {
			await gmlDefinitionsParser.loadDefinitions();
			this.initialized = true;
		}
	}

	provideSignatureHelp(model, position, token, context) {
		const text = model.getValue();
		const offset = model.getOffsetAt(position);

		const functionCall = this.findCurrentFunctionCall(text, offset);
		if (!functionCall) return null;

		// Check for built-in functions first
		let func = gmlDefinitionsParser.getFunction(functionCall.functionName);
		let isUserFunction = false;

		// If not found in built-ins, check user-defined functions
		if (!func && window.definitions) {
			const userFunc = window.definitions.findDefinition(
				functionCall.functionName
			);
			if (userFunc && userFunc.parameters) {
				func = {
					name: userFunc.name,
					parameters: userFunc.parameters || [],
					returnType: userFunc.returnType || 'any',
					description: userFunc.description || 'User-defined function',
				};
				isUserFunction = true;
			}
		}

		if (!func) return null;

		const signature = this.createSignatureInformation(func, isUserFunction);
		const activeParameter = this.calculateActiveParameter(
			functionCall.parametersText,
			functionCall.currentPosition
		);

		return {
			signatures: [signature],
			activeSignature: 0,
			activeParameter: Math.min(
				activeParameter,
				(func.parameters || []).length - 1
			),
		};
	}

	findCurrentFunctionCall(text, offset) {
		let pos = offset - 1;
		let parenCount = 0;
		let foundOpenParen = false;

		while (pos >= 0) {
			const char = text[pos];

			if (char === ')') {
				parenCount++;
			} else if (char === '(') {
				if (parenCount === 0) {
					foundOpenParen = true;
					break;
				}
				parenCount--;
			}
			pos--;
		}

		if (!foundOpenParen) return null;

		const openParenPos = pos;

		let funcNameEnd = openParenPos;
		while (funcNameEnd > 0 && /\s/.test(text[funcNameEnd - 1])) {
			funcNameEnd--;
		}

		let funcNameStart = funcNameEnd - 1;
		while (funcNameStart >= 0 && /[a-zA-Z_0-9]/.test(text[funcNameStart])) {
			funcNameStart--;
		}
		funcNameStart++;

		const functionName = text.substring(funcNameStart, funcNameEnd);
		if (!functionName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)) {
			return null;
		}

		let closeParenPos = offset;
		parenCount = 1;
		pos = openParenPos + 1;

		while (pos < text.length && parenCount > 0) {
			const char = text[pos];
			if (char === '(') {
				parenCount++;
			} else if (char === ')') {
				parenCount--;
				if (parenCount === 0) {
					closeParenPos = pos;
					break;
				}
			}
			pos++;
		}

		const parametersText = text.substring(
			openParenPos + 1,
			Math.min(offset, closeParenPos)
		);
		const currentPosition = offset - (openParenPos + 1);

		return {
			functionName,
			parametersText,
			currentPosition,
			openParenPos,
			closeParenPos,
		};
	}

	calculateActiveParameter(parametersText, currentPosition) {
		if (currentPosition <= 0) return 0;

		const textUpToPosition = parametersText.substring(0, currentPosition);
		let paramIndex = 0;
		let parenCount = 0;
		let bracketCount = 0;
		let braceCount = 0;
		let inString = false;
		let stringChar = '';

		for (let i = 0; i < textUpToPosition.length; i++) {
			const char = textUpToPosition[i];
			const prevChar = i > 0 ? textUpToPosition[i - 1] : '';

			if (!inString && (char === '"' || char === "'")) {
				inString = true;
				stringChar = char;
				continue;
			}

			if (inString) {
				if (char === stringChar && prevChar !== '\\') {
					inString = false;
					stringChar = '';
				}
				continue;
			}

			if (char === '(') parenCount++;
			else if (char === ')') parenCount--;
			else if (char === '[') bracketCount++;
			else if (char === ']') bracketCount--;
			else if (char === '{') braceCount++;
			else if (char === '}') braceCount--;
			else if (
				char === ',' &&
				parenCount === 0 &&
				bracketCount === 0 &&
				braceCount === 0
			) {
				paramIndex++;
			}
		}

		return paramIndex;
	}

	createSignatureInformation(func, isUserFunction = false) {
		const parameters = func.parameters || [];
		const paramLabels = parameters.map((p) => {
			const optional = p.optional ? '?' : '';
			const type = p.type || 'any';
			return `${p.name}${optional}: ${type}`;
		});

		const returnType = func.returnType || 'any';
		const label = `${func.name}(${paramLabels.join(', ')}) → ${returnType}`;

		const parameterInfos = parameters.map((param, index) => {
			const paramStartIndex = label.indexOf(param.name);
			return {
				label: [paramStartIndex, paramStartIndex + param.name.length],
				documentation: {
					value: param.description || 'No description available',
				},
			};
		});

		let documentation = func.description || 'No description available';
		if (isUserFunction) {
			documentation = `**User Function**\n\n${documentation}`;
		}

		return {
			label: label,
			documentation: {
				value: documentation,
			},
			parameters: parameterInfos,
		};
	}

	getCurrentFunctionInfo(model, position) {
		const text = model.getValue();
		const offset = model.getOffsetAt(position);
		const functionCall = this.findCurrentFunctionCall(text, offset);

		if (!functionCall) return null;

		// Check built-in functions first
		let func = gmlDefinitionsParser.getFunction(functionCall.functionName);

		// If not found, check user-defined functions
		if (!func && window.definitions) {
			const userFunc = window.definitions.findDefinition(
				functionCall.functionName
			);
			if (userFunc && userFunc.parameters) {
				func = {
					name: userFunc.name,
					parameters: userFunc.parameters || [],
					signature: this.buildUserFunctionSignature(userFunc),
				};
			}
		}

		if (!func) return null;

		const activeParameter = this.calculateActiveParameter(
			functionCall.parametersText,
			functionCall.currentPosition
		);

		return {
			functionName: func.name,
			parameters: func.parameters || [],
			activeParameter: activeParameter,
			signature: func.signature || func.name + '()',
		};
	}

	buildUserFunctionSignature(userFunc) {
		const parameters = userFunc.parameters || [];
		const paramNames = parameters.map((p) => `${p.name}: ${p.type || 'any'}`);
		return `${userFunc.name}(${paramNames.join(', ')})`;
	}
}

export default new GMLSignatureHelpProvider();
