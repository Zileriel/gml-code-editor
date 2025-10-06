import React, { useState, useEffect } from 'react';
import { useEditor } from '../contexts/EditorContext';
import RemoteConfigDialog from '../components/RemoteConfigDialog';
import {
	FaChevronRight,
	FaChevronDown,
	FaArrowsRotate,
	FaRegSquareMinus,
} from 'react-icons/fa6';
import {
	LuGitBranch,
	LuCheck,
	LuDownload,
	LuUpload,
	LuRefreshCw,
	LuPlus,
	LuUndo2,
	LuFileText,
} from 'react-icons/lu';

export default function SourceControl() {
	const [projectData, setProjectData] = useState(null);
	const [gitStatus, setGitStatus] = useState(null);
	const [isGitRepo, setIsGitRepo] = useState(false);
	const [commitMessage, setCommitMessage] = useState('');
	const [changes, setChanges] = useState([]);
	const [stagedChanges, setStagedChanges] = useState([]);
	const [unstagedChanges, setUnstagedChanges] = useState([]);
	const [currentBranch, setCurrentBranch] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [loadingOperation, setLoadingOperation] = useState('');
	const [showRemoteDialog, setShowRemoteDialog] = useState(false);
	const [pendingOperation, setPendingOperation] = useState(null);

	const { openFileAtLocation, openDiffView } = useEditor();

	// Helper function to notify other components of Git status changes
	const notifyGitStatusChanged = () => {
		window.dispatchEvent(
			new CustomEvent('gitStatusChanged', {
				detail: { timestamp: Date.now() },
			})
		);
	};

	// Helper function to set operation status in StatusBar
	const setOperationStatus = (status, clear = false) => {
		window.dispatchEvent(
			new CustomEvent('gitOperationUpdate', {
				detail: { status, clear },
			})
		);
	};

	// Handle remote configuration
	const handleRemoteConfig = async (remoteUrl) => {
		try {
			// Get project name for the remote name
			const projectName = projectData?.name || 'origin';
			
			// Add remote
			await window.api?.gitAddRemote?.(projectName, remoteUrl);
			
			// Set upstream tracking
			await window.api?.gitSetUpstream?.(projectName, currentBranch);
			
			// Execute the pending operation
			if (pendingOperation === 'pull') {
				await pullChanges();
			} else if (pendingOperation === 'push') {
				await pushChanges();
			}
			
			setPendingOperation(null);
		} catch (error) {
			throw error;
		}
	};	useEffect(() => {
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
					console.error(
						'SourceControl: Failed to get current project data:',
						error
					);
				}
			}
		};

		initializeProjectData();
		initializeGitStatus();

		// Listen for project loads
		if (window.api?.onProjectLoaded) {
			const removeListener = window.api.onProjectLoaded((data) => {
				setProjectData(data);
				initializeGitStatus();
			});
			return removeListener;
		}
	}, []);

	const initializeGitStatus = async () => {
		setIsLoading(true);
		try {
			// Check if git repo exists and get status
			const status = await window.api?.getGitStatus?.();

			if (status) {
				setIsGitRepo(true);
				setGitStatus(status);
				
				// Filter out .yy files and clean up paths
				const allFiles = status.files || [];
				const relevantFiles = allFiles.filter(file => {
					// Remove accidental quotes and filter out .yy files
					const cleanPath = file.path.replace(/^"|"$/g, '');
					file.path = cleanPath; // Update the path to clean version
					return !cleanPath.endsWith('.yy') && !cleanPath.endsWith('"');
				});
				
				// Separate staged and unstaged changes
				const staged = relevantFiles.filter(file => file.staged);
				const unstaged = relevantFiles.filter(file => !file.staged);
				
				setChanges(relevantFiles);
				setStagedChanges(staged);
				setUnstagedChanges(unstaged);
				setCurrentBranch(status.branch || 'main');
			} else {
				setIsGitRepo(false);
				setChanges([]);
				setStagedChanges([]);
				setUnstagedChanges([]);
				setCurrentBranch('');
			}
		} catch (error) {
			setIsGitRepo(false);
			setChanges([]);
			setStagedChanges([]);
			setUnstagedChanges([]);
			setCurrentBranch('');
		}
		setIsLoading(false);
	};

	const initializeGitRepo = async () => {
		try {
			await window.api?.initGitRepo?.();
			await initializeGitStatus();
		} catch (error) {
			alert('Failed to initialize Git repository: ' + error.message);
		}
	};

	const commitChanges = async () => {
		if (!commitMessage.trim()) {
			alert('Please enter a commit message');
			return;
		}

		try {
			setLoadingOperation('commit');
			setOperationStatus('Committing changes...');
			
			// Stage all changes and commit
			await window.api?.gitCommit?.(commitMessage);
			setCommitMessage('');
			await initializeGitStatus();
			notifyGitStatusChanged();
			
			setOperationStatus('Commit successful', true);
		} catch (error) {
			setOperationStatus('Commit failed', true);
			alert('Failed to commit changes: ' + error.message);
		} finally {
			setLoadingOperation('');
		}
	};

	const pullChanges = async () => {
		try {
			setLoadingOperation('pull');
			setOperationStatus('Pulling changes...');
			
			await window.api?.gitPull?.();
			await initializeGitStatus();
			notifyGitStatusChanged();
			
			setOperationStatus('Pull successful', true);
		} catch (error) {
			if (error.message.includes('no tracking information') || error.message.includes('No configured push destination')) {
				setPendingOperation('pull');
				setShowRemoteDialog(true);
			} else {
				setOperationStatus('Pull failed', true);
				alert('Failed to pull changes: ' + error.message);
			}
		} finally {
			setLoadingOperation('');
		}
	};

	const pushChanges = async () => {
		try {
			setLoadingOperation('push');
			setOperationStatus('Pushing changes...');
			
			await window.api?.gitPush?.();
			await initializeGitStatus();
			notifyGitStatusChanged();
			
			setOperationStatus('Push successful', true);
		} catch (error) {
			if (error.message.includes('No configured push destination') || error.message.includes('no tracking information')) {
				setPendingOperation('push');
				setShowRemoteDialog(true);
			} else {
				setOperationStatus('Push failed', true);
				alert('Failed to push changes: ' + error.message);
			}
		} finally {
			setLoadingOperation('');
		}
	};

	const fetchChanges = async () => {
		try {
			setLoadingOperation('fetch');
			setOperationStatus('Fetching changes...');
			
			await window.api?.gitFetch?.();
			await initializeGitStatus();
			notifyGitStatusChanged();
			
			setOperationStatus('Fetch successful', true);
		} catch (error) {
			setOperationStatus('Fetch failed', true);
			alert('Failed to fetch changes: ' + error.message);
		} finally {
			setLoadingOperation('');
		}
	};

	const revertFile = async (filePath) => {
		if (confirm(`Are you sure you want to revert changes to ${filePath}?`)) {
			try {
				await window.api?.gitRevertFile?.(filePath);
				await initializeGitStatus();
				notifyGitStatusChanged();
			} catch (error) {
				alert('Failed to revert file: ' + error.message);
			}
		}
	};

	const stageFile = async (filePath) => {
		try {
			await window.api?.gitStageFile?.(filePath);
			await initializeGitStatus();
			notifyGitStatusChanged();
		} catch (error) {
			alert('Failed to stage file: ' + error.message);
		}
	};

	const unstageFile = async (filePath) => {
		try {
			await window.api?.gitUnstageFile?.(filePath);
			await initializeGitStatus();
			notifyGitStatusChanged();
		} catch (error) {
			alert('Failed to unstage file: ' + error.message);
		}
	};

	const getStatusTitle = (status) => {
		switch (status) {
			case 'M':
				return 'Modified';
			case 'A':
				return 'Added';
			case 'D':
				return 'Deleted';
			case 'U':
			case '??':
				return 'Untracked';
			case 'R':
				return 'Renamed';
			default:
				return 'Unknown';
		}
	};

	const isExplorerRelevantFile = (filePath) => {
		// Only show .gml files from scripts/objects and files from notes/
		const normalizedPath = filePath.toLowerCase();

		if (
			normalizedPath.includes('scripts/') &&
			normalizedPath.endsWith('.gml')
		) {
			return true;
		}
		if (
			normalizedPath.includes('objects/') &&
			normalizedPath.endsWith('.gml')
		) {
			return true;
		}
		if (normalizedPath.includes('notes/')) {
			return true;
		}

		return false;
	};

	const getDisplayFileName = (filePath) => {
		const parts = filePath.split('/');

		// For object events: objects/obj_name/Event_Name.gml -> obj_name
		if (filePath.includes('objects/') && filePath.endsWith('.gml')) {
			const objectIndex = parts.findIndex((p) => p === 'objects');
			if (objectIndex >= 0 && parts[objectIndex + 1]) {
				return parts[objectIndex + 1]; // Return object name
			}
		}

		// For scripts: scripts/script_name/script_name.gml -> script_name
		if (filePath.includes('scripts/') && filePath.endsWith('.gml')) {
			const scriptIndex = parts.findIndex((p) => p === 'scripts');
			if (scriptIndex >= 0 && parts[scriptIndex + 1]) {
				return parts[scriptIndex + 1]; // Return script name
			}
		}

		// For notes: keep original filename with extension
		if (filePath.includes('notes/')) {
			return filePath.split('/').pop();
		}

		// Default: return filename without .gml extension
		const fileName = filePath.split('/').pop();
		return fileName.replace('.gml', '');
	};

	const mapToExplorerPath = (filePath) => {
		const parts = filePath.split('/');

		if (filePath.includes('scripts/')) {
			const scriptIndex = parts.findIndex((p) => p === 'scripts');
			if (scriptIndex >= 0 && parts[scriptIndex + 1]) {
				const scriptName = parts[scriptIndex + 1];
				return `Scripts > ${scriptName}`;
			}
		} else if (filePath.includes('objects/') && filePath.endsWith('.gml')) {
			const objectIndex = parts.findIndex((p) => p === 'objects');
			if (objectIndex >= 0 && parts[objectIndex + 1]) {
				const objectName = parts[objectIndex + 1];
				// Extract event name from filename
				const eventFile = parts[parts.length - 1];
				const eventName = eventFile.replace('.gml', '');
				return eventName; // Just show the event name as path
			}
		} else if (filePath.includes('notes/')) {
			const noteIndex = parts.findIndex((p) => p === 'notes');
			if (noteIndex >= 0 && parts[noteIndex + 1]) {
				const noteName = parts[noteIndex + 1];
				return `Notes > ${noteName}`;
			}
		}

		return filePath; // Fallback to original path
	};

	const viewDiff = async (filePath) => {
		try {
			// Skip directories
			if (filePath.endsWith('/')) {
				return;
			}

			// Convert file path to asset info for the diff viewer
			let assetInfo = null;
			console.log('Viewing diff for file:', filePath);

			if (filePath.includes('scripts/')) {
				// Extract script name from path like "scripts/scr_test/scr_test.gml"
				const parts = filePath.split('/');
				const scriptName = parts[parts.indexOf('scripts') + 1];
				assetInfo = {
					name: scriptName,
					type: 'script',
				};
			} else if (filePath.includes('objects/')) {
				// Extract object name and event from path like "objects/obj_test/Create_0.gml"
				const parts = filePath.split('/');
				const objectName = parts[parts.indexOf('objects') + 1];
				const eventFile = parts[parts.length - 1];
				const eventName = eventFile.replace('.gml', '');
				assetInfo = {
					name: objectName,
					type: 'object',
					eventName: eventName,
				};
			} else if (filePath.includes('notes/')) {
				// Extract note name from path like "notes/note_example/note_example.txt"
				const parts = filePath.split('/');
				const noteName = parts[parts.indexOf('notes') + 1];
				assetInfo = {
					name: noteName,
					type: 'note',
				};
			}

			console.log('Opening diff for asset:', assetInfo);

			// Open diff view instead of normal file
			if (assetInfo) {
				openDiffView(filePath, assetInfo);
			} else {
				console.warn('Could not determine asset info for path:', filePath);
			}
		} catch (error) {
			console.error('Failed to view diff:', error);
		}
	};

	const hasProject = projectData && projectData.name;

	if (isLoading) {
		return (
			<div id="explorer">
				<div id="explorer-header">
					<span className="title">Source Control</span>
				</div>
				<div id="explorer-content">
					<div className="loading">Loading...</div>
				</div>
			</div>
		);
	}

	if (!hasProject) {
		return (
			<div id="explorer">
				<div id="explorer-header">
					<span className="title">Source Control</span>
				</div>
				<div id="explorer-content">
					<div className="no-project">
						<p>No project opened. Please open a GameMaker project first.</p>
					</div>
				</div>
			</div>
		);
	}

	if (!isGitRepo) {
		return (
			<div id="explorer">
				<div id="explorer-header">
					<span className="title">Source Control</span>
				</div>
				<div id="explorer-content">
					<div className="no-project">
						<p>No Git repository found in this project.</p>
						<button className="init-repo-button" onClick={initializeGitRepo}>
							<LuGitBranch />
							Initialize Repository
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div id="explorer">
			<div id="explorer-header">
				<span className="title">Source Control</span>
				<ul className="actions">
					<li title="Pull">
						<button 
							onClick={pullChanges} 
							disabled={loadingOperation === 'pull'}
							className={loadingOperation === 'pull' ? 'loading' : ''}>
							<LuDownload />
						</button>
					</li>
					<li title="Push">
						<button 
							onClick={pushChanges} 
							disabled={loadingOperation === 'push'}
							className={loadingOperation === 'push' ? 'loading' : ''}>
							<LuUpload />
						</button>
					</li>
					<li title="Fetch">
						<button 
							onClick={fetchChanges} 
							disabled={loadingOperation === 'fetch'}
							className={loadingOperation === 'fetch' ? 'loading' : ''}>
							<LuRefreshCw />
						</button>
					</li>
				</ul>
			</div>

			<div id="explorer-content">
				{/* Commit Section */}
				<div className="commit-section">
					<div className="commit-input-container">
						<input
							type="text"
							placeholder="Commit message"
							value={commitMessage}
							onChange={(e) => setCommitMessage(e.target.value)}
							className="commit-input"
							onKeyDown={(e) => {
								if (e.key === 'Enter' && commitMessage.trim()) {
									commitChanges();
								}
							}}
						/>
						<button
							className={`commit-button ${loadingOperation === 'commit' ? 'loading' : ''}`}
							onClick={commitChanges}
							disabled={
								!commitMessage.trim() ||
								changes.filter((change) => isExplorerRelevantFile(change.path))
									.length === 0 ||
								loadingOperation === 'commit'
							}
							title="Commit All Changes">
							<LuCheck />
						</button>
					</div>
				</div>

				{/* Staged Changes Section */}
				{stagedChanges.filter((change) => isExplorerRelevantFile(change.path)).length > 0 && (
					<div className="changes-section">
						<div className="folder-header">
							<span className="folder-name">
								Staged Changes (
								{
									stagedChanges.filter((change) => isExplorerRelevantFile(change.path))
										.length
								}
								)
							</span>
						</div>

						<div className="asset-list">
							{stagedChanges
								.filter((change) => isExplorerRelevantFile(change.path))
								.map((change, index) => {
									const fileName = getDisplayFileName(change.path);
									const explorerPath = mapToExplorerPath(change.path);
									return (
										<div
											key={`staged-${index}`}
											className="asset-item git-change-item"
											onClick={() => viewDiff(change.path)}>
											<div className="asset-info">
												<div className="asset-icon">
													<LuFileText />
												</div>
												<div className="file-info">
													<span className="asset-name">{fileName}</span>
													<span className="file-path">{explorerPath}</span>
												</div>
												<div
													className={`git-status status-${change.status.toLowerCase()}`}
													title={getStatusTitle(change.status)}></div>
											</div>
											<div className="asset-actions hover-actions">
												<button
													onClick={(e) => {
														e.stopPropagation();
														unstageFile(change.path);
													}}
													title="Unstage changes"
													className="action-button">
													<LuUndo2 />
												</button>
											</div>
										</div>
									);
								})}
						</div>
					</div>
				)}

				{/* Unstaged Changes List */}
				<div className="changes-section">
					<div className="folder-header">
						<span className="folder-name">
							Changes (
							{
								unstagedChanges.filter((change) => isExplorerRelevantFile(change.path))
									.length
							}
							)
						</span>
					</div>

					{unstagedChanges.filter((change) => isExplorerRelevantFile(change.path))
						.length === 0 ? (
						<div className="no-changes">No changes to commit</div>
					) : (
						<div className="asset-list">
							{unstagedChanges
								.filter((change) => isExplorerRelevantFile(change.path))
								.map((change, index) => {
									const fileName = getDisplayFileName(change.path);
									const explorerPath = mapToExplorerPath(change.path);
									return (
										<div
											key={`unstaged-${index}`}
											className="asset-item git-change-item"
											onClick={() => viewDiff(change.path)}>
											<div className="asset-info">
												<div className="asset-icon">
													<LuFileText />
												</div>
												<div className="file-info">
													<span className="asset-name">{fileName}</span>
													<span className="file-path">{explorerPath}</span>
												</div>
												<div
													className={`git-status status-${change.status.toLowerCase()}`}
													title={getStatusTitle(change.status)}></div>
											</div>
											<div className="asset-actions hover-actions">
												<button
													onClick={(e) => {
														e.stopPropagation();
														revertFile(change.path);
													}}
													title="Discard Changes">
													<LuUndo2 />
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														stageFile(change.path);
													}}
													title="Stage Changes">
													<LuPlus />
												</button>
											</div>
										</div>
									);
								})}
						</div>
					)}
				</div>
			</div>
			
			<RemoteConfigDialog
				isOpen={showRemoteDialog}
				onClose={() => {
					setShowRemoteDialog(false);
					setPendingOperation(null);
					setLoadingOperation('');
					setOperationStatus('');
				}}
				onConfirm={handleRemoteConfig}
				operation={pendingOperation}
			/>
		</div>
	);
}
