import React from 'react';

import {
	FaFileCirclePlus,
	FaFolderPlus,
	FaArrowsRotate,
	FaRegSquareMinus,
} from 'react-icons/fa6';

export default function Explorer() {
	return (
		<div id="explorer">
			<div id="explorer-header">
				<span className="title">Explorer</span>
				<ul className="actions">
					<li data-tooltip="New File">
						<button>
							<FaFileCirclePlus />
						</button>
					</li>
					<li data-tooltip="New Folder">
						<button>
							<FaFolderPlus />
						</button>
					</li>
					<li data-tooltip="Refresh">
						<button>
							<FaArrowsRotate />
						</button>
					</li>
					<li data-tooltip="Collapse">
						<button>
							<FaRegSquareMinus />
						</button>
					</li>
				</ul>
			</div>
		</div>
	);
}
