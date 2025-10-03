import React, { useState, useEffect } from 'react';
import { useEditor } from '../contexts/EditorContext';

import {
	FaFileCirclePlus,
	FaArrowsRotate,
	FaRegSquareMinus,
	FaFile,
	FaChevronRight,
	FaChevronDown,
} from 'react-icons/fa6';

import iconScript from '../assets/icon_script.png';
import iconObject from '../assets/icon_object.png';
import iconNote from '../assets/icon_notes.png';

export default function Explorer() {
	const [projectData, setProjectData] = useState(null);
	const [expandedFolders, setExpandedFolders] = useState({});
	const { openFile, openObjectFiles } = useEditor();

	useEffect(() => {
		if (window.api?.onProjectLoaded) {
			const removeListener = window.api.onProjectLoaded((data) => {
				setProjectData(data);
				setExpandedFolders({});
			});

			return removeListener;
		}
	}, []);

	const toggleFolder = (folderName) => {
		setExpandedFolders((prev) => ({
			...prev,
			[folderName]: !prev[folderName],
		}));
	};

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
				return <FaFile className="asset-icon" />;
		}
	};

	const handleAssetClick = (asset) => {
		if (asset.type === 'object') {
			openObjectFiles(asset);
		} else {
			openFile({
				asset,
				content: asset.content,
			});
		}
	};

	const renderAssetList = (assets, type) => {
		if (!assets || assets.length === 0) return null;

		const topLevelAssets = [];
		const groupedAssets = {};

		assets.forEach((asset) => {
			const parentName = asset.metadata?.parent?.name;

			if (!parentName || parentName === projectData?.name) {
				topLevelAssets.push(asset);
			} else {
				if (!groupedAssets[parentName]) {
					groupedAssets[parentName] = [];
				}
				groupedAssets[parentName].push(asset);
			}
		});

		const result = [];

		Object.entries(groupedAssets).forEach(([groupName, groupAssets]) => {
			const folderId = `${type}-${groupName}`;
			const isExpanded = expandedFolders[folderId] === true;

			result.push(
				<div key={groupName} className="asset-group">
					<div className="folder-header" onClick={() => toggleFolder(folderId)}>
						{isExpanded ? (
							<FaChevronDown className="chevron" />
						) : (
							<FaChevronRight className="chevron" />
						)}
						<span className="folder-name">{groupName}</span>
					</div>
					{isExpanded && (
						<div className="asset-list">
							{groupAssets.map((asset) => (
								<div
									key={asset.name}
									className="asset-item"
									onClick={() => handleAssetClick(asset)}>
									{getAssetIcon(asset.type)}
									<span className="asset-name">{asset.name}</span>
								</div>
							))}
						</div>
					)}
				</div>
			);
		});

		if (topLevelAssets.length > 0) {
			topLevelAssets.forEach((asset) => {
				result.push(
					<div
						key={asset.name}
						className="asset-item top-level"
						onClick={() => handleAssetClick(asset)}>
						{getAssetIcon(asset.type)}
						<span className="asset-name">{asset.name}</span>
					</div>
				);
			});
		}

		return result;
	};

	return (
		<div id="explorer">
			<div id="explorer-header">
				<span className="title">
					{projectData ? projectData.name : 'Explorer'}
				</span>
				<ul className="actions">
					<li data-tooltip="New File">
						<button>
							<FaFileCirclePlus />
						</button>
					</li>
					<li data-tooltip="Refresh">
						<button onClick={() => window.menu?.refreshProject?.()}>
							<FaArrowsRotate />
						</button>
					</li>
					<li data-tooltip="Collapse">
						<button
							onClick={() => {
								const collapsed = {};
								Object.keys(expandedFolders).forEach((key) => {
									collapsed[key] = false;
								});
								setExpandedFolders(collapsed);
							}}>
							<FaRegSquareMinus />
						</button>
					</li>
				</ul>
			</div>

			<div id="explorer-content">
				{!projectData ? (
					<div className="no-project">
						<p>No project loaded</p>
						<p>Use File → Open Project to get started</p>
					</div>
				) : (
					<div className="project-tree">
						{renderAssetList(projectData.assets.scripts, 'script')}
						{renderAssetList(projectData.assets.objects, 'object')}
						{renderAssetList(projectData.assets.notes, 'note')}
					</div>
				)}
			</div>
		</div>
	);
}
