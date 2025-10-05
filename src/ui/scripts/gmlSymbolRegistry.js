import gmlLanguage from './gmlLanguage.js';
import gmlCompletionProvider from './gmlCompletionProvider.js';

class GMLSymbolRegistry {
	constructor() {
		this.symbols = new Map();
		this.symbolsByFile = new Map();
		this.projectAssets = new Map();
	}

	clear() {
		this.symbols.clear();
		this.symbolsByFile.clear();
	}

	addSymbol(name, type, location, content) {
		const symbol = {
			name,
			type,
			location: {
				file: location.file,
				line: location.line,
				column: location.column,
				assetName: location.assetName,
				eventName: location.eventName,
			},
			content,
		};

		this.symbols.set(name, symbol);

		if (!this.symbolsByFile.has(location.file)) {
			this.symbolsByFile.set(location.file, []);
		}
		this.symbolsByFile.get(location.file).push(symbol);
	}

	getSymbol(name) {
		return this.symbols.get(name);
	}

	getAllSymbols() {
		return Array.from(this.symbols.values());
	}

	getSymbolsByType(type) {
		return Array.from(this.symbols.values()).filter((s) => s.type === type);
	}

	parseScriptFile(scriptAsset) {
		const content = scriptAsset.content;
		if (!content) {
			return;
		}

		const lines = content.split('\n');
		const filePath = `${scriptAsset.name}.gml`;

		lines.forEach((line, index) => {
			const lineNumber = index + 1;

			const macroMatch = line.match(/#macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
			if (macroMatch) {
				this.addSymbol(
					macroMatch[1],
					'macro',
					{
						file: filePath,
						line: lineNumber,
						column: line.indexOf(macroMatch[1]) + 1,
						assetName: scriptAsset.name,
						eventName: null,
					},
					line.trim()
				);
			}

			const enumMatch = line.match(/enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
			if (enumMatch) {
				this.addSymbol(
					enumMatch[1],
					'enum',
					{
						file: filePath,
						line: lineNumber,
						column: line.indexOf(enumMatch[1]) + 1,
						assetName: scriptAsset.name,
						eventName: null,
					},
					line.trim()
				);
			}

			const functionMatch = line.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
			if (functionMatch) {
				this.addSymbol(
					functionMatch[1],
					'function',
					{
						file: filePath,
						line: lineNumber,
						column: line.indexOf(functionMatch[1]) + 1,
						assetName: scriptAsset.name,
						eventName: null,
					},
					line.trim()
				);
			}
		});
	}

	parseObjectFile(objectAsset) {
		if (!objectAsset.events) return;

		objectAsset.events.forEach((event) => {
			const content = event.content;
			if (!content) return;

			const lines = content.split('\n');
			const filePath = `${objectAsset.name}_${event.name}`;

			lines.forEach((line, index) => {
				const lineNumber = index + 1;

				const macroMatch = line.match(/#macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
				if (macroMatch) {
					this.addSymbol(
						macroMatch[1],
						'macro',
						{
							file: filePath,
							line: lineNumber,
							column: line.indexOf(macroMatch[1]) + 1,
							assetName: objectAsset.name,
							eventName: event.name,
						},
						line.trim()
					);
				}

				const enumMatch = line.match(/enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
				if (enumMatch) {
					this.addSymbol(
						enumMatch[1],
						'enum',
						{
							file: filePath,
							line: lineNumber,
							column: line.indexOf(enumMatch[1]) + 1,
							assetName: objectAsset.name,
							eventName: event.name,
						},
						line.trim()
					);
				}

				const functionMatch = line.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
				if (functionMatch) {
					this.addSymbol(
						functionMatch[1],
						'function',
						{
							file: filePath,
							line: lineNumber,
							column: line.indexOf(functionMatch[1]) + 1,
							assetName: objectAsset.name,
							eventName: event.name,
						},
						line.trim()
					);
				}
			});
		});
	}

	scanProject(projectData) {
		this.clear();

		if (projectData.assets.scripts) {
			projectData.assets.scripts.forEach((script) => {
				this.projectAssets.set(script.name, script);
				this.parseScriptFile(script);
			});
		}

		if (projectData.assets.objects) {
			projectData.assets.objects.forEach((obj) => {
				this.projectAssets.set(obj.name, obj);
				this.parseObjectFile(obj);
			});
		}

		this.updateProviders();
	}

	updateProviders() {
		const macros = this.getSymbolsByType('macro');
		const enums = this.getSymbolsByType('enum');
		const functions = this.getSymbolsByType('function');

		gmlLanguage.userMacros.clear();
		gmlLanguage.userEnums.clear();

		// Add all symbols
		macros.forEach((macro) => gmlLanguage.addUserMacro(macro.name));
		enums.forEach((enumSym) => gmlLanguage.addUserEnum(enumSym.name));

		// Force tokenizer update to apply syntax highlighting
		gmlLanguage.updateTokenizer(window.monaco);

		// Update completion provider
		gmlCompletionProvider.updateUserSymbols(macros, enums, functions);
	}

	clearRuntimeSymbolsForFile(filePath) {
		const symbolsToRemove = [];
		for (const [name, symbol] of this.symbols.entries()) {
			if (symbol.location.file === filePath) {
				symbolsToRemove.push(name);
			}
		}

		symbolsToRemove.forEach((name) => {
			this.symbols.delete(name);
		});

		if (this.symbolsByFile.has(filePath)) {
			this.symbolsByFile.delete(filePath);
		}
	}

	addRuntimeSymbol(name, type, location, content) {
		this.addSymbol(name, type, location, content);

		if (type === 'macro') {
			gmlLanguage.addUserMacro(name);
		} else if (type === 'enum') {
			gmlLanguage.addUserEnum(name);
		}

		gmlLanguage.updateTokenizer(window.monaco);

		const macros = this.getSymbolsByType('macro');
		const enums = this.getSymbolsByType('enum');
		const functions = this.getSymbolsByType('function');
		gmlCompletionProvider.updateUserSymbols(macros, enums, functions);
	}
}

export default new GMLSymbolRegistry();
