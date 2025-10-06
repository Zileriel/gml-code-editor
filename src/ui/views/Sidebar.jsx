import React from 'react';
import { LuFiles, LuSearch, LuGitFork } from 'react-icons/lu';
import { useState } from 'react';
import { useMainView } from '../contexts/MainViewContext';

export default function Sidebar() {
	const [explorerChanges, setExplorerChanges] = useState(0);
	const [searchChanges, setSearchChanges] = useState(0);
	const [sourceControlChanges, setSourceControlChanges] = useState(0);

	const { switchToExplorer, switchToSearch, isExplorerActive, isSearchActive } =
		useMainView();

	const handleExplorerClick = () => {
		switchToExplorer();
	};

	const handleSearchClick = () => {
		switchToSearch();
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
				title="Source Control (Ctrl+Shift+G)"
				data-changes={sourceControlChanges}>
				<button>
					<LuGitFork />
				</button>
			</li>
		</ul>
	);
}
