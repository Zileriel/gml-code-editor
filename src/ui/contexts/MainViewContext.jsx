import React, { createContext, useContext, useState } from 'react';

// Available view types for the main area
export const VIEW_TYPES = {
	EXPLORER: 'explorer',
	SEARCH: 'search',
	SOURCE_CONTROL: 'source-control',
};

const MainViewContext = createContext();

export const useMainView = () => {
	const context = useContext(MainViewContext);
	if (!context) {
		throw new Error('useMainView must be used within a MainViewProvider');
	}
	return context;
};

export const MainViewProvider = ({ children }) => {
	const [activeView, setActiveView] = useState(VIEW_TYPES.EXPLORER);

	// Panel width management
	const DEFAULT_WIDTH = 250;
	const MIN_WIDTH = 150;
	const MAX_WIDTH = 400;
	const COLLAPSE_THRESHOLD = 150;

	const [panelWidths, setPanelWidths] = useState({
		[VIEW_TYPES.EXPLORER]: DEFAULT_WIDTH,
		[VIEW_TYPES.SEARCH]: DEFAULT_WIDTH,
		[VIEW_TYPES.SOURCE_CONTROL]: DEFAULT_WIDTH,
	});

	const [isCollapsed, setIsCollapsed] = useState(false);

	// Persistent search state
	const [searchState, setSearchState] = useState({
		searchTerm: '',
		replaceTerm: '',
		searchResults: [],
		expandedFiles: {},
		matchCase: false,
		matchWholeWord: false,
		useRegex: false,
	});

	const switchToExplorer = () => {
		setActiveView(VIEW_TYPES.EXPLORER);
		setIsCollapsed(false); // Always uncollapse when switching views
	};

	const switchToSearch = (selectedText = '') => {
		setActiveView(VIEW_TYPES.SEARCH);
		setIsCollapsed(false); // Always uncollapse when switching views
		// If selected text is provided, update search term
		if (selectedText) {
			setSearchState((prev) => ({
				...prev,
				searchTerm: selectedText,
			}));
		}
	};

	const switchToSourceControl = () => {
		setActiveView(VIEW_TYPES.SOURCE_CONTROL);
		setIsCollapsed(false); // Always uncollapse when switching views
	};

	// Panel width management functions
	const updatePanelWidth = (viewType, width) => {
		// Clamp width between min and max
		const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));

		setPanelWidths((prev) => ({
			...prev,
			[viewType]: clampedWidth,
		}));

		// Check if we should collapse
		if (width < COLLAPSE_THRESHOLD) {
			setIsCollapsed(true);
		} else {
			setIsCollapsed(false);
		}
	};

	const getCurrentPanelWidth = () => {
		return isCollapsed ? 0 : panelWidths[activeView];
	};

	const toggleCollapse = () => {
		setIsCollapsed(!isCollapsed);
	};

	const updateSearchState = (newState) => {
		setSearchState((prev) => ({
			...prev,
			...newState,
		}));
	};

	const isExplorerActive = () => {
		return activeView === VIEW_TYPES.EXPLORER;
	};

	const isSearchActive = () => {
		return activeView === VIEW_TYPES.SEARCH;
	};

	const isSourceControlActive = () => {
		return activeView === VIEW_TYPES.SOURCE_CONTROL;
	};

	const value = {
		activeView,
		switchToExplorer,
		switchToSearch,
		switchToSourceControl,
		isExplorerActive,
		isSearchActive,
		isSourceControlActive,
		searchState,
		updateSearchState,
		// Width management
		panelWidths,
		updatePanelWidth,
		getCurrentPanelWidth,
		isCollapsed,
		toggleCollapse,
		DEFAULT_WIDTH,
		MIN_WIDTH,
		MAX_WIDTH,
		COLLAPSE_THRESHOLD,
	};

	return (
		<MainViewContext.Provider value={value}>
			{children}
		</MainViewContext.Provider>
	);
};
