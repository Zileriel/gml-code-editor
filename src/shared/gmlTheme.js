const GMLTheme = {
	base: 'vs-dark',
	inherit: true,
	rules: [
		// Keywords
		{ token: 'keyword', foreground: 'FFB871' },
		{ token: 'keyword.preprocessor', foreground: 'FFB871' },

		// Atoms
		{ token: 'atom', foreground: 'FF8080' },

		// Variables
		{ token: 'variable.declaration', foreground: 'B2B1FF' },
		{ token: 'variable.global', foreground: 'B2B1FF' },
		{ token: 'variable.local', foreground: 'FFFF99' },
		{ token: 'variable.parameter', foreground: 'FFFF99' },
		{ token: 'identifier', foreground: 'B2B1FF' },

		// Built-in variables
		{ token: 'variable.builtin', foreground: '58E55A' },

		// Functions
		{ token: 'function.definition', foreground: 'FFB871' },
		{ token: 'function.call', foreground: 'FFB871' },
		{ token: 'function.builtin', foreground: 'FFB871' },

		// Built-in constants
		{ token: 'constant.builtin', foreground: 'FF8080' },

		// Enum properties
		{ token: 'enum.name', foreground: 'FF8080' },
		{ token: 'enum.member', foreground: 'FF8080' },

		// Operators
		{ token: 'operator', foreground: 'C0C0C0' },

		// Strings
		{ token: 'string', foreground: 'FFFF00' },
		{ token: 'string.quote', foreground: 'FFFF00' },
		{ token: 'string.escape', foreground: 'FFFF00' },
		{ token: 'string.invalid', foreground: 'FF0000', fontStyle: 'underline' },

		// Numbers
		{ token: 'number', foreground: 'FF8080' },
		{ token: 'number.float', foreground: 'FF8080' },
		{ token: 'number.hex', foreground: 'FF8080' },

		// Comments
		{ token: 'comment', foreground: '5B995B', fontStyle: 'italic' },

		// Punctuation
		{ token: 'delimiter', foreground: 'C0C0C0' },
		{ token: '@brackets', foreground: 'C0C0C0' },

		// Default text
		{ token: '', foreground: 'C0C0C0' },
	],
	colors: {
		'editor.background': '#1e1e1e',
		'editor.foreground': '#d4d4d4',
		'editor.lineHighlightBackground': '#2d2d30',
		'editor.selectionBackground': '#264f78',
		'editorCursor.foreground': '#ffffff',
		'editorWhitespace.foreground': '#404040',
		'editorLineNumber.foreground': '#858585',
		'editorLineNumber.activeForeground': '#c6c6c6',
	},
};

export default GMLTheme;
