import React, { useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStatus } from '../contexts/EditorStatusContext';
import gmlLanguage from '../../shared/gmlLanguage.js';
import gmlTheme from '../../shared/gmlTheme.js';
import gmlCompletionProvider from '../../shared/gmlCompletionProvider.js';
import gmlHoverProvider from '../../shared/gmlHoverProvider.js';
import gmlSignatureHelpProvider from '../../shared/gmlSignatureHelpProvider.js';
import gmlColorProvider from '../../shared/gmlColorProvider.js';
import gmlDefinitionsParser from '../../shared/gmlDefinitionsParser.js';

let isGmlRegisteredGlobally = false;

const MonacoEditor = ({ tabId, content, language, onContentChange }) => {
	const editorRef = useRef(null);
	const containerRef = useRef(null);
	const resizeObserverRef = useRef(null);
	const { updateEditorStatus } = useEditorStatus();

	React.useEffect(() => {
		if (editorRef.current && containerRef.current) {
			containerRef.current._monacoEditor = editorRef.current;
		}
		return () => {
			if (containerRef.current) {
				delete containerRef.current._monacoEditor;
			}
		};
	}, []);

	useEffect(() => {
		if (!containerRef.current) return;

		const handleResize = () => {
			if (editorRef.current) {
				editorRef.current.layout();
			}
		};

		resizeObserverRef.current = new ResizeObserver(handleResize);
		resizeObserverRef.current.observe(containerRef.current);

		return () => {
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect();
			}
		};
	}, []);

	useEffect(() => {
		if (editorRef.current) {
			const model = editorRef.current.getModel();
			const monacoLanguage = getMonacoLanguage(language);

			if (model && model.getLanguageId() !== monacoLanguage) {
				const monaco = window.monaco;
				if (monaco) {
					monaco.editor.setModelLanguage(model, monacoLanguage);

					if (monacoLanguage === 'gml') {
						setTimeout(() => {
							monaco.editor.setTheme('gml-theme');
							editorRef.current.updateOptions({ theme: 'gml-theme' });
						}, 50);
					}
				}
			}
		}
	}, [language]);

	const handleEditorChange = useCallback(
		(value) => {
			if (onContentChange) {
				onContentChange(tabId, value);
			}
		},
		[tabId, onContentChange]
	);

	const editorOptions = {
		minimap: { enabled: true },
		fontSize: 14,
		fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
		lineNumbers: 'on',
		roundedSelection: false,
		scrollBeyondLastLine: false,
		automaticLayout: true,
		theme: 'gml-theme',
		wordWrap: 'off',
		tabSize: 4,
		insertSpaces: false,
		detectIndentation: false,
		folding: true,
		foldingHighlight: true,
		showFoldingControls: 'always',
		bracketPairColorization: {
			enabled: true,
		},
		scrollbar: {
			horizontal: 'auto',
			vertical: 'auto',
			horizontalScrollbarSize: 12,
			verticalScrollbarSize: 12,
		},
	};

	const getMonacoLanguage = (lang) => {
		switch (lang) {
			case 'gml':
				return 'gml';
			case 'plaintext':
				return 'plaintext';
			default:
				return 'gml';
		}
	};

	return (
		<div
			ref={containerRef}
			style={{ height: '100%', backgroundColor: 'var(--color-foreground)' }}>
			<Editor
				height="100%"
				language={getMonacoLanguage(language)}
				value={content}
				onChange={handleEditorChange}
				options={editorOptions}
				loading="Loading editor..."
				beforeMount={async (monaco) => {
					if (!isGmlRegisteredGlobally) {
						try {
							// Initialize GML definitions first
							await gmlLanguage.initialize();
							await gmlCompletionProvider.initialize();
							await gmlHoverProvider.initialize();
							await gmlSignatureHelpProvider.initialize();
							await gmlColorProvider.initialize();

							// Register GML language
							monaco.languages.register({ id: 'gml' });

							// Set up language configuration
							const languageConfig = gmlLanguage.getLanguageConfiguration();
							monaco.languages.setLanguageConfiguration('gml', languageConfig);

							// Set up monarch tokenizer with initialized data
							const monarchDefinition = gmlLanguage.getMonarchDefinition();
							monaco.languages.setMonarchTokensProvider(
								'gml',
								monarchDefinition
							);

							// Define custom theme
							monaco.editor.defineTheme('gml-theme', gmlTheme);

							// Register completion provider
							monaco.languages.registerCompletionItemProvider(
								'gml',
								gmlCompletionProvider
							);

							// Register hover provider
							monaco.languages.registerHoverProvider('gml', gmlHoverProvider);

							// Register signature help provider
							monaco.languages.registerSignatureHelpProvider(
								'gml',
								gmlSignatureHelpProvider
							);

							monaco.languages.registerColorProvider('gml', gmlColorProvider);

							isGmlRegisteredGlobally = true;
						} catch (error) {
							console.warn('GML language registration error:', error);
							isGmlRegisteredGlobally = true;
						}
					}

					// Always set the theme
					monaco.editor.setTheme('gml-theme');
				}}
				onMount={(editor, monaco) => {
					editorRef.current = editor;

					// Force the theme and language
					monaco.editor.setTheme('gml-theme');
					editor.updateOptions({ theme: 'gml-theme' });

					// Ensure the model uses the correct language
					const model = editor.getModel();
					if (model && getMonacoLanguage(language) === 'gml') {
						monaco.editor.setModelLanguage(model, 'gml');
					}

					// Function to parse and update variable scope
					const updateVariableScope = (model) => {
						if (!model || getMonacoLanguage(language) !== 'gml') return;

						const text = model.getValue();

						// Clear previous user-defined identifiers
						gmlLanguage.clearUserIdentifiers();

						// Parse macros
						const macroMatches = text.matchAll(/#macro\s+([a-zA-Z_][\w]*)/g);
						for (const match of macroMatches) {
							gmlLanguage.addUserMacro(match[1]);
						}

						// Parse enums
						const enumMatches = text.matchAll(/enum\s+([a-zA-Z_][\w]*)/g);
						for (const match of enumMatches) {
							gmlLanguage.addUserEnum(match[1]);
						}

						// Parse local variables and function parameters - we'll use a simple approach
						// for now and add all to a global scope since Monaco doesn't track actual scope context
						const varMatches = text.matchAll(
							/(?:var|static)\s+([a-zA-Z_][\w]*)/g
						);
						for (const match of varMatches) {
							gmlLanguage.addLocalVariable('global', match[1]);
						}

						// Parse function parameters
						const functionMatches = text.matchAll(
							/function\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)/g
						);
						for (const match of functionMatches) {
							const functionName = match[1];
							const paramList = match[2];
							if (paramList) {
								const params = paramList
									.split(',')
									.map((p) => p.trim())
									.filter((p) => p);
								for (const param of params) {
									// Remove default values if present
									const paramName = param.split('=')[0].trim();
									if (paramName) {
										gmlLanguage.addFunctionParameter(functionName, paramName);
										// Also add to global local vars for simpler highlighting
										gmlLanguage.addLocalVariable('global', paramName);
									}
								}
							}
						}

						// Update the Monaco tokenizer with new identifiers
						gmlLanguage.updateTokenizer(monaco);
					};

					// Update variable scope on initial load
					updateVariableScope(model);

					// Set up content change listener for real-time variable tracking
					if (model) {
						model.onDidChangeContent(() => {
							updateVariableScope(model);
						});
					}

					// Set up editor status updates
					const updateStatus = () => {
						const position = editor.getPosition();
						const model = editor.getModel();

						if (position && model) {
							const lineNumber = position.lineNumber;
							const column = position.column;
							const lineContent = model.getLineContent(lineNumber);

							// Extract current function context
							let currentFunction = '';
							const text = model.getValue();
							const lines = text.split('\n');

							// Look for current function scope
							let functionStartLine = -1;
							let functionEndLine = -1;
							let functionName = '';

							// Find all functions and their boundaries
							for (let i = 0; i < lines.length; i++) {
								const line = lines[i];
								const functionMatch = line.match(
									/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/
								);

								if (functionMatch) {
									// Found function definition, now find its end
									let braceCount = 0;
									let startFound = false;
									const candidateName = functionMatch[1];
									let candidateStart = i + 1;
									let candidateEnd = -1;

									// Find opening brace
									for (let j = i; j < lines.length; j++) {
										const searchLine = lines[j];
										for (const char of searchLine) {
											if (char === '{') {
												braceCount++;
												if (!startFound) {
													startFound = true;
													candidateStart = j + 1;
												}
											} else if (char === '}' && startFound) {
												braceCount--;
												if (braceCount === 0) {
													candidateEnd = j;
													break;
												}
											}
										}
										if (candidateEnd !== -1) break;
									}

									// Check if current line is within this function's body
									if (
										candidateEnd !== -1 &&
										lineNumber >= candidateStart &&
										lineNumber <= candidateEnd
									) {
										functionName = candidateName;
										break;
									}
								}
							}

							currentFunction = functionName || null; // Check if we're inside a function call for signature help display
							let functionCallInfo = null;
							const textBeforeCursor = model.getValueInRange({
								startLineNumber: lineNumber,
								startColumn: 1,
								endLineNumber: lineNumber,
								endColumn: column,
							});

							// Find function call pattern - look for unclosed parentheses
							const funcCallMatch = textBeforeCursor.match(
								/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)$/
							);
							if (funcCallMatch) {
								const funcName = funcCallMatch[1];
								const argsText = funcCallMatch[2] || '';

								// Count commas properly, considering nested parentheses and quotes
								let commaCount = 0;
								let parenCount = 0;
								let inString = false;
								let stringChar = '';

								for (let i = 0; i < argsText.length; i++) {
									const char = argsText[i];

									if (!inString) {
										if (char === '"' || char === "'") {
											inString = true;
											stringChar = char;
										} else if (char === '(') {
											parenCount++;
										} else if (char === ')') {
											parenCount--;
										} else if (char === ',' && parenCount === 0) {
											commaCount++;
										}
									} else if (
										char === stringChar &&
										(i === 0 || argsText[i - 1] !== '\\')
									) {
										inString = false;
									}
								}

								// Get function info from definitions
								const func = gmlDefinitionsParser.getFunction(funcName);
								if (func) {
									functionCallInfo = {
										functionName: func.name,
										parameters: func.parameters,
										activeParameter: Math.min(
											commaCount,
											func.parameters.length - 1
										),
									};
								}
							}

							updateEditorStatus({
								line: lineNumber,
								column: column,
								problems: 0, // Use number instead of array
								currentFunction: functionCallInfo || currentFunction || null,
							});
						}
					};

					// Update status on cursor position change
					editor.onDidChangeCursorPosition(updateStatus);

					// Update status on content change
					editor.onDidChangeModelContent(updateStatus);

					// Initial status update
					setTimeout(updateStatus, 100);

					setTimeout(() => editor.layout(), 0);
				}}
			/>
		</div>
	);
};

export default MonacoEditor;
