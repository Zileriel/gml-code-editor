import React, { useEffect, useRef, useState } from 'react';
import MonacoService from '../services/MonacoService.js';

export default function DiffViewer({ filePath, onClose, language = 'gml' }) {
	const containerRef = useRef(null);
	const diffEditorRef = useRef(null);
	const [originalContent, setOriginalContent] = useState('');
	const [modifiedContent, setModifiedContent] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [editorReady, setEditorReady] = useState(false);

	useEffect(() => {
		loadDiffContent();
	}, [filePath]);

	// Cleanup on unmount - this is the key to preventing React errors
	useEffect(() => {
		return () => {
			cleanupEditor();
		};
	}, []);

	const cleanupEditor = () => {
		if (diffEditorRef.current) {
			try {
				console.log('DiffViewer: Cleaning up Monaco editor');

				// Clear container first to prevent DOM conflicts
				if (containerRef.current) {
					containerRef.current.innerHTML = '';
				}

				// Reset the diff editor model to null before disposing
				try {
					diffEditorRef.current.setModel(null);
				} catch (error) {
					// Ignore setModel errors on disposed editor
				}

				// Dispose the editor (this will handle model disposal internally)
				diffEditorRef.current.dispose();
				diffEditorRef.current = null;
			} catch (error) {
				console.warn('DiffViewer: Error during cleanup:', error);
			}
		}
	};

	const loadDiffContent = async () => {
		setIsLoading(true);
		try {
			console.log('DiffViewer: Loading content for', filePath);

			const [gitDiffResponse, currentFileResponse] = await Promise.all([
				window.api?.gitDiff?.(filePath),
				window.api?.readFile?.(filePath),
			]);

			console.log('DiffViewer: Git diff response:', gitDiffResponse);
			console.log('DiffViewer: Current file response:', currentFileResponse);

			const originalContent = gitDiffResponse?.original || '';
			const modifiedContent = currentFileResponse || '';

			setOriginalContent(originalContent);
			setModifiedContent(modifiedContent);
		} catch (error) {
			console.error('Failed to load diff:', error);
		}
		setIsLoading(false);
	};

	const getMonacoLanguage = (fileLanguage) => {
		switch (fileLanguage) {
			case 'gml':
				return 'gml';
			case 'note':
			case 'plaintext':
				return 'plaintext';
			default:
				return 'plaintext';
		}
	};

	const createDiffEditor = async (original, modified) => {
		if (!containerRef.current) {
			console.log('DiffViewer: Container not ready');
			return;
		}

		try {
			// Ensure Monaco is ready
			await MonacoService.initialize();

			if (!MonacoService.isReady()) {
				console.error('DiffViewer: Monaco service not ready');
				return;
			}

			console.log('DiffViewer: Creating diff editor with language:', language);

			// Clean up any existing editor first
			cleanupEditor();

			const monacoLanguage = getMonacoLanguage(language);
			console.log('DiffViewer: Using Monaco language:', monacoLanguage);

			// Create Monaco diff editor
			const diffEditor = window.monaco.editor.createDiffEditor(
				containerRef.current,
				{
					theme: language === 'gml' ? 'gml-theme' : 'vs-dark',
					readOnly: true,
					renderSideBySide: true,
					enableSplitViewResizing: true,
					renderOverviewRuler: true,
					automaticLayout: true,
					minimap: { enabled: false },
					fontSize: 14,
					wordWrap: 'off',
					scrollBeyondLastLine: false,
					ignoreTrimWhitespace: false,
					renderIndicators: true,
				}
			);

			console.log(
				'DiffViewer: Created diff editor, creating models with language:',
				monacoLanguage
			);

			// Create models with proper language
			const originalModel = window.monaco.editor.createModel(
				original,
				monacoLanguage
			);
			const modifiedModel = window.monaco.editor.createModel(
				modified,
				monacoLanguage
			);

			// Set the models
			diffEditor.setModel({
				original: originalModel,
				modified: modifiedModel,
			});

			console.log('DiffViewer: Models set successfully');

			// Store reference
			diffEditorRef.current = diffEditor;
			setEditorReady(true);

			// Layout after short delay
			setTimeout(() => {
				if (diffEditor && containerRef.current) {
					diffEditor.layout();
				}
			}, 100);

			console.log(
				'DiffViewer: Diff editor created successfully with GML language'
			);
		} catch (error) {
			console.error('DiffViewer: Failed to create diff editor:', error);
		}
	};

	// Create diff editor when content is ready
	useEffect(() => {
		if (!isLoading && (originalContent !== '' || modifiedContent !== '')) {
			createDiffEditor(originalContent, modifiedContent);
		}
	}, [originalContent, modifiedContent, isLoading, language]);

	if (isLoading) {
		return (
			<div className="diff-viewer">
				<div className="diff-header">
					<span>Loading diff for {filePath}...</span>
					<button onClick={onClose} className="diff-close-btn">
						×
					</button>
				</div>
				<div className="diff-loading">Loading...</div>
			</div>
		);
	}

	if (!originalContent && !modifiedContent) {
		return (
			<div className="diff-viewer">
				<div className="diff-header">
					<span>{filePath}</span>
					<button onClick={onClose} className="diff-close-btn">
						×
					</button>
				</div>
				<div style={{ padding: '1rem', textAlign: 'center' }}>
					<p>No content available for diff comparison.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="diff-viewer">
			<div className="diff-header">
				<span>
					{filePath} ({language})
				</span>
				<button onClick={onClose} className="diff-close-btn">
					×
				</button>
			</div>
			<div
				className="diff-content"
				ref={containerRef}
				style={{
					height: 'calc(100% - 50px)',
					width: '100%',
					position: 'relative',
					minHeight: '400px',
					backgroundColor: '#1e1e1e',
					border: '1px solid #333',
				}}>
				{!editorReady && (
					<div
						style={{
							padding: '2rem',
							color: '#ccc',
							textAlign: 'center',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							height: '100%',
						}}>
						<div>
							<p>Initializing diff editor...</p>
							<p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
								Language: {language} | Monaco:{' '}
								{MonacoService.isReady() ? 'Ready' : 'Loading'}
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
