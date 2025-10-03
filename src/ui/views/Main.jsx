import React from 'react';
import Explorer from './Explorer';
import EditorView from './EditorView';
import { EditorProvider } from '../contexts/EditorContext';

export default function Main() {
	return (
		<EditorProvider>
			<div id="main">
				<Explorer />
				<EditorView />
			</div>
		</EditorProvider>
	);
}
