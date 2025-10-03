import React from 'react';
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
	return (
		<ul id="topbar">
			<img id="logo" src="./icon.png" width={20} height={20} alt="GM Lite" />
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
							<MenuItem label="No Recent Projects" enabled={false} />
						</Submenu>
					</MenuItem>
					<Separator />
					<MenuItem
						label="Save"
						accelerator="Ctrl+S"
						icon={<FiSave />}
						click={() => {}}
					/>
					<MenuItem
						label="Save As..."
						accelerator="Ctrl+Shift+S"
						icon={<FiSave />}
						click={() => {}}
					/>
					<Separator />
					<MenuItem
						label="Auto Save"
						type="checkbox"
						checked={true}
						click={() => {}}
					/>
					<MenuItem label="Preferences" click={() => {}}>
						<Submenu>
							<MenuItem
								label="Settings"
								accelerator="Ctrl+,"
								icon={<FiSettings />}
								click={() => {}}
							/>
							<MenuItem
								label="Keyboard Shortcuts"
								accelerator="Ctrl+K Ctrl+S"
								icon={<FiCommand />}
								click={() => {}}
							/>
						</Submenu>
					</MenuItem>
					<Separator />
					<MenuItem label="Quit" accelerator="Ctrl+Q" click={() => {}} />
				</Submenu>
			</li>
			<li>
				<Label>Edit</Label>
				<Submenu>
					<MenuItem
						label="Undo"
						accelerator="Ctrl+Z"
						icon={<FiRotateCcw />}
						click={() => {}}
					/>
					<MenuItem
						label="Redo"
						accelerator="Ctrl+Y"
						icon={<FiRotateCw />}
						click={() => {}}
					/>
					<Separator />
					<MenuItem
						label="Cut"
						accelerator="Ctrl+X"
						icon={<FiScissors />}
						click={() => {}}
					/>
					<MenuItem
						label="Copy"
						accelerator="Ctrl+C"
						icon={<FiCopy />}
						click={() => {}}
					/>
					<MenuItem
						label="Paste"
						accelerator="Ctrl+V"
						icon={<FiClipboard />}
						click={() => {}}
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
						click={() => {}}
					/>
					<Separator />
					<MenuItem label="Appearance" click={() => {}}>
						<Submenu>
							<MenuItem
								label="Toggle Full Screen"
								accelerator="F11"
								icon={<FiMaximize />}
								click={() => {}}
							/>
							<Separator />
							<MenuItem
								label="Reset Zoom"
								accelerator="Ctrl+0"
								click={() => {}}
							/>
							<MenuItem
								label="Zoom In"
								accelerator="Ctrl+="
								icon={<FiZoomIn />}
								click={() => {}}
							/>
							<MenuItem
								label="Zoom Out"
								accelerator="Ctrl+-"
								icon={<FiZoomOut />}
								click={() => {}}
							/>
							<Separator />
							<MenuItem label="Themes" click={() => {}}>
								<Submenu>
									<MenuItem
										label="Default"
										type="radio"
										checked={true}
										click={() => {}}
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
						click={() => {}}
					/>
					<MenuItem
						label="Search All Files"
						accelerator="Ctrl+Shift+F"
						icon={<FiSearch />}
						click={() => {}}
					/>
					<Separator />
					<MenuItem
						label="Open Project Folder"
						icon={<FiFolder />}
						click={() => {}}
					/>
					<MenuItem
						label="Toggle Developer Tools"
						accelerator="Ctrl+Shift+I"
						click={() => {}}
					/>
				</Submenu>
			</li>
			<li>
				<Label>Help</Label>
				<Submenu>
					<MenuItem label="Welcome" icon={<FiHelpCircle />} click={() => {}} />
					<Separator />
					<MenuItem label="Documentation" icon={<FiBook />} click={() => {}} />
					<MenuItem
						label="Discord"
						icon={<FiMessageSquare />}
						click={() => {}}
					/>
					<MenuItem label="GitHub" icon={<FiGithub />} click={() => {}} />
					<Separator />
					<MenuItem label="Check for Updates" click={() => {}} />
					<MenuItem
						label="Report an Issue"
						icon={<FiAlertCircle />}
						click={() => {}}
					/>
					<Separator />
					<MenuItem label="About" icon={<FiInfo />} click={() => {}} />
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
