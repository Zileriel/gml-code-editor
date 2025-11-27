import React, { useState, useRef, useCallback } from 'react';
import Explorer from './Explorer';
import SearchOutput from './SearchOutput';
import SourceControl from './SourceControl';
import EditorView from './EditorView';
import { useMainView, VIEW_TYPES } from '../contexts/MainViewContext';

export default function Main() {
	const {
		activeView,
		updatePanelWidth,
		getCurrentPanelWidth,
		isCollapsed,
		MIN_WIDTH,
		MAX_WIDTH,
	} = useMainView();

	const [isResizing, setIsResizing] = useState(false);
	const startXRef = useRef(0);
	const startWidthRef = useRef(0);

	// Resize handling
	const handleMouseDown = useCallback(
		(e) => {
			setIsResizing(true);
			startXRef.current = e.clientX;
			startWidthRef.current = getCurrentPanelWidth();
			e.preventDefault();
		},
		[getCurrentPanelWidth]
	);

	const handleMouseMove = useCallback(
		(e) => {
			if (!isResizing) return;

			const deltaX = e.clientX - startXRef.current;
			const newWidth = startWidthRef.current + deltaX;

			updatePanelWidth(activeView, newWidth);
		},
		[isResizing, activeView, updatePanelWidth]
	);

	const handleMouseUp = useCallback(() => {
		setIsResizing(false);
	}, []);

	// Add global mouse event listeners and body class for performance
	React.useEffect(() => {
		if (isResizing) {
			document.body.classList.add('resizing');
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);

			return () => {
				document.body.classList.remove('resizing');
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};
		}
	}, [isResizing, handleMouseMove, handleMouseUp]);

	const renderLeftPanel = () => {
		switch (activeView) {
			case VIEW_TYPES.SEARCH:
				return <SearchOutput />;
			case VIEW_TYPES.SOURCE_CONTROL:
				return <SourceControl />;
			case VIEW_TYPES.EXPLORER:
			default:
				return <Explorer />;
		}
	};

	const currentWidth = getCurrentPanelWidth();
	const resizeHandleWidth = 4;
	const sidebarWidth = 60;
	const totalLeftSpace =
		(isCollapsed ? 0 : currentWidth) +
		(isCollapsed ? 0 : resizeHandleWidth) +
		sidebarWidth;

	return (
		<div
			id="main"
			style={{
				'--left-space': `${totalLeftSpace}px`,
			}}>
			<div
				className={`left-panel ${isCollapsed ? 'collapsed' : ''}`}
				style={{
					width: isCollapsed ? '0px' : `${currentWidth}px`,
					minWidth: isCollapsed ? '0px' : `${MIN_WIDTH}px`,
					maxWidth: `${MAX_WIDTH}px`,
				}}>
				{!isCollapsed && renderLeftPanel()}
			</div>

			{!isCollapsed && (
				<div
					className={`resize-handle ${isResizing ? 'resizing' : ''}`}
					onMouseDown={handleMouseDown}
				/>
			)}

			<EditorView />
		</div>
	);
}
