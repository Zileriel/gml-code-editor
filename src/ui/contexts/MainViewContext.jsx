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
	};

	const switchToSearch = (selectedText = '') => {
		setActiveView(VIEW_TYPES.SEARCH);
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
	};

	return (
		<MainViewContext.Provider value={value}>
			{children}
		</MainViewContext.Provider>
	);
};
