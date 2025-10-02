import React, { useEffect, useState } from 'react';

//#region Icons
import {
	FaTriangleExclamation,
	FaCircleXmark,
  FaCircleInfo,
  FaMagnifyingGlass,
} from 'react-icons/fa6';
//#endregion

export default function StatusBar() {
	const [problemStatus, setProblemStatus] = useState('No Problems');
	const [errors, setErrors] = useState(0);
	const [warnings, setWarnings] = useState(0);
	const [suggestions, setSuggestions] = useState(0);

	const [positionStatus, setPositionStatus] = useState('');
	const [line, setLine] = useState(0);
	const [column, setColumn] = useState(0);
	const [selected, setSelected] = useState(0);

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
				<li className="item">{positionStatus}</li>
			</ul>
		</div>
	);
}