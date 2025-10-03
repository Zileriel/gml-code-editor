import React, { useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useEditor } from '../contexts/EditorContext';

const MonacoEditor = ({ tabId, content, language, onContentChange }) => {
	const editorRef = useRef(null);
	const containerRef = useRef(null);
	const resizeObserverRef = useRef(null);
	const layoutTimeoutRef = useRef(null);

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
		theme: 'vs-dark',
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
				return 'javascript';
			case 'plaintext':
				return 'plaintext';
			default:
				return 'javascript';
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
				beforeMount={(monaco) => {
					monaco.editor.setTheme('vs-dark');
				}}
				onMount={(editor, monaco) => {
					editorRef.current = editor;
					monaco.editor.setTheme('vs-dark');
					editor.updateOptions({ theme: 'vs-dark' });

					setTimeout(() => editor.layout(), 0);
				}}
			/>
		</div>
	);
};

export default MonacoEditor;
