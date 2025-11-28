import React, { useState, useEffect } from 'react';
import { useMainView } from '../contexts/MainViewContext';
import iconPng from '/icon.png';
import {
	FiFile,
	FiSave,
	FiSettings,
	FiCommand,
	FiSearch,
	FiFolder,
	FiHelpCircle,
	FiBook,
	FiGithub,
	FiAlertCircle,
	FiInfo,
	FiMessageSquare,
	FiRefreshCw,
	FiZoomIn,
	FiZoomOut,
	FiMaximize,
	FiScissors,
	FiCopy,
	FiClipboard,
	FiRotateCcw,
	FiRotateCw,
	FiChevronRight,
	FiCheck,
} from 'react-icons/fi';

export default function Topbar() {
	const [recentProjects, setRecentProjects] = useState([]);
	const [autoSave, setAutoSave] = useState(false);
	const { switchToSearch } = useMainView();

	const handleSave = async () => {
		if (window.editorActions?.saveCurrentTab) {
			try {
				const result = await window.editorActions.saveCurrentTab();
				if (result.success) {
					console.log('File saved successfully');
				} else {
					console.warn('Save failed:', result.message);
				}
			} catch (error) {
				console.error('Error saving file:', error);
			}
		}
	};

	const handleToggleAutoSave = async () => {
		if (window.menu?.toggleAutoSave) {
			try {
				const newValue = await window.menu.toggleAutoSave();
				setAutoSave(newValue);
			} catch (error) {
				console.error('Failed to toggle auto-save:', error);
			}
		}
	};

	useEffect(() => {
		// Load auto-save setting
		const loadAutoSave = async () => {
			if (window.menu?.getAutoSave) {
				try {
					const value = await window.menu.getAutoSave();
					setAutoSave(value);
				} catch (error) {
					console.error('Failed to load auto-save setting:', error);
				}
			}
		};

		loadAutoSave();
	}, []);

	useEffect(() => {
		// Auto-save timer (every 10 seconds when window is active)
		if (!autoSave) return;

		const autoSaveInterval = setInterval(async () => {
			// Check if window is focused
			if (document.hasFocus() && window.editorActions?.saveAllTabs) {
				try {
					await window.editorActions.saveAllTabs();
				} catch (error) {
					console.error('Auto-save failed:', error);
				}
			}
		}, 10000); // 10 seconds

		return () => clearInterval(autoSaveInterval);
	}, [autoSave]);

	useEffect(() => {
		const loadRecentProjects = async () => {
			if (window.menu?.getRecentProjects) {
				try {
					const projects = await window.menu.getRecentProjects();
					setRecentProjects(projects);
				} catch (error) {
					console.error('Failed to load recent projects:', error);
				}
			}
		};

		loadRecentProjects();

		if (window.api?.onProjectLoaded) {
			const removeListener = window.api.onProjectLoaded(() => {
				loadRecentProjects();
			});

			return removeListener;
		}
	}, []);

	const handleRecentProjectClick = async (projectPath) => {
		if (window.menu?.openRecentProject) {
			try {
				await window.menu.openRecentProject(projectPath);
			} catch (error) {
				console.error('Failed to open recent project:', error);
			}
		}
	};

	return (
		<ul id="topbar">
			<img id="logo" src={iconPng} width={20} height={20} alt="GM Lite" />
			<li>
				<Label>File</Label>
				<Submenu>
					<MenuItem
						label="New Window"
						accelerator="Ctrl+Shift+W"
						icon={<FiFile />}
						click={() => window.menu.newWindow()}
					/>
					<Separator />
					<MenuItem
						label="Open Project"
						accelerator="Ctrl+O"
						icon={<FiFolder />}
						click={() => window.menu.openProject()}
					/>
					<MenuItem label="Open Recent" click={() => {}}>
						<Submenu>
							{recentProjects.length === 0 ? (
								<MenuItem label="No Recent Projects" enabled={false} />
							) : (
								recentProjects.map((project, index) => (
									<MenuItem
										key={project.path}
										label={project.name}
										accelerator={index < 9 ? `Ctrl+${index + 1}` : undefined}
										click={() => handleRecentProjectClick(project.path)}
									/>
								))
							)}
						</Submenu>
					</MenuItem>
					<Separator />
					<MenuItem
						label="Save"
						accelerator="Ctrl+S"
						icon={<FiSave />}
						click={handleSave}
					/>
					<MenuItem
						label="Save As..."
						accelerator="Ctrl+Shift+S"
						icon={<FiSave />}
						enabled={false}
					/>
					<Separator />
					<MenuItem
						label="Auto Save"
						type="checkbox"
						checked={autoSave}
						click={handleToggleAutoSave}
					/>
					<MenuItem label="Preferences" enabled={false}>
						<Submenu>
							<MenuItem
								label="Settings"
								accelerator="Ctrl+,"
								icon={<FiSettings />}
								enabled={false}
							/>
							<MenuItem
								label="Keyboard Shortcuts"
								accelerator="Ctrl+K Ctrl+S"
								icon={<FiCommand />}
								enabled={false}
							/>
						</Submenu>
					</MenuItem>
					<Separator />
					<MenuItem label="Quit" accelerator="Ctrl+Q" enabled={false} />
				</Submenu>
			</li>
			<li>
				<Label>Edit</Label>
				<Submenu>
					<MenuItem
						label="Undo"
						accelerator="Ctrl+Z"
						icon={<FiRotateCcw />}
						enabled={false}
					/>
					<MenuItem
						label="Redo"
						accelerator="Ctrl+Y"
						icon={<FiRotateCw />}
						enabled={false}
					/>
					<Separator />
					<MenuItem
						label="Cut"
						accelerator="Ctrl+X"
						icon={<FiScissors />}
						enabled={false}
					/>
					<MenuItem
						label="Copy"
						accelerator="Ctrl+C"
						icon={<FiCopy />}
						enabled={false}
					/>
					<MenuItem
						label="Paste"
						accelerator="Ctrl+V"
						icon={<FiClipboard />}
						enabled={false}
					/>
				</Submenu>
			</li>
			<li>
				<Label>Build</Label>
				<Submenu>
					<MenuItem
						label="Run"
						accelerator="F5"
						click={async () => {
							try {
								await window.menu.runGame();
								console.log('Game run command sent');
							} catch (error) {
								console.error('Failed to run game:', error);
							}
						}}
					/>
				</Submenu>
			</li>
			<li>
				<Label>View</Label>
				<Submenu>
					<MenuItem
						label="Reload"
						accelerator="Ctrl+R"
						icon={<FiRefreshCw />}
						click={() => window.location.reload()}
					/>
					<Separator />
					<MenuItem label="Appearance" enabled={false}>
						<Submenu>
							<MenuItem
								label="Toggle Full Screen"
								accelerator="F11"
								icon={<FiMaximize />}
								click={() => {
									if (document.fullscreenElement) {
										document.exitFullscreen();
									} else {
										document.body.requestFullscreen();
									}
								}}
							/>
							<Separator />
							<MenuItem
								label="Reset Zoom"
								accelerator="Ctrl+0"
								click={() => window.menu?.resetZoom?.()}
							/>
							<MenuItem
								label="Zoom In"
								accelerator="Ctrl+="
								icon={<FiZoomIn />}
								click={() => window.menu?.zoomIn?.()}
							/>
							<MenuItem
								label="Zoom Out"
								accelerator="Ctrl+-"
								icon={<FiZoomOut />}
								click={() => window.menu?.zoomOut?.()}
							/>
							<Separator />
							<MenuItem label="Themes" enabled={false}>
								<Submenu>
									<MenuItem
										label="Default"
										type="radio"
										checked={true}
										enabled={false}
									/>
								</Submenu>
							</MenuItem>
						</Submenu>
					</MenuItem>
					<Separator />
					<MenuItem
						label="Search"
						accelerator="Ctrl+F"
						icon={<FiSearch />}
						enabled={false}
					/>
					<MenuItem
						label="Search All Files"
						accelerator="Ctrl+Shift+F"
						icon={<FiSearch />}
						click={() => switchToSearch()}
					/>
					<Separator />
					<MenuItem
						label="Open Project Folder"
						icon={<FiFolder />}
						click={() => window.menu?.openProjectFolder?.()}
					/>
					<MenuItem
						label="Toggle Developer Tools"
						accelerator="Ctrl+Shift+I"
						click={() => window.menu?.toggleDevTools?.()}
					/>
				</Submenu>
			</li>
			<li>
				<Label>Help</Label>
				<Submenu>
					<MenuItem label="Welcome" icon={<FiHelpCircle />} enabled={false} />
					<Separator />
					<MenuItem label="Documentation" icon={<FiBook />} enabled={false} />
					<MenuItem
						label="Discord"
						icon={<FiMessageSquare />}
						enabled={false}
					/>
					<MenuItem label="GitHub" icon={<FiGithub />} enabled={false} />
					<Separator />
					<MenuItem label="Check for Updates" enabled={false} />
					<MenuItem
						label="Report an Issue"
						icon={<FiAlertCircle />}
						enabled={false}
					/>
					<Separator />
					<MenuItem label="About" icon={<FiInfo />} enabled={false} />
				</Submenu>
			</li>
		</ul>
	);
}

function Label({ children }) {
	return <span className="label">{children}</span>;
}

function Accelerator({ children }) {
	return <span className="accelerator">{children}</span>;
}

function Submenu({ children, nested }) {
	return <ul className={`submenu ${nested ? 'nested' : ''}`}>{children}</ul>;
}

function Separator() {
	return <div className="separator"></div>;
}

function MenuItem({
	label,
	accelerator,
	click,
	type,
	checked,
	enabled = true,
	icon,
	children,
}) {
	const hasSubmenu = Boolean(children);

	return (
		<li
			className={`menu-item ${!enabled ? 'disabled' : ''} ${
				hasSubmenu ? 'has-submenu' : ''
			}`}
			onClick={enabled ? click : undefined}>
			<div className="menu-item-content">
				<span className="icon-space">
					{type === 'checkbox' &&
						(checked ? <FiCheck className="check-icon" /> : null)}
					{type === 'radio' && (checked ? <div className="radio-dot" /> : null)}
					{!type && icon && <span className="custom-icon">{icon}</span>}
				</span>
				<Label>{label}</Label>
				{accelerator && <Accelerator>{accelerator}</Accelerator>}
				{hasSubmenu && <FiChevronRight className="submenu-arrow" />}
			</div>
			{children && React.cloneElement(children, { nested: true })}
		</li>
	);
}
