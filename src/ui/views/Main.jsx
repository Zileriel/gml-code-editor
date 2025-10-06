import React from 'react';
import Explorer from './Explorer';
import SearchOutput from './SearchOutput';
import SourceControl from './SourceControl';
import EditorView from './EditorView';
import { useMainView, VIEW_TYPES } from '../contexts/MainViewContext';

export default function Main() {
	const { activeView } = useMainView();

	const renderLeftPanel = () => {
		switch (activeView) {
			case VIEW_TYPES.SEARCH:
				return <SearchOutput />;
			case VIEW_TYPES.SOURCE_CONTROL:
				return <SourceControl />;
			case VIEW_TYPES.EXPLORER:
			default:
				return <Explorer />;
		}
	};

	return (
		<div id="main">
			{renderLeftPanel()}
			<EditorView />
		</div>
	);
}
