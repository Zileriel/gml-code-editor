import React, { useCallback, useState } from 'react';
import { FaTimes, FaGripVertical, FaColumns } from 'react-icons/fa';
import MonacoEditor from '../components/MonacoEditor';
import { useEditor } from '../contexts/EditorContext';

const EditorView = () => {
	const {
		openTabs,
		activeTab,
		setActiveTab,
		closeTab,
		updateTabContent,
		reorderTabs,
	} = useEditor();
	const [draggedTab, setDraggedTab] = useState(null);
	const [draggedOver, setDraggedOver] = useState(null);
	const [splitEditor, setSplitEditor] = useState(false);
	const [leftTabs, setLeftTabs] = useState([]);
	const [rightTabs, setRightTabs] = useState([]);
	const [activeLeftTab, setActiveLeftTab] = useState(null);
	const [activeRightTab, setActiveRightTab] = useState(null);
	const [splitRatio, setSplitRatio] = useState(50);
	const [isResizing, setIsResizing] = useState(false);
	const containerRef = React.useRef(null);

	// Enable horizontal scrolling with mouse wheel on tabs
	const handleTabsWheel = useCallback((e) => {
		e.preventDefault();
		e.currentTarget.scrollLeft += e.deltaY;
	}, []);

	const handleContentChange = useCallback(
		(tabId, content) => {
			updateTabContent(tabId, content);
		},
		[updateTabContent]
	);

	const handleTabClick = useCallback(
		(tabId) => {
			setActiveTab(tabId);
		},
		[setActiveTab]
	);

	const handleTabClose = useCallback(
		(e, tabId) => {
			e.stopPropagation();
			closeTab(tabId);
		},
		[closeTab]
	);

	const handleLeftTabClose = useCallback(
		(e, tabId) => {
			e.stopPropagation();
			closeTab(tabId);

			setLeftTabs((prev) => prev.filter((tab) => tab.id !== tabId));
			if (activeLeftTab === tabId) {
				const remainingTabs = leftTabs.filter((tab) => tab.id !== tabId);
				setActiveLeftTab(remainingTabs[0]?.id || null);
			}
		},
		[closeTab, activeLeftTab, leftTabs]
	);

	const handleRightTabClose = useCallback(
		(e, tabId) => {
			e.stopPropagation();
			closeTab(tabId);

			setRightTabs((prev) => prev.filter((tab) => tab.id !== tabId));
			if (activeRightTab === tabId) {
				const remainingTabs = rightTabs.filter((tab) => tab.id !== tabId);
				setActiveRightTab(remainingTabs[0]?.id || null);
			}
		},
		[closeTab, activeRightTab, rightTabs]
	);

	const handleDragStart = useCallback((e, tabId) => {
		setDraggedTab(tabId);
		e.dataTransfer.effectAllowed = 'move';
	}, []);

	const handleDragOver = useCallback((e, targetTabId) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		setDraggedOver(targetTabId);
	}, []);

	const handleDragLeave = useCallback(() => {
		setDraggedOver(null);
	}, []);

	const handleDrop = useCallback(
		(e, targetTabId) => {
			e.preventDefault();
			if (draggedTab && draggedTab !== targetTabId) {
				reorderTabs(draggedTab, targetTabId);
			}
			setDraggedTab(null);
			setDraggedOver(null);
		},
		[draggedTab, reorderTabs]
	);

	const handleSplitToggle = useCallback(() => {
		if (!splitEditor) {
			const midPoint = Math.ceil(openTabs.length / 2);
			setLeftTabs(openTabs.slice(0, midPoint));
			setRightTabs(openTabs.slice(midPoint));
			setActiveLeftTab(activeTab);
			setActiveRightTab(openTabs[midPoint]?.id || null);
		} else {
			setLeftTabs([]);
			setRightTabs([]);
			setActiveLeftTab(null);
			setActiveRightTab(null);
		}
		setSplitEditor(!splitEditor);

		setTimeout(() => {
			if (containerRef.current) {
				const safeRatio = splitEditor ? 50 : splitRatio;
				containerRef.current.style.setProperty(
					'--split-ratio',
					`${safeRatio}%`
				);
				if (!splitEditor) {
					setSplitRatio(50);
				}
			}
		}, 0);
	}, [splitEditor, openTabs, activeTab, splitRatio]);

	const handleResizeStart = useCallback((e) => {
		setIsResizing(true);
		e.preventDefault();

		if (containerRef.current) {
			containerRef.current.classList.add('resizing');
		}
	}, []);

	const handleResizeMove = useCallback(
		(e) => {
			if (!isResizing || !containerRef.current) return;

			const rect = containerRef.current.getBoundingClientRect();

			const mouseX = Math.max(rect.left, Math.min(rect.right, e.clientX));
			const newRatio = ((mouseX - rect.left) / rect.width) * 100;

			const minRatio = 25;
			const maxRatio = 75;

			const clampedRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));

			containerRef.current.style.setProperty(
				'--split-ratio',
				`${clampedRatio}%`
			);

			const monacoContainers =
				containerRef.current.querySelectorAll('.monaco-editor');
			monacoContainers.forEach((container) => {
				if (container._monacoEditor) {
					container._monacoEditor.layout();
				}
			});

			setSplitRatio(clampedRatio);
		},
		[isResizing]
	);

	const handleResizeEnd = useCallback(() => {
		setIsResizing(false);

		if (containerRef.current) {
			containerRef.current.classList.remove('resizing');
		}
	}, []);

	React.useEffect(() => {
		if (isResizing) {
			document.addEventListener('mousemove', handleResizeMove);
			document.addEventListener('mouseup', handleResizeEnd);
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';
		} else {
			document.removeEventListener('mousemove', handleResizeMove);
			document.removeEventListener('mouseup', handleResizeEnd);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}

		return () => {
			document.removeEventListener('mousemove', handleResizeMove);
			document.removeEventListener('mouseup', handleResizeEnd);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};
	}, [isResizing, handleResizeMove, handleResizeEnd]);

	React.useEffect(() => {
		if (splitEditor && (leftTabs.length === 0 || rightTabs.length === 0)) {
			setSplitEditor(false);
			setLeftTabs([]);
			setRightTabs([]);
			setActiveLeftTab(null);
			setActiveRightTab(null);
		}
	}, [splitEditor, leftTabs.length, rightTabs.length]);

	if (openTabs.length === 0) {
		return (
			<div className="editor-container">
				<div className="editor-zero-state">
					<h3>No files open</h3>
					<p>Select a file from the Explorer to get started</p>
				</div>
			</div>
		);
	}

	const activeTabData = openTabs.find((tab) => tab.id === activeTab);

	const renderTabBar = (
		tabs,
		activeTabId,
		onTabClick,
		panelSide = '',
		onTabClose = handleTabClose
	) => (
		<div className="golden-tab-bar">
			<div className="tabs-scroll-container" onWheel={handleTabsWheel}>
				{tabs.map((tab, index) => (
					<div
						key={tab.id}
						className={`golden-tab ${tab.id === activeTabId ? 'active' : ''} ${
							draggedTab === tab.id ? 'dragging' : ''
						} ${draggedOver === tab.id ? 'drag-over' : ''}`}
						onClick={() => onTabClick(tab.id)}
						draggable
						onDragStart={(e) => handleDragStart(e, tab.id)}
						onDragOver={(e) => handleDragOver(e, tab.id)}
						onDragLeave={handleDragLeave}
						onDrop={(e) => handleDrop(e, tab.id)}>
						<FaGripVertical className="drag-handle" />
						<span className="tab-label">
							{tab.title}
							{tab.isDirty && <span className="dirty-indicator">●</span>}
						</span>
						<button
							className="tab-close"
							onClick={(e) => onTabClose(e, tab.id)}
							title="Close">
							<FaTimes />
						</button>
					</div>
				))}
			</div>
			{panelSide === '' && (
				<button
					className="split-button"
					onClick={handleSplitToggle}
					title={splitEditor ? 'Merge Editor' : 'Split Editor'}>
					<FaColumns />
				</button>
			)}
		</div>
	);

	const renderEditor = (tabData) => (
		<div className="golden-content">
			{tabData && (
				<MonacoEditor
					key={tabData.id}
					tabId={tabData.id}
					content={tabData.content}
					language={tabData.language}
					onContentChange={handleContentChange}
				/>
			)}
		</div>
	);

	if (splitEditor) {
		const leftActiveTab = leftTabs.find((tab) => tab.id === activeLeftTab);
		const rightActiveTab = rightTabs.find((tab) => tab.id === activeRightTab);

		return (
			<div className="editor-container split-editor" ref={containerRef}>
				<div className="editor-panel left-panel">
					{renderTabBar(
						leftTabs,
						activeLeftTab,
						setActiveLeftTab,
						'left',
						handleLeftTabClose
					)}
					{renderEditor(leftActiveTab)}
				</div>
				<div className="split-resizer" onMouseDown={handleResizeStart} />
				<div className="editor-panel right-panel">
					{renderTabBar(
						rightTabs,
						activeRightTab,
						setActiveRightTab,
						'right',
						handleRightTabClose
					)}
					{renderEditor(rightActiveTab)}
				</div>
			</div>
		);
	}

	return (
		<div className="editor-container">
			{renderTabBar(openTabs, activeTab, handleTabClick)}
			{renderEditor(activeTabData)}
		</div>
	);
};

export default EditorView;
