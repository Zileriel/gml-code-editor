import React, { useCallback, useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStatus } from '../contexts/EditorStatusContext';
import { useEditor } from '../contexts/EditorContext';
import gmlLanguage from '../scripts/gmlLanguage.js';
import gmlTheme from '../scripts/gmlTheme.js';
import gmlCompletionProvider from '../scripts/gmlCompletionProvider.js';
import gmlHoverProvider from '../scripts/gmlHoverProvider.js';
import gmlSignatureHelpProvider from '../scripts/gmlSignatureHelpProvider.js';
import gmlColorProvider from '../scripts/gmlColorProvider.js';
import gmlLintingProvider from '../scripts/gmlLintingProvider.js';
import gmlCodeActionsProvider from '../scripts/gmlCodeActionsProvider.js';
import gmlDefinitionsParser from '../scripts/gmlDefinitionsParser.js';
import gmlDefinitionProvider from '../scripts/gmlDefinitionProvider.js';

let isGmlRegisteredGlobally = false;

const MonacoEditor = ({ tabId, content, language, onContentChange }) => {
	const editorRef = useRef(null);
	const containerRef = useRef(null);
	const resizeObserverRef = useRef(null);
	const [isEditorReady, setIsEditorReady] = useState(false);
	const { updateEditorStatus } = useEditorStatus();
	const { setEditorInstance, openFileAtLocation, openTabs } = useEditor();

	// Suppress Monaco disposal errors
	useEffect(() => {
		const originalConsoleError = console.error;
		const originalPromiseHandler = window.addEventListener;

		// Override console.error to filter out Monaco disposal errors
		console.error = (...args) => {
			const message = args.join(' ');
			if (message.includes('Canceled') && message.includes('async.ts')) {
				return; // Suppress Monaco disposal errors
			}
			originalConsoleError.apply(console, args);
		};

		// Handle unhandled promise rejections from Monaco
		const handleUnhandledRejection = (event) => {
			if (
				event.reason &&
				event.reason.message &&
				event.reason.message.includes('Canceled')
			) {
				event.preventDefault();
				return;
			}
		};

		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			console.error = originalConsoleError;
			window.removeEventListener(
				'unhandledrejection',
				handleUnhandledRejection
			);
		};
	}, []);

	useEffect(() => {
		window.editorActions = {
			openFile: openFileAtLocation,
		};
		// Also store openFileAtLocation globally for Monaco commands
		window.openFileAtLocation = openFileAtLocation;

		return () => {
			delete window.editorActions;
			delete window.openFileAtLocation;
		};
	}, [openFileAtLocation]);

	useEffect(() => {
		const handleProjectUpdate = (projectData) => {
			if (window.assets) {
				const assets = window.assets.getAssets();
				gmlLanguage.updateAssets(assets);
				gmlCompletionProvider.updateAssets(assets);
				gmlHoverProvider.updateAssets(assets);
			}

			if (window.definitions) {
				const definitions = window.definitions.getDefinitions();
				gmlCompletionProvider.updateUserSymbols(definitions);
				gmlLanguage.updateUserSymbols(definitions);
			}

			// Trigger re-linting of all open GML models
			if (window.monaco) {
				const models = window.monaco.editor.getModels();
				models.forEach((model) => {
					if (model.getLanguageId() === 'gml') {
						const diagnostics = gmlLintingProvider.validateCode(model);
						window.monaco.editor.setModelMarkers(model, 'gml', diagnostics);
					}
				});
			}
		};

		if (!window.gmlProjectHandler) {
			window.gmlProjectHandler = handleProjectUpdate;
		}

		const removeProjectListener = window.api?.onProjectLoaded?.(
			window.gmlProjectHandler
		);

		const handleAssetUpdate = () => {
			if (window.assets) {
				const assets = window.assets.getAssets();
				gmlLanguage.updateAssets(assets);
				gmlCompletionProvider.updateAssets(assets);
				gmlHoverProvider.updateAssets(assets);
			}
		};

		if (window.assets && window.gmlProjectHandler) {
			handleAssetUpdate();
		}

		if (window.definitions && window.gmlProjectHandler) {
			const definitions = window.definitions.getDefinitions();
			gmlCompletionProvider.updateUserSymbols(definitions);
			gmlLanguage.updateUserSymbols(definitions);
		}

		return () => {
			if (removeProjectListener) {
				removeProjectListener();
			}
		};
	}, []);

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
						monaco.editor.setTheme('gml-theme');
						editorRef.current.updateOptions({ theme: 'gml-theme' });
					} else {
						monaco.editor.setTheme('vs-dark');
						editorRef.current.updateOptions({ theme: 'vs-dark' });
					}
				}
			}
		}
	}, [language]);

	// Initialize global file symbol storage
	useEffect(() => {
		if (!window.gmlFileSymbols) {
			window.gmlFileSymbols = new Map();
		}
	}, []);

	// Track current file symbols
	const debouncedUpdateSymbols = useRef();

	// Remove GameMaker comments from text while preserving line structure
	const removeGameMakerComments = useCallback((text) => {
		let result = '';
		let inBlockComment = false;
		let inString = false;
		let stringChar = '';
		let escaped = false;

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			const nextChar = i + 1 < text.length ? text[i + 1] : '';

			if (escaped) {
				escaped = false;
				result += inString ? ' ' : char;
				continue;
			}

			if (char === '\\' && inString) {
				escaped = true;
				result += ' ';
				continue;
			}

			if (!inBlockComment && !inString && (char === '"' || char === "'")) {
				inString = true;
				stringChar = char;
				result += ' ';
				continue;
			}

			if (inString && char === stringChar) {
				inString = false;
				stringChar = '';
				result += ' ';
				continue;
			}

			if (inString) {
				result += ' ';
				continue;
			}

			// Handle block comments
			if (!inBlockComment && char === '/' && nextChar === '*') {
				inBlockComment = true;
				result += '  '; // Replace /* with spaces
				i++; // Skip the *
				continue;
			}

			if (inBlockComment && char === '*' && nextChar === '/') {
				inBlockComment = false;
				result += '  '; // Replace */ with spaces
				i++; // Skip the /
				continue;
			}

			if (inBlockComment) {
				// Preserve newlines in block comments
				result += char === '\n' ? '\n' : ' ';
				continue;
			}

			// Handle line comments
			if (char === '/' && nextChar === '/') {
				// Replace everything to end of line with spaces
				while (i < text.length && text[i] !== '\n') {
					result += text[i] === '\n' ? '\n' : ' ';
					i++;
				}
				i--; // Adjust for the loop increment
				continue;
			}

			result += char;
		}

		return result;
	}, []);

	// Extract symbols from GML content
	const extractSymbols = useCallback(
		(content) => {
			if (!content || typeof content !== 'string') return null;

			const symbols = {
				macros: [],
				enums: [],
				functions: [],
				globals: [],
				globalvars: [],
			};

			// Remove comments before parsing
			const cleanContent = removeGameMakerComments(content);

			// Extract macros
			const macroMatches = cleanContent.match(
				/#macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
			);
			if (macroMatches) {
				macroMatches.forEach((match) => {
					const nameMatch = match.match(/#macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
					if (nameMatch) {
						symbols.macros.push({ name: nameMatch[1], type: 'macro' });
					}
				});
			}

			// Extract enums
			const enumMatches = cleanContent.match(
				/enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
			);
			if (enumMatches) {
				enumMatches.forEach((match) => {
					const nameMatch = match.match(/enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
					if (nameMatch) {
						symbols.enums.push({ name: nameMatch[1], type: 'enum' });
					}
				});
			}

			// Extract functions
			const functionMatches = cleanContent.match(
				/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
			);
			if (functionMatches) {
				functionMatches.forEach((match) => {
					const nameMatch = match.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
					if (nameMatch) {
						symbols.functions.push({ name: nameMatch[1], type: 'function' });
					}
				});
			}

			// Extract globals
			const globalMatches = cleanContent.match(
				/global\.([a-zA-Z_][a-zA-Z0-9_]*)/g
			);
			if (globalMatches) {
				const uniqueGlobals = new Set();
				globalMatches.forEach((match) => {
					const nameMatch = match.match(/global\.([a-zA-Z_][a-zA-Z0-9_]*)/);
					if (nameMatch) {
						uniqueGlobals.add(nameMatch[1]);
					}
				});
				uniqueGlobals.forEach((name) => {
					symbols.globals.push({ name, type: 'global' });
				});
			}

			// Extract globalvars
			const globalvarMatches = cleanContent.match(/globalvar\s+([^;]+);/g);
			if (globalvarMatches) {
				globalvarMatches.forEach((match) => {
					const varMatch = match.match(/globalvar\s+([^;]+)/);
					if (varMatch) {
						const vars = varMatch[1].split(',').map((v) => v.trim());
						vars.forEach((varName) => {
							if (varName && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
								symbols.globalvars.push({ name: varName, type: 'globalvar' });
							}
						});
					}
				});
			}

			return symbols;
		},
		[removeGameMakerComments]
	);

	// Update symbols using preload.js methods
	const updateSymbols = useCallback(
		(content) => {
			if (!content || !window.definitions || !tabId) return;

			const newSymbols = extractSymbols(content);
			if (!newSymbols) return;

			let symbolsChanged = false;
			const oldFileSymbols = window.gmlFileSymbols.get(tabId) || {
				macros: [],
				enums: [],
				functions: [],
				globals: [],
				globalvars: [],
			};

			// Compare and update each symbol type
			Object.keys(newSymbols).forEach((symbolType) => {
				const oldSymbols = oldFileSymbols[symbolType] || [];
				const newSymbolsForType = newSymbols[symbolType];

				// Remove old symbols no longer present
				oldSymbols.forEach((oldSymbol) => {
					const stillExists = newSymbolsForType.find(
						(newSymbol) => newSymbol.name === oldSymbol.name
					);
					if (!stillExists) {
						window.definitions.removeSymbol(symbolType, oldSymbol.name);
						symbolsChanged = true;
					}
				});

				// Add new symbols
				newSymbolsForType.forEach((newSymbol) => {
					const alreadyExists = oldSymbols.find(
						(oldSymbol) => oldSymbol.name === newSymbol.name
					);
					if (!alreadyExists) {
						window.definitions.addSymbol(symbolType, newSymbol);
						symbolsChanged = true;
					}
				});
			});

			// Store symbols for this file
			window.gmlFileSymbols.set(tabId, newSymbols);

			// Update providers if symbols changed
			if (symbolsChanged) {
				setTimeout(() => {
					if (window.monaco && window.monaco.languages) {
						const allDefinitions = window.definitions.getDefinitions();

						if (window.gmlCompletionProvider) {
							window.gmlCompletionProvider.updateUserSymbols(allDefinitions);
						}
						if (window.gmlLanguage) {
							window.gmlLanguage.updateUserSymbols(allDefinitions);
						}
					}
				}, 100);
			}
		},
		[extractSymbols, tabId]
	);

	// Update symbols when content changes
	useEffect(() => {
		if (content && language === 'gml') {
			updateSymbols(content);
		}
	}, [content, language, updateSymbols]);

	// Update providers when file loads
	useEffect(() => {
		if (language === 'gml' && window.definitions) {
			setTimeout(() => {
				if (window.monaco && window.monaco.languages) {
					const allDefinitions = window.definitions.getDefinitions();

					if (window.gmlCompletionProvider) {
						window.gmlCompletionProvider.updateUserSymbols(allDefinitions);
					}
					if (window.gmlLanguage) {
						window.gmlLanguage.updateUserSymbols(allDefinitions);
					}
				}
			}, 200);
		}
	}, [language, tabId]);

	// Reset editor ready state when switching tabs or language
	useEffect(() => {
		setIsEditorReady(false);
	}, [tabId, language]);

	// Cleanup debounced timeout on unmount
	useEffect(() => {
		return () => {
			if (debouncedUpdateSymbols.current) {
				clearTimeout(debouncedUpdateSymbols.current);
			}
		};
	}, []);

	const handleEditorChange = useCallback(
		(value) => {
			if (onContentChange) {
				onContentChange(tabId, value);
			}

			// Update symbols for GML files
			if (language === 'gml' && value) {
				if (debouncedUpdateSymbols.current) {
					clearTimeout(debouncedUpdateSymbols.current);
				}
				debouncedUpdateSymbols.current = setTimeout(() => {
					updateSymbols(value);
				}, 300);
			}
		},
		[tabId, onContentChange, language, updateSymbols]
	);

	const editorOptions = {
		minimap: { enabled: true },
		fontSize: 14,
		fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
		lineNumbers: 'on',
		roundedSelection: false,
		scrollBeyondLastLine: false,
		automaticLayout: true,
		theme: language === 'gml' ? 'gml-theme' : 'vs-dark',
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
			style={{
				height: '100%',
				backgroundColor: '#1e1e1e',
			}}
			className="monaco-editor-container">
			<Editor
				height="100%"
				language={getMonacoLanguage(language)}
				value={isEditorReady ? content : ''}
				onChange={handleEditorChange}
				options={{
					...editorOptions,
					theme: language === 'gml' ? 'gml-theme' : 'vs-dark',
				}}
				theme={language === 'gml' ? 'gml-theme' : 'vs-dark'}
				loading=""
				beforeMount={async (monaco) => {
					// Define theme globally once
					if (!window.gmlThemeDefined) {
						monaco.editor.defineTheme('gml-theme', gmlTheme);
						window.gmlThemeDefined = true;
					}

					if (!isGmlRegisteredGlobally) {
						try {
							await gmlLanguage.initialize();
							await gmlCompletionProvider.initialize();
							await gmlHoverProvider.initialize();
							await gmlSignatureHelpProvider.initialize();
							await gmlColorProvider.initialize();
							await gmlLintingProvider.initialize();
							await gmlCodeActionsProvider.initialize();

							// Register GML language
							monaco.languages.register({ id: 'gml' });

							// Set up language configuration
							const languageConfig = gmlLanguage.getLanguageConfiguration();
							monaco.languages.setLanguageConfiguration('gml', languageConfig);

							// Update assets if available
							if (window.assets) {
								const assets = window.assets.getAssets();
								gmlLanguage.updateAssets(assets);
								gmlCompletionProvider.updateAssets(assets);
								gmlHoverProvider.updateAssets(assets);
							}

							// Set up monarch tokenizer with initialized data
							const monarchDefinition = gmlLanguage.getMonarchDefinition();
							monaco.languages.setMonarchTokensProvider(
								'gml',
								monarchDefinition
							);

							// Register completion provider
							monaco.languages.registerCompletionItemProvider(
								'gml',
								gmlCompletionProvider
							);

							// Register hover provider
							monaco.languages.registerHoverProvider('gml', gmlHoverProvider);

							// Store providers on window for symbol updates
							window.gmlCompletionProvider = gmlCompletionProvider;
							window.gmlLanguage = gmlLanguage;

							// Register signature help provider
							monaco.languages.registerSignatureHelpProvider(
								'gml',
								gmlSignatureHelpProvider
							);

							monaco.languages.registerColorProvider('gml', gmlColorProvider);

							// Register code actions provider (quick fixes)
							monaco.languages.registerCodeActionProvider(
								'gml',
								gmlCodeActionsProvider
							);

							// Register definition provider
							await gmlDefinitionProvider.initialize();
							monaco.languages.registerDefinitionProvider(
								'gml',
								gmlDefinitionProvider
							);

							isGmlRegisteredGlobally = true;
						} catch (error) {
							console.warn('GML language registration error:', error);
							isGmlRegisteredGlobally = true;
						}
					}
				}}
				onMount={(editor, monaco) => {
					editorRef.current = editor;

					// Set content after a short delay to ensure syntax highlighting is applied
					setTimeout(() => {
						if (!isEditorReady) {
							editor.setValue(content);
							setIsEditorReady(true);
						}
					}, 50);
					setEditorInstance(editor);

					editor.onMouseDown((e) => {
						if (e.event.leftButton && e.event.ctrlKey) {
							e.event.preventDefault();
							e.event.stopPropagation();

							const position = e.target.position;
							if (position) {
								editor.setPosition(position);
								const model = editor.getModel();
								const word = model.getWordAtPosition(position);

								if (word && window.definitions) {
									const symbol = window.definitions.findDefinition(word.word);
									if (symbol) {
										const location = symbol.location;
										openFileAtLocation(
											{
												name: location.assetName,
												type: location.eventName ? 'object' : 'script',
												eventName: location.eventName,
											},
											location.line,
											location.column
										);
									}
								}
							}
						}
					});

					// Register go-to-definition command
					editor.addCommand(
						monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD,
						(ed) => {
							const position = ed.getPosition();
							const model = ed.getModel();
							const word = model.getWordAtPosition(position);
							if (word && window.definitions) {
								const symbol = window.definitions.findDefinition(word.word);
								if (symbol && window.editorActions?.openFile) {
									const location = symbol.location;
									window.editorActions.openFile(
										{
											name: location.assetName,
											type: location.eventName ? 'object' : 'script',
											eventName: location.eventName,
										},
										location.line,
										location.column
									);
								}
							}
						}
					);

					// Register global command using Monaco's proper command registration
					if (!window.gmlCommandRegistered) {
						try {
							monaco.editor.registerCommand(
								'gml.goToDefinition',
								(accessor, ...args) => {
									if (args.length > 0) {
										const symbol = args[0];
										if (symbol && window.openFileAtLocation) {
											const location = symbol.location;
											window.openFileAtLocation(
												{
													name: location.assetName,
													type: location.eventName ? 'object' : 'script',
													eventName: location.eventName,
												},
												location.line,
												location.column
											);
										}
									}
								}
							);
							window.gmlCommandRegistered = true;
						} catch (error) {}
					}

					// Ensure the model uses the correct language
					const model = editor.getModel();
					if (model && getMonacoLanguage(language) === 'gml') {
						monaco.editor.setModelLanguage(model, 'gml');
					}

					// Function to parse and update variable scope
					const updateVariableScope = (model) => {
						if (!model || getMonacoLanguage(language) !== 'gml') return;

						const text = model.getValue();

						// Parse local variables and function parameters
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
									const paramName = param.split('=')[0].trim();
									if (paramName) {
										gmlLanguage.addFunctionParameter(functionName, paramName);
										gmlLanguage.addLocalVariable('global', paramName);
									}
								}
							}
						}

						// Update the Monaco tokenizer with new identifiers
						gmlLanguage.updateTokenizer(monaco);
					};

					// Function to update diagnostics
					const updateDiagnostics = (model) => {
						if (!model || getMonacoLanguage(language) !== 'gml') return;

						// Run linting
						const diagnostics = gmlLintingProvider.validateCode(model);

						// Set diagnostics in Monaco
						monaco.editor.setModelMarkers(model, 'gml', diagnostics);

						// Count problems by severity - using correct Monaco severity values
						const problemCounts = diagnostics.reduce(
							(acc, diag) => {
								switch (diag.severity) {
									case 8:
										acc.errors++;
										break;
									case 4:
										acc.warnings++;
										break;
									case 1:
										acc.hints++;
										break;
									default:
										acc.info++;
										break;
								}
								return acc;
							},
							{ errors: 0, warnings: 0, hints: 0, info: 0 }
						);

						return problemCounts;
					};

					// Update variable scope on initial load
					updateVariableScope(model);

					// Run initial linting
					setTimeout(() => {
						if (model && getMonacoLanguage(language) === 'gml') {
							updateDiagnostics(model);
						}
					}, 100);

					// Set up content change listener for real-time variable tracking and linting
					if (model) {
						model.onDidChangeContent((e) => {
							updateVariableScope(model);

							if (model._lintingTimeout) {
								clearTimeout(model._lintingTimeout);
							}
							model._lintingTimeout = setTimeout(() => {
								updateDiagnostics(model);
							}, 300);
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

							currentFunction = functionName || null;
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

								// Get function info from built-in definitions first
								let func = gmlDefinitionsParser.getFunction(funcName);
								let isUserFunction = false;

								// If not found, check user-defined functions
								if (!func && window.definitions) {
									const userFunc = window.definitions.findDefinition(funcName);
									if (userFunc && userFunc.parameters) {
										func = {
											name: userFunc.name,
											parameters: userFunc.parameters || [],
										};
										isUserFunction = true;
									}
								}

								if (func) {
									functionCallInfo = {
										functionName: func.name,
										parameters: func.parameters || [],
										activeParameter: Math.min(
											commaCount,
											(func.parameters || []).length - 1
										),
										isUserFunction: isUserFunction,
									};
								}
							}

							// Get current diagnostics for problem count
							const markers = monaco.editor.getModelMarkers({
								resource: model.uri,
							});
							const problemCounts = markers.reduce(
								(acc, marker) => {
									switch (marker.severity) {
										case 8:
											acc.errors++;
											break;
										case 4:
											acc.warnings++;
											break;
										case 1:
											acc.hints++;
											break;
										default:
											acc.info++;
											break;
									}
									return acc;
								},
								{ errors: 0, warnings: 0, hints: 0, info: 0 }
							);

							updateEditorStatus({
								line: lineNumber,
								column: column,
								problems: problemCounts,
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
