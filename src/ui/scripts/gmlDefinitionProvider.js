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

		// Definition providers should return locations for Monaco to handle,
		// not open files directly. File opening should only happen on explicit
		// user actions like Ctrl+Click or code actions.

		return null; // We handle go-to-definition via Ctrl+Click and code actions instead
	}
}

export default new GMLDefinitionProvider();
