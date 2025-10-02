import React from 'react'
import { LuFiles, LuSearch, LuGitFork } from 'react-icons/lu';
import { useState } from 'react';


export default function Sidebar() {
  const [explorerChanges, setExplorerChanges] = useState(0);
  const [searchChanges, setSearchChanges] = useState(0);
  const [sourceControlChanges, setSourceControlChanges] = useState(0);

  return (
		<ul id="sidebar">
			<li className="active" data-tooltip="Explorer (Ctrl+Shift+E)" data-changes={explorerChanges}>
				<button>
					<LuFiles />
				</button>
			</li>
			<li data-tooltip="Search (Ctrl+Shift+F)" data-changes={searchChanges}>
				<button>
					<LuSearch />
				</button>
			</li>
			<li data-tooltip="Source Control (Ctrl+Shift+G)" data-changes={sourceControlChanges}>
				<button>
					<LuGitFork />
				</button>
			</li>
		</ul>
	);
}
