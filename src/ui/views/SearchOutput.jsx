import React, { useState, useEffect } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { useMainView } from '../contexts/MainViewContext';
import {
	FaChevronRight,
	FaChevronDown,
	FaArrowsRotate,
	FaRegSquareMinus,
} from 'react-icons/fa6';
import {
	LuSearch,
	LuReplace,
	LuCaseSensitive,
	LuWholeWord,
	LuRegex,
} from 'react-icons/lu';

import iconScript from '../assets/icon_script.png';
import iconObject from '../assets/icon_object.png';
import iconNote from '../assets/icon_notes.png';

export default function SearchOutput() {
	const [projectData, setProjectData] = useState(null);
	const [isSearching, setIsSearching] = useState(false);

	const { openFileAtLocation } = useEditor();
	const { searchState, updateSearchState } = useMainView();

	// Destructure from context state
	const {
		searchTerm,
		replaceTerm,
		searchResults,
		expandedFiles,
		matchCase,
		matchWholeWord,
		useRegex,
	} = searchState;

	useEffect(() => {
		const initializeProjectData = async () => {
			// First try to get from window.currentProjectData
			if (window.currentProjectData) {
				setProjectData(window.currentProjectData);
				return;
			}

			// If not available, try to get current project data via API
			if (window.api?.getCurrentProjectData) {
				try {
					const projectData = await window.api.getCurrentProjectData();
					if (projectData) {
						setProjectData(projectData);
						// Also set it in window for future use
						window.currentProjectData = projectData;
					}
				} catch (error) {
					// Silently handle error
				}
			}
		};

		initializeProjectData();

		// Listen for new project loads
		if (window.api?.onProjectLoaded) {
			const removeListener = window.api.onProjectLoaded((data) => {
				setProjectData(data);
				updateSearchState({
					searchResults: [],
					expandedFiles: {},
				});
			});

			return removeListener;
		}
	}, []);

	// Trigger search when searchTerm is updated externally (e.g., from shortcut)
	useEffect(() => {
		if (searchTerm && searchTerm.trim()) {
			clearTimeout(window.searchTimeout);
			window.searchTimeout = setTimeout(() => performSearch(), 300);
		}
	}, [searchTerm]); // Only trigger when searchTerm changes

	const getAssetIcon = (type) => {
		switch (type) {
			case 'script':
				return (
					<img src={iconScript} alt="script" className="asset-icon script" />
				);
			case 'object':
				return (
					<img src={iconObject} alt="object" className="asset-icon object" />
				);
			case 'note':
				return <img src={iconNote} alt="note" className="asset-icon note" />;
			default:
				return null;
		}
	};

	const searchInContent = (content, searchTerm, options) => {
		if (!content || !searchTerm) return [];

		const { matchCase, matchWholeWord, useRegex } = options;
		const results = [];
		const lines = content.split('\n');

		let searchPattern;

		try {
			if (useRegex) {
				const flags = matchCase ? 'g' : 'gi';
				searchPattern = new RegExp(searchTerm, flags);
			} else {
				const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				let pattern = matchWholeWord ? `\\b${escapedTerm}\\b` : escapedTerm;
				const flags = matchCase ? 'g' : 'gi';
				searchPattern = new RegExp(pattern, flags);
			}
		} catch (error) {
			// Invalid regex, fall back to literal search
			const flags = matchCase ? 'g' : 'gi';
			const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			searchPattern = new RegExp(escapedTerm, flags);
		}

		lines.forEach((line, index) => {
			const matches = [...line.matchAll(searchPattern)];
			matches.forEach((match) => {
				const lineNumber = index + 1;
				const columnNumber = match.index + 1;

				// Create a preview with the match highlighted
				const maxLength = 100;
				let preview = line.trim();

				if (preview.length > maxLength) {
					const matchStart = match.index;
					const start = Math.max(0, matchStart - 30);
					const end = Math.min(preview.length, matchStart + 70);

					preview =
						(start > 0 ? '...' : '') +
						preview.substring(start, end) +
						(end < preview.length ? '...' : '');
				}

				results.push({
					line: lineNumber,
					column: columnNumber,
					preview: preview,
					match: match[0],
				});
			});
		});

		return results;
	};

	const performSearch = async () => {
		if (!searchTerm) {
			return;
		}

		// Try to get current project data if we don't have it
		let currentProjectData = projectData;
		if (!currentProjectData && window.currentProjectData) {
			currentProjectData = window.currentProjectData;
			setProjectData(currentProjectData);
		}

		// Last resort: try to get from API
		if (!currentProjectData && window.api?.getCurrentProjectData) {
			try {
				currentProjectData = await window.api.getCurrentProjectData();
				if (currentProjectData) {
					setProjectData(currentProjectData);
					window.currentProjectData = currentProjectData;
				}
			} catch (error) {
				// Silently handle error
			}
		}

		if (!currentProjectData) {
			return;
		}

		setIsSearching(true);
		updateSearchState({ searchResults: [] });

		const results = [];
		const searchOptions = { matchCase, matchWholeWord, useRegex };

		// Search in scripts
		if (currentProjectData.assets && currentProjectData.assets.scripts) {
			currentProjectData.assets.scripts.forEach((script) => {
				const matches = searchInContent(
					script.content,
					searchTerm,
					searchOptions
				);
				if (matches.length > 0) {
					results.push({
						type: 'script',
						name: script.name,
						asset: script,
						matches: matches,
					});
				}
			});
		}

		// Search in object events
		if (currentProjectData.assets && currentProjectData.assets.objects) {
			currentProjectData.assets.objects.forEach((object) => {
				if (object.events) {
					object.events.forEach((event) => {
						const matches = searchInContent(
							event.content,
							searchTerm,
							searchOptions
						);
						if (matches.length > 0) {
							const eventName = event.name.replace('.gml', '');
							results.push({
								type: 'object',
								name: object.name,
								eventName: eventName,
								asset: object,
								matches: matches,
							});
						}
					});
				}
			});
		}

		// Search in notes
		if (currentProjectData.assets && currentProjectData.assets.notes) {
			currentProjectData.assets.notes.forEach((note) => {
				const matches = searchInContent(
					note.content,
					searchTerm,
					searchOptions
				);
				if (matches.length > 0) {
					results.push({
						type: 'note',
						name: note.name,
						asset: note,
						matches: matches,
					});
				}
			});
		}

		// Auto-expand first few results
		const autoExpand = {};
		results.slice(0, 3).forEach((result, index) => {
			const key = `${result.type}-${result.name}${
				result.eventName ? '-' + result.eventName : ''
			}`;
			autoExpand[key] = true;
		});

		updateSearchState({
			searchResults: results,
			expandedFiles: autoExpand,
		});
		setIsSearching(false);
	};

	const performReplace = async () => {
		// Get current project data if we don't have it
		let currentProjectData = projectData;
		if (!currentProjectData && window.currentProjectData) {
			currentProjectData = window.currentProjectData;
			setProjectData(currentProjectData);
		}

		if (!searchTerm || !currentProjectData || !window.api?.replaceInFiles)
			return;

		const replaceOptions = {
			searchTerm,
			replaceTerm,
			matchCase,
			matchWholeWord,
			useRegex,
		};

		try {
			await window.api.replaceInFiles(replaceOptions);
			// Refresh project and search results
			window.menu?.refreshProject?.();
			performSearch();
		} catch (error) {
			alert('Replace failed: ' + error.message);
		}
	};

	const toggleFileExpansion = (fileKey) => {
		updateSearchState({
			expandedFiles: {
				...expandedFiles,
				[fileKey]: !expandedFiles[fileKey],
			},
		});
	};

	const handleResultClick = (result, match) => {
		const assetInfo = {
			name: result.name,
			type: result.type,
			eventName: result.eventName,
		};

		openFileAtLocation(assetInfo, match.line, match.column);
	};

	const handleSearchKeyDown = (e) => {
		if (e.key === 'Enter') {
			performSearch();
		}
	};

	const getTotalMatches = () => {
		return searchResults.reduce(
			(total, result) => total + result.matches.length,
			0
		);
	};

	return (
		<div id="explorer">
			<div id="explorer-header">
				<span className="title">Search</span>
				<ul className="actions">
					<li title="Refresh">
						<button onClick={performSearch}>
							<FaArrowsRotate />
						</button>
					</li>
					<li title="Collapse All">
						<button onClick={() => updateSearchState({ expandedFiles: {} })}>
							<FaRegSquareMinus />
						</button>
					</li>
				</ul>
			</div>

			<div id="explorer-content">
				<div className="search-inputs">
					{/* Search input */}
					<div className="input-container">
						<input
							type="text"
							placeholder="Search"
							value={searchTerm}
							onChange={(e) => {
								updateSearchState({ searchTerm: e.target.value });
								if (e.target.value.trim()) {
									// Debounce the search to avoid too many searches
									clearTimeout(window.searchTimeout);
									window.searchTimeout = setTimeout(() => performSearch(), 300);
								} else {
									updateSearchState({ searchResults: [] });
								}
							}}
							onKeyDown={handleSearchKeyDown}
							className="search-input"
						/>
						<button
							className="search-button"
							onClick={performSearch}
							disabled={!searchTerm || isSearching}>
							<LuSearch />
						</button>
					</div>

					{/* Replace input (always visible) */}
					<div className="input-container">
						<input
							type="text"
							placeholder="Replace"
							value={replaceTerm}
							onChange={(e) =>
								updateSearchState({ replaceTerm: e.target.value })
							}
							className="replace-input"
						/>
						<button
							className="replace-button"
							onClick={performReplace}
							disabled={!searchTerm || !replaceTerm}
							title="Replace All">
							<LuReplace />
						</button>
					</div>

					{/* Search options */}
					<div className="search-options">
						<button
							className={`option-button ${matchCase ? 'active' : ''}`}
							onClick={() => updateSearchState({ matchCase: !matchCase })}
							title="Match Case">
							<LuCaseSensitive />
						</button>
						<button
							className={`option-button ${matchWholeWord ? 'active' : ''}`}
							onClick={() =>
								updateSearchState({ matchWholeWord: !matchWholeWord })
							}
							title="Match Whole Word">
							<LuWholeWord />
						</button>
						<button
							className={`option-button ${useRegex ? 'active' : ''}`}
							onClick={() => updateSearchState({ useRegex: !useRegex })}
							title="Use Regular Expression">
							<LuRegex />
						</button>
					</div>
				</div>

				{/* Results */}
				<div className="search-results">
					{isSearching && <div className="search-status">Searching...</div>}

					{!isSearching && searchTerm && searchResults.length === 0 && (
						<div className="no-results">
							No results found for "{searchTerm}"
						</div>
					)}

					{!isSearching && searchResults.length > 0 && (
						<div className="results-summary">
							{getTotalMatches()} results in {searchResults.length} files
						</div>
					)}

					{searchResults.map((result) => {
						const fileKey = `${result.type}-${result.name}${
							result.eventName ? '-' + result.eventName : ''
						}`;
						const isExpanded = expandedFiles[fileKey];
						const displayName = result.eventName
							? `${result.name} (${result.eventName})`
							: result.name;

						return (
							<div key={fileKey} className="search-result-file">
								<div
									className="file-header"
									onClick={() => toggleFileExpansion(fileKey)}>
									{isExpanded ? (
										<FaChevronDown className="chevron" />
									) : (
										<FaChevronRight className="chevron" />
									)}
									{getAssetIcon(result.type)}
									<span className="file-name">{displayName}</span>
									<span className="match-count">({result.matches.length})</span>
								</div>

								{isExpanded && (
									<div className="match-list">
										{result.matches.map((match, index) => (
											<div
												key={index}
												className="match-item"
												onClick={() => handleResultClick(result, match)}>
												<span className="line-number">{match.line}</span>
												<span className="match-preview">{match.preview}</span>
											</div>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
