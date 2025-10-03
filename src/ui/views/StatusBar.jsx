import React, { useEffect, useState } from 'react';
import { useEditorStatus } from '../contexts/EditorStatusContext';

//#region Icons
import {
	FaTriangleExclamation,
	FaCircleXmark,
	FaCircleInfo,
	FaMagnifyingGlass,
} from 'react-icons/fa6';
//#endregion

export default function StatusBar() {
	const { line, column, problems, currentFunction } = useEditorStatus();
	const [problemStatus, setProblemStatus] = useState('No Problems');
	const [errors, setErrors] = useState(0);
	const [warnings, setWarnings] = useState(0);
	const [suggestions, setSuggestions] = useState(0);
	const [positionStatus, setPositionStatus] = useState('');
	const [selected, setSelected] = useState(0);
	const [functionStatus, setFunctionStatus] = useState('');

	useEffect(() => {
		let status = [];

		if (errors > 0) {
			status.push(`Errors: ${errors}`);
		}
		if (warnings > 0) {
			status.push(`Warnings: ${warnings}`);
		}
		if (suggestions > 0) {
			status.push(`Suggestions: ${suggestions}`);
		}

		if (errors === 0 && warnings === 0 && suggestions === 0) {
			setProblemStatus('No Problems');
		} else {
			setProblemStatus(status.join(', '));
		}
	}, [errors, warnings, suggestions]);

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
		// Update problems from editor status context
		if (typeof problems === 'number') {
			setErrors(problems);
		} else if (Array.isArray(problems)) {
			setErrors(problems.length);
		}
	}, [problems]);

	return (
		<div id="statusbar">
			<ul className="left items">
				<li className="item">
					<button data-tooltip={problemStatus}>
						<div>
							<FaCircleXmark /> {errors}
						</div>
						<div>
							<FaTriangleExclamation /> {warnings}
						</div>
						<div>
							<FaCircleInfo /> {suggestions}
						</div>
					</button>
				</li>
			</ul>

			<ul className="right items">
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
