import React, {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
} from 'react';
import gmlSymbolRegistry from '../scripts/gmlSymbolRegistry.js';
import MonacoService from '../services/MonacoService.js';

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
	const [projectData, setProjectData] = useState(null);
	const [pendingPosition, setPendingPosition] = useState(null);

	// Listen for project loaded events and initialize Monaco
	useEffect(() => {
		if (window.api?.onProjectLoaded) {
			const removeListener = window.api.onProjectLoaded(async (data) => {
				setProjectData(data);

				// Initialize Monaco when project loads
				try {
					console.log('EditorContext: Project loaded, initializing Monaco...');
					await MonacoService.initialize();
					console.log('EditorContext: Monaco initialized successfully');
				} catch (error) {
					console.error('EditorContext: Failed to initialize Monaco:', error);
				}
			});

			return removeListener;
		}
	}, []);

	// Also initialize Monaco on component mount (fallback)
	useEffect(() => {
		const initMonaco = async () => {
			try {
				await MonacoService.initialize();
			} catch (error) {
				console.error(
					'EditorContext: Failed to initialize Monaco on mount:',
					error
				);
			}
		};

		// Small delay to let the app settle
		setTimeout(initMonaco, 1000);
	}, []);

	useEffect(() => {
		if (editorInstance && pendingPosition && window.monaco) {
			setTimeout(() => {
				try {
					const { line, column } = pendingPosition;
					const position = new window.monaco.Position(line, column);
					const range = new window.monaco.Range(
						line,
						column,
						line,
						column + 15
					);

					editorInstance.setSelection(range);
					editorInstance.revealRangeInCenter(range);
					editorInstance.focus();

					setTimeout(() => {
						if (editorInstance) {
							editorInstance.setPosition(position);
						}
					}, 800);
				} catch (error) {
					// Suppress Monaco disposal errors
				}

				setPendingPosition(null);
			}, 300);
		}
	}, [editorInstance, pendingPosition]);

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

	const openFileAtLocation = useCallback(
		(assetInfo, line, column) => {
			const { name, type, eventName } = assetInfo;

			if (window.explorerActions?.expandFolderForAsset) {
				window.explorerActions.expandFolderForAsset(name, type);
			}

			if (!projectData) {
				return;
			}

			let fileInfo;
			if (type === 'script' && projectData?.assets?.scripts) {
				const scriptAsset = projectData.assets.scripts.find(
					(s) => s.name === name
				);
				if (scriptAsset) {
					fileInfo = {
						asset: scriptAsset,
						content: scriptAsset.content,
					};
				}
			} else if (
				type === 'object' &&
				eventName &&
				projectData?.assets?.objects
			) {
				const objectAsset = projectData.assets.objects.find(
					(o) => o.name === name
				);
				if (objectAsset) {
					const event = objectAsset.events?.find(
						(e) => e.name === eventName || e.name === `${eventName}.gml`
					);
					if (event) {
						fileInfo = {
							asset: objectAsset,
							eventName: eventName,
							content: event.content,
						};
					}
				}
			} else if (type === 'note' && projectData?.assets?.notes) {
				const noteAsset = projectData.assets.notes.find((n) => n.name === name);
				if (noteAsset) {
					fileInfo = {
						asset: noteAsset,
						content: noteAsset.content,
					};
				}
			}

			if (fileInfo) {
				setPendingPosition({ line, column: column || 1 });
				openFile(fileInfo);
			}
		},
		[openFile, projectData]
	);

	const openDiffView = useCallback(
		(filePath, assetInfo) => {
			const tabId = `diff_${filePath}`;

			const existingTab = openTabs.find((tab) => tab.id === tabId);
			if (existingTab) {
				setActiveTab(tabId);
				return;
			}

			// Determine language based on asset type
			let language = 'plaintext';
			if (assetInfo) {
				if (assetInfo.type === 'script' || assetInfo.type === 'object') {
					language = 'gml';
				} else if (assetInfo.type === 'note') {
					language = 'plaintext';
				}
			} else {
				// Fallback: determine from file path
				if (filePath.endsWith('.gml')) {
					language = 'gml';
				} else if (filePath.endsWith('.txt')) {
					language = 'plaintext';
				}
			}

			const newTab = {
				id: tabId,
				title: `Diff: ${assetInfo?.name || filePath.split('/').pop()}`,
				isDiff: true,
				filePath: filePath,
				language: language,
				assetInfo: assetInfo,
				isDirty: false,
			};

			setOpenTabs((prev) => [...prev, newTab]);
			setActiveTab(tabId);
		},
		[openTabs]
	);

	const value = {
		openTabs,
		activeTab,
		setActiveTab,
		openFile,
		openObjectFiles,
		openFileAtLocation,
		openDiffView,
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
