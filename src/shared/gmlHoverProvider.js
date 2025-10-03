import gmlDefinitionsParser from './gmlDefinitionsParser.js';

class GMLHoverProvider {
	constructor() {
		this.initialized = false;
	}

	async initialize() {
		if (!this.initialized) {
			await gmlDefinitionsParser.loadDefinitions();
			this.initialized = true;
		}
	}

	provideHover(model, position, token) {
		const word = model.getWordAtPosition(position);
		if (!word) return null;

		const identifier = word.word;

		// Check for functions
		const func = gmlDefinitionsParser.getFunction(identifier);
		if (func) {
			return this.createFunctionHover(func);
		}

		// Check for variables
		const variable = gmlDefinitionsParser.getVariable(identifier);
		if (variable) {
			return this.createVariableHover(variable);
		}

		// Check for constants
		const constant = gmlDefinitionsParser.getConstant(identifier);
		if (constant) {
			return this.createConstantHover(constant);
		}

		return null;
	}

	createFunctionHover(func) {
		const contents = [];

		const paramList = func.parameters
			.map((p) => {
				const optional = p.optional ? '?' : '';
				return `  ${p.name}${optional}: ${p.type}`;
			})
			.join(',\n');

		const signature =
			func.parameters.length > 0
				? `**${func.name}**(\n${paramList}\n) → ${func.returnType}`
				: `**${func.name}**() → ${func.returnType}`;

		contents.push({ value: signature });

		// Description
		if (func.description) {
			let description = func.description;

			const paramSplit = description.split(/Parameters:\s*/);
			if (paramSplit.length > 1) {
				description = paramSplit[0].trim();
			}

			if (description) {
				contents.push({ value: description });
			}
		}

		// Parameters
		if (func.parameters.length > 0) {
			const paramDocs = func.parameters
				.map(
					(p) =>
						`• **${p.name}** (${p.type}${p.optional ? ', optional' : ''}): ${
							p.description || 'No description'
						}`
				)
				.join('\n\n');

			contents.push({
				value: `**Parameters:**\n\n${paramDocs}`,
			});
		}

		// Additional info
		const info = [];
		if (func.deprecated) info.push('**Deprecated**');
		if (func.pure) info.push('Pure function (no side effects)');

		if (info.length > 0) {
			contents.push({ value: info.join(' • ') });
		}

		return {
			contents: contents,
		};
	}

	createVariableHover(variable) {
		const contents = [];

		// Variable signature
		const access = [];
		if (variable.canGet) access.push('readable');
		if (variable.canSet) access.push('writable');
		const accessStr = access.length > 0 ? ` (${access.join(', ')})` : '';

		const scope = variable.isInstance ? 'Instance' : 'Global';
		const signature = `**${variable.name}**: ${variable.type} - ${scope} variable${accessStr}`;

		contents.push({ value: signature });

		// Description
		if (variable.description) {
			contents.push({ value: variable.description });
		}

		// Additional info
		if (variable.deprecated) {
			contents.push({ value: '**⚠️ Deprecated**' });
		}

		return {
			contents: contents,
		};
	}

	createConstantHover(constant) {
		const contents = [];

		// Constant signature
		let signature = `**${constant.name}**: ${constant.type}`;
		if (constant.className) {
			signature += ` (${constant.className})`;
		}
		if (constant.enumValue !== undefined) {
			signature += ` = ${constant.enumValue}`;
		}

		contents.push({ value: signature });

		// Description
		if (constant.description) {
			contents.push({ value: constant.description });
		}

		// Additional info
		if (constant.deprecated) {
			contents.push({ value: '**⚠️ Deprecated**' });
		}

		return {
			contents: contents,
		};
	}
}

export default new GMLHoverProvider();
