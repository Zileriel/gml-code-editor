import React, { useState } from 'react';

export default function RemoteConfigDialog({
	isOpen,
	onClose,
	onConfirm,
	operation,
}) {
	const [remoteUrl, setRemoteUrl] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!remoteUrl.trim()) return;

		setIsLoading(true);
		try {
			await onConfirm(remoteUrl.trim());
			setRemoteUrl('');
			onClose();
		} catch (error) {
			alert(`Failed to configure remote: ${error.message}`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		setRemoteUrl('');
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="modal-overlay">
			<div className="modal-dialog">
				<div className="modal-header">
					<h3>Configure Remote Repository</h3>
				</div>
				<div className="modal-body">
					<p>
						To {operation}, you need to configure a remote repository. Please
						enter the URL of your remote Git repository:
					</p>
					<form onSubmit={handleSubmit}>
						<div className="form-group">
							<label htmlFor="remote-url">Remote Repository URL:</label>
							<input
								id="remote-url"
								type="url"
								value={remoteUrl}
								onChange={(e) => setRemoteUrl(e.target.value)}
								placeholder="https://github.com/username/repository.git"
								required
								disabled={isLoading}
								autoFocus
							/>
						</div>
						<div className="form-actions">
							<button
								type="button"
								onClick={handleCancel}
								disabled={isLoading}
								className="cancel-button">
								Cancel
							</button>
							<button
								type="submit"
								disabled={!remoteUrl.trim() || isLoading}
								className="confirm-button">
								{isLoading ? 'Configuring...' : 'Configure & ' + operation}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
