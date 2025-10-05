class GMLCodeActionsProvider {
	constructor() {
		this.initialized = false;
	}

	async initialize() {
		if (!this.initialized) {
			this.initialized = true;
		}
	}

	provideCodeActions(model, range, context, token) {
		const actions = [];
		const markers = context.markers || [];

		// Add go-to-definition action for user-defined symbols
		const startPosition = {
			lineNumber: range.startLineNumber,
			column: range.startColumn,
		};
		const word = model.getWordAtPosition(startPosition);

		if (word && window.definitions) {
			const symbol = window.definitions.findDefinition(word.word);
			if (symbol) {
				actions.push({
					title: `Go to definition of '${symbol.name}'`,
					kind: 'refactor.navigate',
					diagnostics: [],
					isPreferred: false,
					edit: {
						edits: [],
					},
					command: {
						id: 'gml.goToDefinition',
						title: `Go to definition of '${symbol.name}'`,
						arguments: [symbol],
					},
				});
			}
		}

		for (const marker of markers) {
			switch (marker.code) {
				case 'missing-semicolon':
					actions.push({
						title: 'Add semicolon',
						kind: 'quickfix',
						edit: {
							edits: [
								{
									resource: model.uri,
									textEdit: {
										range: {
											startLineNumber: marker.endLineNumber,
											startColumn: marker.endColumn,
											endLineNumber: marker.endLineNumber,
											endColumn: marker.endColumn,
										},
										text: ';',
									},
								},
							],
						},
						isPreferred: true,
					});
					break;

				case 'double-semicolon':
					actions.push({
						title: 'Remove extra semicolon',
						kind: 'quickfix',
						edit: {
							edits: [
								{
									resource: model.uri,
									textEdit: {
										range: {
											startLineNumber: marker.startLineNumber,
											startColumn: marker.startColumn + 1,
											endLineNumber: marker.endLineNumber,
											endColumn: marker.endColumn,
										},
										text: '',
									},
								},
							],
						},
						isPreferred: true,
					});
					break;

				case 'invalid-operator':
					const invalidOp = model.getValueInRange({
						startLineNumber: marker.startLineNumber,
						startColumn: marker.startColumn,
						endLineNumber: marker.endLineNumber,
						endColumn: marker.endColumn,
					});

					let suggestions = [];
					if (invalidOp === '===' || invalidOp === '!==') {
						suggestions = invalidOp.startsWith('!')
							? ['!=', '==']
							: ['==', '!='];
					} else if (invalidOp === '<==' || invalidOp === '>==') {
						suggestions = invalidOp.startsWith('<') ? ['<=', '<'] : ['>=', '>'];
					}

					suggestions.forEach((suggestion, index) => {
						actions.push({
							title: `Change to '${suggestion}'`,
							kind: 'quickfix',
							edit: {
								edits: [
									{
										resource: model.uri,
										textEdit: {
											range: {
												startLineNumber: marker.startLineNumber,
												startColumn: marker.startColumn,
												endLineNumber: marker.endLineNumber,
												endColumn: marker.endColumn,
											},
											text: suggestion,
										},
									},
								],
							},
							isPreferred: index === 0,
						});
					});
					break;

				case 'unclosed-paren':
				case 'unclosed-bracket':
				case 'unclosed-brace':
					const closingChar =
						marker.code === 'unclosed-paren'
							? ')'
							: marker.code === 'unclosed-bracket'
							? ']'
							: '}';
					const typeName = marker.code.replace('unclosed-', '');
					const lastLine = model.getLineCount();
					const lastColumn = model.getLineMaxColumn(lastLine);

					actions.push({
						title: `Add closing ${typeName}`,
						kind: 'quickfix',
						edit: {
							edits: [
								{
									resource: model.uri,
									textEdit: {
										range: {
											startLineNumber: lastLine,
											startColumn: lastColumn,
											endLineNumber: lastLine,
											endColumn: lastColumn,
										},
										text: closingChar,
									},
								},
							],
						},
						isPreferred: true,
					});
					break;
			}
		}

		return { actions, dispose: () => {} };
	}
}

export default new GMLCodeActionsProvider();
