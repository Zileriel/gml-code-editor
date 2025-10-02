export const menuTemplate = [
	{
		label: 'File',
		submenu: [
			{
				label: 'New Window',
				accelerator: 'CmdOrCtrl+Shift+W',
				click: () => {},
			},
			{ type: 'separator' },
			{
				label: 'Open Project',
				accelerator: 'CmdOrCtrl+O',
				click: () => {},
			},
			{
				label: 'Open Recent',
				submenu: [{ label: 'No Recent Projects', enabled: false }],
			},
			{ type: 'separator' },
			{
				label: 'Save',
				accelerator: 'CmdOrCtrl+S',
				click: () => {},
			},
			{
				label: 'Save As...',
				accelerator: 'CmdOrCtrl+Shift+S',
				click: () => {},
			},
			{ type: 'separator' },
			{
				label: 'Auto Save',
				type: 'checkbox',
				checked: true,
				click: () => {},
			},
			{
				label: 'Preferences',
				submenu: [
					{ label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => {} },
					{
						label: 'Keyboard Shortcuts',
						accelerator: 'CmdOrCtrl+K CmdOrCtrl+S',
						click: () => {},
					},
				],
			},
			{ type: 'separator' },
			{ role: 'quit' },
		],
	},
	{
		label: 'Edit',
		submenu: [
			{ role: 'undo' },
			{ role: 'redo' },
			{ type: 'separator' },
			{ role: 'cut' },
			{ role: 'copy' },
			{ role: 'paste' },
		],
	},
	{
		label: 'View',
		submenu: [
			{ role: 'reload' },
			{ role: 'forceReload' },
			{ type: 'separator' },
			{
				label: 'Appearance',
				submenu: [
					{ role: 'togglefullscreen' },
					{ type: 'separator' },
					{ role: 'resetZoom' },
					{ role: 'zoomIn' },
					{ role: 'zoomOut' },
					{ type: 'separator' },
					{
						label: 'Themes',
						submenu: [
							{
								label: 'Default',
								click: () => {},
							},
						],
					},
				],
			},
			{ type: 'separator' },
			{
				label: 'Search',
				accelerator: 'CmdOrCtrl+F',
				click: () => {},
			},
			{
				label: 'Search All Files',
				accelerator: 'CmdOrCtrl+Shift+F',
				click: () => {},
			},
			{ type: 'separator' },
			{
				label: 'Open Project Folder',
				click: () => {},
			},
		],
	},
	{
		label: 'Help',
		submenu: [
			{
				label: 'Welcome',
				click: () => {},
			},
			{ type: 'separator' },
			{
				label: 'Documentation',
				click: () => {},
			},
			{
				label: 'Discord',
				click: () => {},
			},
			{
				label: 'GitHub',
				click: () => {},
			},
			{ type: 'separator' },

			{
				label: 'Check for Updates',
				click: () => {},
			},
			{
				label: 'Report an Issue',
				click: () => {},
			},
			{ type: 'separator' },

			{
				label: 'About',
				click: () => {},
			},
		],
	},
];
