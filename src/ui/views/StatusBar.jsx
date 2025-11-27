import React, { useEffect, useState } from 'react';
import { useEditorStatus } from '../contexts/EditorStatusContext';
import { useEditor } from '../contexts/EditorContext';

//#region Icons
import {
	FaTriangleExclamation,
	FaCircleXmark,
	FaCircleInfo,
	FaMagnifyingGlass,
} from 'react-icons/fa6';
import { LuGitBranch, LuRefreshCw } from 'react-icons/lu';
//#endregion

export default function StatusBar() {
	const {
		line,
		column,
		problems,
		currentFunction,
		statusMessage,
		updateStatusMessage,
	} = useEditorStatus();
	const { goToNextProblem } = useEditor();
	const [problemStatus, setProblemStatus] = useState('No Problems');
	const [positionStatus, setPositionStatus] = useState('');
	const [selected, setSelected] = useState(0);
	const [functionStatus, setFunctionStatus] = useState('');
	const [currentBranch, setCurrentBranch] = useState('');
	const [gitOperation, setGitOperation] = useState('');

	// Expose updateStatusMessage globally
	useEffect(() => {
		window.updateStatusMessage = updateStatusMessage;
		return () => {
			delete window.updateStatusMessage;
		};
	}, [updateStatusMessage]);

	useEffect(() => {
		let status = [];

		let errorCount = 0;
		let warningCount = 0;
		let hintCount = 0;

		if (typeof problems === 'number') {
			errorCount = problems;
		} else if (typeof problems === 'object' && problems) {
			errorCount = problems.errors || 0;
			warningCount = problems.warnings || 0;
			hintCount = problems.hints || 0;
		}

		if (errorCount > 0) {
			status.push(`Errors: ${errorCount}`);
		}
		if (warningCount > 0) {
			status.push(`Warnings: ${warningCount}`);
		}
		if (hintCount > 0) {
			status.push(`Hints: ${hintCount}`);
		}

		if (errorCount === 0 && warningCount === 0 && hintCount === 0) {
			setProblemStatus('No Problems');
		} else {
			setProblemStatus(status.join(', '));
		}
	}, [problems]);

	useEffect(() => {
		let status = `Ln ${line}, Col ${column}`;

		if (selected > 0) {
			status += ` (${selected} selected)`;
		}

		setPositionStatus(status);
	}, [line, column, selected]);

	useEffect(() => {
		if (currentFunction) {
			// Handle both string and object formats for currentFunction
			if (typeof currentFunction === 'string') {
				setFunctionStatus(currentFunction);
			} else if (typeof currentFunction === 'object') {
				const { functionName, parameters, activeParameter } = currentFunction;
				if (parameters && parameters.length > 0) {
					// Show all parameters with highlighting for active one, optional params in brackets
					const paramNames = parameters
						.map((param, index) => {
							return param.optional ? `[${param.name}]` : param.name;
						})
						.join(', ');
					setFunctionStatus({
						text: `${functionName}(${paramNames})`,
						activeParam: activeParameter,
						params: parameters.map((p) =>
							p.optional ? `[${p.name}]` : p.name
						),
					});
				} else {
					setFunctionStatus(`${functionName}()`);
				}
			}
		} else {
			setFunctionStatus('');
		}
	}, [currentFunction]);

	useEffect(() => {
		// Load current branch on mount
		loadCurrentBranch();

		// Listen for project changes
		let removeProjectListener;
		if (window.api?.onProjectLoaded) {
			removeProjectListener = window.api.onProjectLoaded(() => {
				loadCurrentBranch();
			});
		}

		// Listen for Git operation status updates
		const handleGitOperationUpdate = (event) => {
			setGitOperation(event.detail.status);
			if (event.detail.clear) {
				setTimeout(() => setGitOperation(''), 3000);
			}
		};

		window.addEventListener('gitOperationUpdate', handleGitOperationUpdate);

		return () => {
			if (removeProjectListener) removeProjectListener();
			window.removeEventListener(
				'gitOperationUpdate',
				handleGitOperationUpdate
			);
		};
	}, []);

	const loadCurrentBranch = async () => {
		try {
			const branch = await window.api?.getCurrentBranch?.();
			setCurrentBranch(branch || '');
		} catch (error) {
			setCurrentBranch('');
		}
	};

	const hasProblems = () => {
		if (!problems) return false;
		if (typeof problems === 'number') return problems > 0;
		if (typeof problems === 'object') {
			return (
				(problems.errors || 0) +
					(problems.warnings || 0) +
					(problems.hints || 0) >
				0
			);
		}
		return false;
	};

	const handleProblemsClick = () => {
		if (!hasProblems()) {
			return; // No problems to navigate to
		}

		// Navigate to the next problem in Monaco
		goToNextProblem();
	};

	return (
		<div id="statusbar">
			<ul className="left items">
				<li className="item" title={problemStatus}>
					<button
						className={`problems-button ${
							hasProblems() ? 'has-problems' : 'no-problems'
						}`}
						onClick={handleProblemsClick}>
						<div>
							<FaCircleXmark />{' '}
							{typeof problems === 'object'
								? problems.errors || 0
								: typeof problems === 'number'
								? problems
								: 0}
						</div>
						<div>
							<FaTriangleExclamation />{' '}
							{typeof problems === 'object' ? problems.warnings || 0 : 0}
						</div>
						<div>
							<FaCircleInfo />{' '}
							{typeof problems === 'object' ? problems.hints || 0 : 0}
						</div>
					</button>
				</li>
				{gitOperation && (
					<li className="item git-operation" title="Git operation in progress">
						<LuRefreshCw className="spinning" /> {gitOperation}
					</li>
				)}
			</ul>

			<ul className="right items">
				{statusMessage && (
					<li className="item status-message">{statusMessage}</li>
				)}
				{currentBranch && (
					<li
						className="item git-branch"
						title={`Current Git branch: ${currentBranch}`}>
						<LuGitBranch /> {currentBranch}
					</li>
				)}
				{functionStatus && currentFunction && (
					<li className="item" style={{ fontWeight: 'bold' }}>
						{typeof functionStatus === 'string' ? (
							functionStatus
						) : (
							<>
								{functionStatus.text.substring(
									0,
									functionStatus.text.indexOf('(') + 1
								)}
								{functionStatus.params.map((param, index) => (
									<span key={index}>
										{index > 0 && ', '}
										<span
											style={{
												fontWeight:
													index === functionStatus.activeParam
														? 'bold'
														: 'normal',
											}}>
											{param}
										</span>
									</span>
								))}
								)
							</>
						)}
					</li>
				)}
				<li className="item">{positionStatus}</li>
			</ul>
		</div>
	);
}
