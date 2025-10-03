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

		const func = gmlDefinitionsParser.getFunction(functionCall.functionName);
		if (!func) return null;

		const signature = this.createSignatureInformation(func);
		const activeParameter = this.calculateActiveParameter(
			functionCall.parametersText,
			functionCall.currentPosition
		);

		return {
			signatures: [signature],
			activeSignature: 0,
			activeParameter: Math.min(activeParameter, func.parameters.length - 1),
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

	createSignatureInformation(func) {
		const paramLabels = func.parameters.map((p) => {
			const optional = p.optional ? '?' : '';
			return `${p.name}${optional}: ${p.type}`;
		});

		const label = `${func.name}(${paramLabels.join(', ')}) → ${
			func.returnType
		}`;

		const parameters = func.parameters.map((param, index) => ({
			label: [
				label.indexOf(param.name),
				label.indexOf(param.name) + param.name.length,
			],
			documentation: {
				value: param.description || 'No description available',
			},
		}));

		return {
			label: label,
			documentation: {
				value: func.description || 'No description available',
			},
			parameters: parameters,
		};
	}

	getCurrentFunctionInfo(model, position) {
		const text = model.getValue();
		const offset = model.getOffsetAt(position);
		const functionCall = this.findCurrentFunctionCall(text, offset);

		if (!functionCall) return null;

		const func = gmlDefinitionsParser.getFunction(functionCall.functionName);
		if (!func) return null;

		const activeParameter = this.calculateActiveParameter(
			functionCall.parametersText,
			functionCall.currentPosition
		);

		return {
			functionName: func.name,
			parameters: func.parameters,
			activeParameter: activeParameter,
			signature: func.signature,
		};
	}
}

export default new GMLSignatureHelpProvider();
