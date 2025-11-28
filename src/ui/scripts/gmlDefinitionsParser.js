class GMLDefinitionsParser {
	constructor() {
		this.functions = new Map();
		this.variables = new Map();
		this.constants = new Map();
		this.enumerations = new Map();

		this.parsed = false;
	}

	async loadDefinitions() {
		if (this.parsed) return;

		try {
			const response = await fetch('./definitions.xml');
			const xmlText = await response.text();
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

			this.parseFunctions(xmlDoc);
			this.parseVariables(xmlDoc);
			this.parseConstants(xmlDoc);
			this.parseEnumerations(xmlDoc);

			this.parsed = true;
		} catch (error) {
			console.error('Failed to load GML definitions:', error);
		}
	}

	parseFunctions(xmlDoc) {
		const functions = xmlDoc.querySelectorAll('Functions > Function');

		functions.forEach((func) => {
			const name = func.getAttribute('Name');
			const returnType = func.getAttribute('ReturnType');
			const deprecated = func.getAttribute('Deprecated') === 'true';
			const pure = func.getAttribute('Pure') === 'true';

			const description =
				func.querySelector('Description')?.textContent?.trim() || '';
			const parameters = Array.from(func.querySelectorAll('Parameter')).map(
				(param) => ({
					name: param.getAttribute('Name'),
					type: param.getAttribute('Type'),
					optional: param.getAttribute('Optional') === 'true',
					description: param.textContent?.trim() || '',
				})
			);

			this.functions.set(name, {
				name,
				returnType,
				deprecated,
				pure,
				description,
				parameters,
				signature: this.buildFunctionSignature(name, parameters),
			});
		});
	}

	parseVariables(xmlDoc) {
		const variables = xmlDoc.querySelectorAll('Variables > Variable');

		variables.forEach((variable) => {
			const name = variable.getAttribute('Name');
			const type = variable.getAttribute('Type');
			const deprecated = variable.getAttribute('Deprecated') === 'true';
			const canGet = variable.getAttribute('Get') === 'true';
			const canSet = variable.getAttribute('Set') === 'true';
			const isInstance = variable.getAttribute('Instance') === 'true';
			const description = variable.textContent?.trim() || '';

			this.variables.set(name, {
				name,
				type,
				deprecated,
				canGet,
				canSet,
				isInstance,
				description,
			});
		});
	}

	parseConstants(xmlDoc) {
		const constants = xmlDoc.querySelectorAll('Constants > Constant');

		constants.forEach((constant) => {
			const name = constant.getAttribute('Name');
			const type = constant.getAttribute('Type');
			const deprecated = constant.getAttribute('Deprecated') === 'true';
			const className = constant.getAttribute('Class');
			const description = constant.textContent?.trim() || '';

			this.constants.set(name, {
				name,
				type,
				deprecated,
				className,
				description,
			});
		});
	}

	parseEnumerations(xmlDoc) {
		const enumerations = xmlDoc.querySelectorAll('Enumerations > Enumeration');

		enumerations.forEach((enumeration) => {
			const name = enumeration.getAttribute('Name');
			const members = Array.from(enumeration.querySelectorAll('Member')).map(
				(member) => ({
					name: member.getAttribute('Name'),
					value: member.getAttribute('Value'),
					deprecated: member.getAttribute('Deprecated') === 'true',
					description: member.textContent?.trim() || '',
				})
			);

			this.enumerations.set(name, {
				name,
				members,
			});

			// Also add individual enum members as constants
			members.forEach((member) => {
				const fullName = `${name}.${member.name}`;
				this.constants.set(fullName, {
					name: fullName,
					type: 'Real',
					deprecated: member.deprecated,
					className: name,
					description: member.description,
					enumValue: member.value,
				});
			});
		});
	}

	buildFunctionSignature(name, parameters) {
		const paramStrings = parameters.map((param) => {
			const optional = param.optional ? '?' : '';
			return `${param.name}${optional}: ${param.type}`;
		});

		return `${name}(${paramStrings.join(', ')})`;
	}

	getFunctions() {
		return Array.from(this.functions.values());
	}

	getVariables() {
		return Array.from(this.variables.values());
	}

	getConstants() {
		return Array.from(this.constants.values());
	}

	getEnumerations() {
		return Array.from(this.enumerations.values());
	}

	getFunction(name) {
		return this.functions.get(name);
	}

	getVariable(name) {
		return this.variables.get(name);
	}

	getConstant(name) {
		return this.constants.get(name);
	}

	getAllCompletionItems() {
		const items = [];

		// Add functions
		this.functions.forEach((func) => {
			if (!func.deprecated) {
				items.push({
					label: func.name,
					kind: 'Function',
					detail: func.signature,
					documentation: func.description,
					insertText: func.name + '(${0})',
					type: 'function',
				});
			}
		});

		// Add variables
		this.variables.forEach((variable) => {
			if (!variable.deprecated) {
				items.push({
					label: variable.name,
					kind: 'Variable',
					detail: `${variable.type} - ${
						variable.isInstance ? 'Instance' : 'Global'
					}`,
					documentation: variable.description,
					insertText: variable.name,
					type: 'variable',
				});
			}
		});

		// Add constants
		this.constants.forEach((constant) => {
			if (!constant.deprecated && constant.name !== '$$implicit_argument$$') {
				items.push({
					label: constant.name,
					kind: 'Constant',
					detail:
						constant.type +
						(constant.className ? ` (${constant.className})` : ''),
					documentation: constant.description,
					insertText: constant.name,
					type: constant.className == 'Color' ? 'color' : 'constant',
				});
			}
		});

		return items;
	}
}

export default new GMLDefinitionsParser();
