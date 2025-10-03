import React, { useState, useEffect } from 'react';
import { EditorStatusProvider } from './contexts/EditorStatusContext';
import Sidebar from './views/Sidebar';
import Main from './views/Main';
import StatusBar from './views/StatusBar';
import Topbar from './views/Topbar';

export default function App() {
	return (
		<EditorStatusProvider>
			<main>
				<Topbar />
				<Sidebar />
				<Main />
				<StatusBar />
			</main>
		</EditorStatusProvider>
	);
}
