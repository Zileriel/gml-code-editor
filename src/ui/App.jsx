import React, { useState, useEffect } from 'react';
import { EditorStatusProvider } from './contexts/EditorStatusContext';
import { EditorProvider } from './contexts/EditorContext';
import { MainViewProvider, useMainView } from './contexts/MainViewContext';
import { useEditor } from './contexts/EditorContext';
import Sidebar from './views/Sidebar';
import Main from './views/Main';
import StatusBar from './views/StatusBar';
import Topbar from './views/Topbar';

// Inner component to access contexts
function AppContent() {
	const { switchToSearch, switchToExplorer, switchToSourceControl } =
		useMainView();
	const { editorInstance } = useEditor();

	useEffect(() => {
		const handleKeyDown = (e) => {
			// Ctrl/Cmd + Shift + F for search
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
				e.preventDefault();

				// Get selected text from Monaco editor if available
				let selectedText = '';
				if (editorInstance) {
					const selection = editorInstance.getSelection();
					if (selection && !selection.isEmpty()) {
						selectedText =
							editorInstance.getModel()?.getValueInRange(selection) || '';
					}
				}

				// Switch to search view with selected text
				switchToSearch(selectedText);
			}

			// Ctrl/Cmd + Shift + E for explorer
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
				e.preventDefault();
				switchToExplorer();
			}

			// Ctrl/Cmd + Shift + G for source control
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
				e.preventDefault();
				switchToSourceControl();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [switchToSearch, switchToExplorer, switchToSourceControl, editorInstance]);

	return (
		<main>
			<Topbar />
			<Sidebar />
			<Main />
			<StatusBar />
		</main>
	);
}

export default function App() {
	return (
		<EditorStatusProvider>
			<EditorProvider>
				<MainViewProvider>
					<AppContent />
				</MainViewProvider>
			</EditorProvider>
		</EditorStatusProvider>
	);
}
