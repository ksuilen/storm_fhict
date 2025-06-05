import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentUser, changePassword } from '../services/userService';

const ProfilePage = () => {
    const { user, logoutAction } = useAuth();
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Fetch user profile
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            
            try {
                setIsLoading(true);
                const profile = await getCurrentUser(logoutAction);
                setUserProfile(profile);
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
                setError('Could not load profile.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [user, logoutAction]);

    const handlePasswordFormChange = (e) => {
        setPasswordForm({
            ...passwordForm,
            [e.target.name]: e.target.value
        });
        // Clear errors when user starts typing
        if (error) setError(null);
        if (successMessage) setSuccessMessage(null);
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        // Client-side validation
        const { current_password, new_password, confirm_password } = passwordForm;
        if (new_password !== confirm_password) {
            setError('New passwords do not match');
            return;
        }

        if (new_password.length < 8) {
            setError('New password must be at least 8 characters long');
            return;
        }

        if (new_password === current_password) {
            setError('New password must be different from current password');
            return;
        }

        try {
            setIsChangingPassword(true);
            await changePassword(passwordForm, logoutAction);
            
            setSuccessMessage('Password changed successfully!');
            setPasswordForm({
                current_password: '',
                new_password: '',
                confirm_password: ''
            });
        } catch (err) {
            console.error('Failed to change password:', err);
            setError(err.message || 'Could not change password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container text-center mt-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p>Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="container mt-4">
            <h2>Profile & Settings</h2>
            
            {error && <div className="alert alert-danger">{error}</div>}
            {successMessage && <div className="alert alert-success">{successMessage}</div>}
            
            <div className="row">
                <div className="col-md-6">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">Profile Information</h5>
                        </div>
                        <div className="card-body">
                            {user ? (
                                <div>
                                    <p><strong>Email:</strong> {user.actor_email || 'N/A'}</p>
                                    <p><strong>Account Type:</strong> {user.actor_type || 'N/A'}</p>
                                    {user.actor_type === 'voucher' && (
                                        <>
                                            <p><strong>Voucher Code:</strong> {user.actor_voucher_code || 'N/A'}</p>
                                            <p><strong>Remaining Runs:</strong> {user.remaining_runs !== undefined ? user.remaining_runs : 'N/A'}</p>
                                        </>
                                    )}
                                    {user.actor_type === 'admin' && (
                                        <p><strong>Admin Access:</strong> Full system access</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted">Profile information not available</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">Password Change</h5>
                        </div>
                        <div className="card-body">
                            <form onSubmit={handlePasswordSubmit}>
                                <div className="mb-3">
                                    <label htmlFor="current_password" className="form-label">
                                        Current Password *
                                    </label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        id="current_password"
                                        name="current_password"
                                        value={passwordForm.current_password}
                                        onChange={handlePasswordFormChange}
                                        required
                                        disabled={isChangingPassword}
                                        autoComplete="current-password"
                                    />
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="new_password" className="form-label">
                                        New Password *
                                    </label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        id="new_password"
                                        name="new_password"
                                        value={passwordForm.new_password}
                                        onChange={handlePasswordFormChange}
                                        required
                                        disabled={isChangingPassword}
                                        autoComplete="new-password"
                                        minLength="8"
                                    />
                                    <div className="form-text">
                                        Password must be at least 8 characters long.
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="confirm_password" className="form-label">
                                        Confirm New Password *
                                    </label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        id="confirm_password"
                                        name="confirm_password"
                                        value={passwordForm.confirm_password}
                                        onChange={handlePasswordFormChange}
                                        required
                                        disabled={isChangingPassword}
                                        autoComplete="new-password"
                                        minLength="8"
                                    />
                                </div>

                                <div className="d-grid">
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={isChangingPassword || !passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password}
                                    >
                                        {isChangingPassword ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Changing password...
                                            </>
                                        ) : (
                                            'Change Password'
                                        )}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-3">
                                <h6>Security Tips:</h6>
                                <ul className="small text-muted">
                                    <li>Use a strong password with at least 8 characters</li>
                                    <li>Combine letters, numbers, and special characters</li>
                                    <li>Do not use personal information in your password</li>
                                    <li>Never share your password with others</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage; 