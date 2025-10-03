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
		console.log('Code Actions Provider called!');
		console.log('Range:', range);
		console.log('Context:', context);
		console.log('Markers:', context.markers);
		
		const actions = [];
		
		// Get markers that intersect with the range
		const markers = context.markers || [];
		console.log('Processing', markers.length, 'markers');
		
		for (const marker of markers) {
			console.log('Marker:', marker);
			// Only handle markers with our codes (no owner check needed as we control the codes)
			
			switch (marker.code) {
				case 'missing-semicolon':
					actions.push({
						title: 'Add semicolon',
						kind: 'quickfix',
						edit: {
							edits: [{
								resource: model.uri,
								textEdit: {
									range: {
										startLineNumber: marker.endLineNumber,
										startColumn: marker.endColumn,
										endLineNumber: marker.endLineNumber,
										endColumn: marker.endColumn
									},
									text: ';'
								}
							}]
						},
						isPreferred: true
					});
					break;
					
				case 'double-semicolon':
					actions.push({
						title: 'Remove extra semicolon',
						kind: 'quickfix',
						edit: {
							edits: [{
								resource: model.uri,
								textEdit: {
									range: {
										startLineNumber: marker.startLineNumber,
										startColumn: marker.startColumn + 1, // Keep first semicolon
										endLineNumber: marker.endLineNumber,
										endColumn: marker.endColumn
									},
									text: ''
								}
							}]
						},
						isPreferred: true
					});
					break;
					
				case 'invalid-operator':
					// Get the invalid operator text
					const invalidOp = model.getValueInRange({
						startLineNumber: marker.startLineNumber,
						startColumn: marker.startColumn,
						endLineNumber: marker.endLineNumber,
						endColumn: marker.endColumn
					});
					
					let suggestions = [];
					if (invalidOp === '===' || invalidOp === '!==') {
						suggestions = invalidOp.startsWith('!') ? ['!=', '=='] : ['==', '!='];
					} else if (invalidOp === '<==' || invalidOp === '>==') {
						suggestions = invalidOp.startsWith('<') ? ['<=', '<'] : ['>=', '>'];
					}
					
					suggestions.forEach((suggestion, index) => {
						actions.push({
							title: `Change to '${suggestion}'`,
							kind: 'quickfix',
							edit: {
								edits: [{
									resource: model.uri,
									textEdit: {
										range: {
											startLineNumber: marker.startLineNumber,
											startColumn: marker.startColumn,
											endLineNumber: marker.endLineNumber,
											endColumn: marker.endColumn
										},
										text: suggestion
									}
								}]
							},
							isPreferred: index === 0
						});
					});
					break;
					
				case 'unclosed-paren':
				case 'unclosed-bracket':
				case 'unclosed-brace':
					const closingChar = marker.code === 'unclosed-paren' ? ')' : 
									   marker.code === 'unclosed-bracket' ? ']' : '}';
					const typeName = marker.code.replace('unclosed-', '');
					const lastLine = model.getLineCount();
					const lastColumn = model.getLineMaxColumn(lastLine);
									   
					actions.push({
						title: `Add closing ${typeName}`,
						kind: 'quickfix',
						edit: {
							edits: [{
								resource: model.uri,
								textEdit: {
									range: {
										startLineNumber: lastLine,
										startColumn: lastColumn,
										endLineNumber: lastLine,
										endColumn: lastColumn
									},
									text: closingChar
								}
							}]
						},
						isPreferred: true
					});
					break;
			}
		}
		
		return { actions, dispose: () => {} };
	}
}

export default new GMLCodeActionsProvider();