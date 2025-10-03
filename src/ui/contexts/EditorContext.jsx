import React, { createContext, useContext, useState, useCallback } from 'react';

const EditorContext = createContext();

export const useEditor = () => {
	const context = useContext(EditorContext);
	if (!context) {
		throw new Error('useEditor must be used within an EditorProvider');
	}
	return context;
};

export const EditorProvider = ({ children }) => {
	const [openTabs, setOpenTabs] = useState([]);
	const [activeTab, setActiveTab] = useState(null);
	const [editorInstance, setEditorInstance] = useState(null);

	const openFile = useCallback(
		(fileInfo) => {
			const { asset, eventName, content } = fileInfo;

			const tabId = eventName ? `${asset.name}_${eventName}` : asset.name;

			const existingTab = openTabs.find((tab) => tab.id === tabId);
			if (existingTab) {
				setActiveTab(tabId);
				return;
			}

			const newTab = {
				id: tabId,
				title: eventName ? `${asset.name} - ${eventName}` : asset.name,
				content: content,
				type: asset.type,
				asset: asset,
				eventName: eventName,
				isDirty: false,
				language: getLanguageFromType(asset.type, eventName),
			};

			setOpenTabs((prev) => [...prev, newTab]);
			setActiveTab(tabId);
		},
		[openTabs]
	);

	const openObjectFiles = useCallback(
		(asset) => {
			if (asset.events && asset.events.length > 0) {
				asset.events.forEach((event) => {
					openFile({
						asset,
						eventName: event.name.replace('.gml', ''),
						content: event.content,
					});
				});
			} else {
				openFile({
					asset,
					content: '// No events found for this object',
				});
			}
		},
		[openFile]
	);

	const closeTab = useCallback(
		(tabId) => {
			setOpenTabs((prev) => {
				const updated = prev.filter((tab) => tab.id !== tabId);

				if (activeTab === tabId) {
					if (updated.length > 0) {
						setActiveTab(updated[updated.length - 1].id);
					} else {
						setActiveTab(null);
					}
				}

				return updated;
			});
		},
		[activeTab]
	);

	const updateTabContent = useCallback((tabId, content) => {
		setOpenTabs((prev) =>
			prev.map((tab) =>
				tab.id === tabId ? { ...tab, content, isDirty: true } : tab
			)
		);
	}, []);

	const reorderTabs = useCallback((draggedId, targetId) => {
		setOpenTabs((prev) => {
			const draggedIndex = prev.findIndex((tab) => tab.id === draggedId);
			const targetIndex = prev.findIndex((tab) => tab.id === targetId);

			if (draggedIndex !== -1 && targetIndex !== -1) {
				const newTabs = [...prev];
				const draggedTab = newTabs[draggedIndex];
				newTabs.splice(draggedIndex, 1);
				newTabs.splice(targetIndex, 0, draggedTab);
				return newTabs;
			}

			return prev;
		});
	}, []);

	const getLanguageFromType = (type, eventName) => {
		if (type === 'script' || type === 'object') {
			return 'gml';
		}
		if (type === 'note') {
			return 'plaintext';
		}
		return 'plaintext';
	};

	const goToNextProblem = useCallback(() => {
		if (editorInstance) {
			// Trigger Monaco's "Go to Next Problem" action
			editorInstance.trigger('statusbar', 'editor.action.marker.nextInFiles');
		}
	}, [editorInstance]);

	const goToPreviousProblem = useCallback(() => {
		if (editorInstance) {
			// Trigger Monaco's "Go to Previous Problem" action
			editorInstance.trigger('statusbar', 'editor.action.marker.prevInFiles');
		}
	}, [editorInstance]);

	const showHover = useCallback(() => {
		if (editorInstance) {
			// Show hover information at current cursor position
			editorInstance.trigger('statusbar', 'editor.action.showHover');
		}
	}, [editorInstance]);

	const value = {
		openTabs,
		activeTab,
		setActiveTab,
		openFile,
		openObjectFiles,
		closeTab,
		updateTabContent,
		reorderTabs,
		editorInstance,
		setEditorInstance,
		goToNextProblem,
		goToPreviousProblem,
		showHover,
	};

	return (
		<EditorContext.Provider value={value}>{children}</EditorContext.Provider>
	);
};
