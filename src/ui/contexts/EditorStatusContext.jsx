import React, { createContext, useContext, useState, useCallback } from 'react';

const EditorStatusContext = createContext({
	line: 1,
	column: 1,
	problems: 0,
	currentFunction: null,
	updatePosition: () => {},
	updateProblems: () => {},
	updateCurrentFunction: () => {},
});

export const EditorStatusProvider = ({ children }) => {
	const [line, setLine] = useState(1);
	const [column, setColumn] = useState(1);
	const [problems, setProblems] = useState({
		errors: 0,
		warnings: 0,
		hints: 0,
		info: 0,
	});
	const [currentFunction, setCurrentFunction] = useState(null);

	const updatePosition = useCallback((newLine, newColumn) => {
		setLine(newLine);
		setColumn(newColumn);
	}, []);

	const updateProblems = useCallback((problemCount) => {
		// Handle both old format (number) and new format (object)
		if (typeof problemCount === 'number') {
			setProblems({ errors: problemCount, warnings: 0, hints: 0, info: 0 });
		} else if (typeof problemCount === 'object') {
			setProblems(problemCount);
		}
	}, []);

	const updateCurrentFunction = useCallback((functionInfo) => {
		setCurrentFunction(functionInfo);
	}, []);

	const updateEditorStatus = useCallback((status) => {
		if (status.line !== undefined && status.column !== undefined) {
			setLine(status.line);
			setColumn(status.column);
		}
		if (status.problems !== undefined) {
			// Handle both old format (number) and new format (object)
			if (typeof status.problems === 'number') {
				setProblems({
					errors: status.problems,
					warnings: 0,
					hints: 0,
					info: 0,
				});
			} else if (typeof status.problems === 'object') {
				setProblems(status.problems);
			}
		}
		if (status.currentFunction !== undefined) {
			setCurrentFunction(status.currentFunction);
		}
	}, []);

	const value = {
		line,
		column,
		problems,
		currentFunction,
		updatePosition,
		updateProblems,
		updateCurrentFunction,
		updateEditorStatus,
	};

	return (
		<EditorStatusContext.Provider value={value}>
			{children}
		</EditorStatusContext.Provider>
	);
};

export const useEditorStatus = () => {
	const context = useContext(EditorStatusContext);
	if (!context) {
		throw new Error(
			'useEditorStatus must be used within an EditorStatusProvider'
		);
	}
	return context;
};

export default EditorStatusContext;
