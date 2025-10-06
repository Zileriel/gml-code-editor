class GMLDefinitionProvider {
	constructor() {
		this.initialized = false;
	}

	async initialize() {
		if (!this.initialized) {
			this.initialized = true;
		}
	}

	provideDefinition(model, position, token) {
		const word = model.getWordAtPosition(position);
		if (!word) {
			return null;
		}

		const identifier = word.word;

		let symbol = null;
		if (window.definitions) {
			symbol = window.definitions.findDefinition(identifier);
		}

		if (!symbol) {
			return null;
		}

		return null;
	}
}

export default new GMLDefinitionProvider();
