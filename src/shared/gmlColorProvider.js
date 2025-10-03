class GMLColorProvider {
	constructor() {
		this.initialized = false;

		this.gmlColors = {
			c_aqua: { r: 0, g: 255, b: 255 },
			c_black: { r: 0, g: 0, b: 0 },
			c_blue: { r: 0, g: 0, b: 255 },
			c_dkgray: { r: 64, g: 64, b: 64 },
			c_fuchsia: { r: 255, g: 0, b: 255 },
			c_gray: { r: 128, g: 128, b: 128 },
			c_green: { r: 0, g: 128, b: 0 },
			c_lime: { r: 0, g: 255, b: 0 },
			c_ltgray: { r: 192, g: 192, b: 192 },
			c_maroon: { r: 128, g: 0, b: 0 },
			c_navy: { r: 0, g: 0, b: 128 },
			c_olive: { r: 128, g: 128, b: 0 },
			c_orange: { r: 255, g: 165, b: 0 },
			c_purple: { r: 128, g: 0, b: 128 },
			c_red: { r: 255, g: 0, b: 0 },
			c_silver: { r: 192, g: 192, b: 192 },
			c_teal: { r: 0, g: 128, b: 128 },
			c_white: { r: 255, g: 255, b: 255 },
			c_yellow: { r: 255, g: 255, b: 0 },

			// Common variations
			c_ltgrey: { r: 192, g: 192, b: 192 },
			c_dkgrey: { r: 64, g: 64, b: 64 },
			c_grey: { r: 128, g: 128, b: 128 },
		};

		this.hexColorRegex = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;
		this.gmlColorRegex = /\b(c_[a-zA-Z]+)\b/g;
	}

	async initialize() {
		if (!this.initialized) {
			this.initialized = true;
		}
	}

	/**
	 * Provide color information for Monaco Editor
	 * @param {*} model Monaco model
	 * @param {*} token Cancellation token
	 * @returns Array of color information
	 */
	provideDocumentColors(model, token) {
		const colors = [];
		const text = model.getValue();

		const hexMatches = [...text.matchAll(this.hexColorRegex)];
		for (const match of hexMatches) {
			const colorValue = match[1];
			const color = this.parseHexColor(colorValue);
			if (color) {
				const startPos = model.getPositionAt(match.index);
				const endPos = model.getPositionAt(match.index + match[0].length);

				colors.push({
					color: color,
					range: {
						startLineNumber: startPos.lineNumber,
						startColumn: startPos.column,
						endLineNumber: endPos.lineNumber,
						endColumn: endPos.column,
					},
				});
			}
		}

		const gmlMatches = [...text.matchAll(this.gmlColorRegex)];
		for (const match of gmlMatches) {
			const colorName = match[1].toLowerCase();
			const color = this.gmlColors[colorName];
			if (color) {
				const startPos = model.getPositionAt(match.index);
				const endPos = model.getPositionAt(match.index + match[0].length);

				colors.push({
					color: {
						red: color.r / 255,
						green: color.g / 255,
						blue: color.b / 255,
						alpha: 1,
					},
					range: {
						startLineNumber: startPos.lineNumber,
						startColumn: startPos.column,
						endLineNumber: endPos.lineNumber,
						endColumn: endPos.column,
					},
				});
			}
		}

		return colors;
	}

	/**
	 * Provide color presentation options
	 * @param {*} model Monaco model
	 * @param {*} colorInfo Color information
	 * @param {*} token Cancellation token
	 * @returns Array of color presentations
	 */
	provideColorPresentations(model, colorInfo, token) {
		const { color, range } = colorInfo;
		const currentText = model.getValueInRange(range);

		const presentations = [];

		const r = Math.round(color.red * 255);
		const g = Math.round(color.green * 255);
		const b = Math.round(color.blue * 255);

		const hexColor = `#${r.toString(16).padStart(2, '0')}${g
			.toString(16)
			.padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

		if (currentText.startsWith('#')) {
			presentations.push({ label: hexColor.toUpperCase() });
			presentations.push({ label: hexColor.toLowerCase() });

			const shortHex = this.toShortHex(hexColor);
			if (shortHex !== hexColor) {
				presentations.push({ label: shortHex.toUpperCase() });
				presentations.push({ label: shortHex.toLowerCase() });
			}
		}

		if (currentText.startsWith('c_')) {
			for (const [colorName, colorValue] of Object.entries(this.gmlColors)) {
				if (colorValue.r === r && colorValue.g === g && colorValue.b === b) {
					presentations.unshift({ label: colorName });
					break;
				}
			}

			presentations.push({ label: hexColor.toUpperCase() });
		} else {
			for (const [colorName, colorValue] of Object.entries(this.gmlColors)) {
				if (colorValue.r === r && colorValue.g === g && colorValue.b === b) {
					presentations.push({ label: colorName });
					break;
				}
			}
		}

		return presentations;
	}

	/**
	 * Parse hex color string to Monaco color format
	 * @param {string} hex Hex color value (without #)
	 * @returns Monaco color object or null
	 */
	parseHexColor(hex) {
		let normalizedHex = hex;

		if (hex.length === 3) {
			normalizedHex = hex
				.split('')
				.map((char) => char + char)
				.join('');
		}

		if (normalizedHex.length !== 6) {
			return null;
		}

		const r = parseInt(normalizedHex.substr(0, 2), 16);
		const g = parseInt(normalizedHex.substr(2, 2), 16);
		const b = parseInt(normalizedHex.substr(4, 2), 16);

		if (isNaN(r) || isNaN(g) || isNaN(b)) {
			return null;
		}

		return {
			red: r / 255,
			green: g / 255,
			blue: b / 255,
			alpha: 1,
		};
	}

	/**
	 * Convert hex color to short format if possible
	 * @param {string} hex Full hex color (#rrggbb)
	 * @returns Short hex color (#rgb) or original if not possible
	 */
	toShortHex(hex) {
		if (hex.length !== 7 || !hex.startsWith('#')) {
			return hex;
		}

		const r = hex.substr(1, 2);
		const g = hex.substr(3, 2);
		const b = hex.substr(5, 2);

		if (r[0] === r[1] && g[0] === g[1] && b[0] === b[1]) {
			return `#${r[0]}${g[0]}${b[0]}`;
		}

		return hex;
	}
}

export default new GMLColorProvider();
