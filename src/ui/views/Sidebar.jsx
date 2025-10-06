import React, { useState, useEffect } from 'react';
import { LuFiles, LuSearch, LuGitFork } from 'react-icons/lu';
import { useMainView } from '../contexts/MainViewContext';

export default function Sidebar() {
	const [explorerChanges, setExplorerChanges] = useState(0);
	const [searchChanges, setSearchChanges] = useState(0);
	const [sourceControlChanges, setSourceControlChanges] = useState(0);

	const {
		switchToExplorer,
		switchToSearch,
		switchToSourceControl,
		isExplorerActive,
		isSearchActive,
		isSourceControlActive,
	} = useMainView();

	useEffect(() => {
		// Load source control changes on mount
		loadSourceControlChanges();

		// Listen for project changes
		let removeProjectListener = null;
		if (window.api?.onProjectLoaded) {
			removeProjectListener = window.api.onProjectLoaded(() => {
				loadSourceControlChanges();
			});
		}

		// Listen for Git status changes from SourceControl component
		const handleGitStatusChange = () => {
			loadSourceControlChanges();
		};
		window.addEventListener('gitStatusChanged', handleGitStatusChange);

		return () => {
			if (removeProjectListener) {
				removeProjectListener();
			}
			window.removeEventListener('gitStatusChanged', handleGitStatusChange);
		};
	}, []);

	const isExplorerRelevantFile = (filePath) => {
		const normalizedPath = filePath.toLowerCase();

		// Only show .gml files for scripts and objects, .txt files for notes
		if (
			(normalizedPath.includes('scripts/') ||
				normalizedPath.includes('objects/')) &&
			normalizedPath.endsWith('.gml')
		) {
			return true;
		}
		if (normalizedPath.includes('notes/') && normalizedPath.endsWith('.txt')) {
			return true;
		}
		return false;
	};

	const loadSourceControlChanges = async () => {
		try {
			const status = await window.api?.getGitStatus?.();
			if (status?.files) {
				// Filter to only count Explorer-relevant files
				const relevantChanges = status.files.filter((change) =>
					isExplorerRelevantFile(change.path)
				);
				setSourceControlChanges(relevantChanges.length);
			} else {
				setSourceControlChanges(0);
			}
		} catch (error) {
			setSourceControlChanges(0);
		}
	};

	const handleExplorerClick = () => {
		switchToExplorer();
	};

	const handleSearchClick = () => {
		switchToSearch();
	};

	const handleSourceControlClick = () => {
		switchToSourceControl();
	};

	return (
		<ul id="sidebar">
			<li
				className={isExplorerActive() ? 'active' : ''}
				title="Explorer (Ctrl+Shift+E)"
				data-changes={explorerChanges}>
				<button onClick={handleExplorerClick}>
					<LuFiles />
				</button>
			</li>
			<li
				className={isSearchActive() ? 'active' : ''}
				title="Search (Ctrl+Shift+F)"
				data-changes={searchChanges}>
				<button onClick={handleSearchClick}>
					<LuSearch />
				</button>
			</li>
			<li
				className={isSourceControlActive() ? 'active' : ''}
				title="Source Control (Ctrl+Shift+G)"
				data-changes={sourceControlChanges}>
				<button onClick={handleSourceControlClick}>
					<LuGitFork />
				</button>
			</li>
		</ul>
	);
}
