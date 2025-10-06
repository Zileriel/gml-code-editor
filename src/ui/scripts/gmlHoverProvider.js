import gmlDefinitionsParser from './gmlDefinitionsParser.js';
import gmlLanguage from './gmlLanguage.js';

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

	/**
	 * Update asset information for hover provider
	 * @param {Object} assets - Asset data from the main process
	 */
	updateAssets(assets) {
		// Assets are managed by gmlLanguage, we just need to ensure it's updated
		// This method exists for consistency with other providers
	}

	provideHover(model, position, token) {
		const word = model.getWordAtPosition(position);
		if (!word) return null;

		const identifier = word.word;

		// Check for user-defined symbols
		if (window.definitions) {
			const userSymbol = window.definitions.findDefinition(identifier);
			if (userSymbol) {
				return this.createUserSymbolHover(userSymbol);
			}
		}

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

		// Check for assets
		if (gmlLanguage.assetNames.has(identifier)) {
			return this.createAssetHover(identifier);
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
							p.description || ''
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

	createUserSymbolHover(symbol) {
		const contents = [];

		// Determine symbol type
		let symbolType = 'Symbol';
		if (symbol.content) {
			if (symbol.content.startsWith('#macro')) symbolType = 'Macro';
			else if (symbol.content.startsWith('enum')) symbolType = 'Enum';
			else if (symbol.content.startsWith('function')) symbolType = 'Function';
		}

		// Enhanced function hover
		if (symbolType === 'Function' && symbol.parameters) {
			// Create function signature
			const parameters = symbol.parameters || [];
			const paramLabels = parameters.map((p) => {
				const type = p.type || 'any';
				return `${p.name}: ${type}`;
			});

			const returnType = symbol.returnType || 'any';
			const signature = `**${symbol.name}**(${paramLabels.join(
				', '
			)}) → ${returnType}`;
			contents.push({ value: signature });

			// Add description if available
			if (symbol.description) {
				contents.push({ value: symbol.description });
			}

			// Add parameter documentation
			if (parameters.length > 0) {
				const paramDocs = parameters
					.map(
						(p) =>
							`• **${p.name}** (${p.type || 'any'}): ${
								p.description || 'No description'
							}`
					)
					.join('\n\n');
				contents.push({
					value: `**Parameters:**\n\n${paramDocs}`,
				});
			}

			// Add return information
			if (symbol.returnDescription) {
				contents.push({
					value: `**Returns:** ${symbol.returnDescription}`,
				});
			}

			// Show location
			if (symbol.location) {
				const location = symbol.location.assetName
					? `${symbol.location.assetName}${
							symbol.location.eventName ? ` (${symbol.location.eventName})` : ''
					  }`
					: `${symbol.location.file || 'unknown'}:${symbol.location.line || 0}`;
				contents.push({
					value: `*Defined in: ${location}*`,
					isTrusted: true,
				});
			}
		} else {
			// Standard symbol hover
			if (symbol.content) {
				contents.push({
					value: `\`\`\`gml\n${symbol.content}\n\`\`\``,
					isTrusted: true,
				});
			}
		}

		// Add go-to-definition action hint
		contents.push({
			value: `*Ctrl+Click to go to definition*`,
			isTrusted: true,
		});

		return {
			contents: contents,
		};
	}

	createAssetHover(assetName) {
		const contents = [];

		let assetType = 'Asset';
		let spriteObject = null;

		if (window.assets) {
			const assets = window.assets.getAssets();
			if (assets.objects?.includes(assetName)) assetType = 'Object';
			else if (assets.sprites?.find((sprite) => sprite.name === assetName)) {
				assetType = 'Sprite';
				spriteObject = assets.sprites.find(
					(sprite) => sprite.name === assetName
				);
			} else if (assets.sounds?.includes(assetName)) assetType = 'Sound';
			else if (assets.paths?.includes(assetName)) assetType = 'Path';
			else if (assets.rooms?.includes(assetName)) assetType = 'Room';
			else if (assets.sequences?.includes(assetName)) assetType = 'Sequence';
			else if (assets.shaders?.includes(assetName)) assetType = 'Shader';
			else if (assets.tilesets?.includes(assetName)) assetType = 'Tileset';
			else if (assets.fonts?.includes(assetName)) assetType = 'Font';
			else if (assets.timelines?.includes(assetName)) assetType = 'Timeline';
		}

		const signature = `**${assetName}** - ${assetType} Asset`;
		contents.push({ value: signature });

		if (assetType === 'Sprite' && spriteObject?.path) {
			const resizedUrl = `${spriteObject.path}?size=128`;
			contents.push({
				value: `![Sprite Preview](${resizedUrl} "Sprite: ${assetName}")`,
				isTrusted: true,
			});
		}

		const description = `Project asset reference. Use this identifier to reference the ${assetType.toLowerCase()} in your code.`;
		contents.push({ value: description });

		return {
			contents: contents,
		};
	}
}

export default new GMLHoverProvider();
