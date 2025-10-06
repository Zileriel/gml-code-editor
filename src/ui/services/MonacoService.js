import loader from '@monaco-editor/loader';
import gmlLanguage from '../scripts/gmlLanguage.js';
import gmlCompletionProvider from '../scripts/gmlCompletionProvider.js';
import gmlHoverProvider from '../scripts/gmlHoverProvider.js';
import gmlSignatureHelpProvider from '../scripts/gmlSignatureHelpProvider.js';
import gmlColorProvider from '../scripts/gmlColorProvider.js';
import gmlLintingProvider from '../scripts/gmlLintingProvider.js';
import gmlCodeActionsProvider from '../scripts/gmlCodeActionsProvider.js';
import gmlDefinitionProvider from '../scripts/gmlDefinitionProvider.js';
import gmlTheme from '../scripts/gmlTheme.js';

class MonacoService {
	constructor() {
		this.isInitialized = false;
		this.isInitializing = false;
		this.initPromise = null;
	}

	async initialize() {
		if (this.isInitialized) {
			return;
		}

		if (this.isInitializing) {
			return this.initPromise;
		}

		this.isInitializing = true;
		console.log('MonacoService: Starting initialization');

		this.initPromise = this._doInitialize();
		return this.initPromise;
	}

	async _doInitialize() {
		try {
			// Load Monaco
			const monaco = await loader.init();
			console.log('MonacoService: Monaco loaded');

			// Set window.monaco for global access
			window.monaco = monaco;

			// Define theme globally
			if (!window.gmlThemeDefined) {
				monaco.editor.defineTheme('gml-theme', gmlTheme);
				window.gmlThemeDefined = true;
				console.log('MonacoService: GML theme defined');
			}

			// Register GML language
			if (!window.gmlLanguageRegistered) {
				monaco.languages.register({ id: 'gml' });
				window.gmlLanguageRegistered = true;
				console.log('MonacoService: GML language registered');
			}

			// Initialize GML language support
			await gmlLanguage.initialize();

			// Set GML language tokenizer
			if (!window.gmlTokenizerSet) {
				monaco.languages.setMonarchTokensProvider(
					'gml',
					gmlLanguage.getMonarchDefinition()
				);
				window.gmlTokenizerSet = true;
				console.log('MonacoService: GML tokenizer set');
			}

			await gmlCompletionProvider.initialize();
			await gmlHoverProvider.initialize();
			await gmlSignatureHelpProvider.initialize();
			await gmlColorProvider.initialize();
			await gmlLintingProvider.initialize();
			await gmlCodeActionsProvider.initialize();
			await gmlDefinitionProvider.initialize();

			console.log('MonacoService: All GML providers initialized');

			this.isInitialized = true;
			this.isInitializing = false;

			console.log('MonacoService: Initialization complete');
		} catch (error) {
			console.error('MonacoService: Initialization failed:', error);
			this.isInitializing = false;
			throw error;
		}
	}

	isReady() {
		return this.isInitialized && window.monaco;
	}
}

// Export singleton instance
export default new MonacoService();
