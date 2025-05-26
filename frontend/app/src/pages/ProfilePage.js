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
                setError('Kon profiel niet laden.');
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
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            setError('Nieuwe wachtwoorden komen niet overeen');
            return;
        }

        if (passwordForm.new_password.length < 8) {
            setError('Nieuw wachtwoord moet minimaal 8 karakters lang zijn');
            return;
        }

        if (passwordForm.current_password === passwordForm.new_password) {
            setError('Nieuw wachtwoord moet verschillen van huidig wachtwoord');
            return;
        }

        try {
            setIsChangingPassword(true);
            await changePassword(passwordForm, logoutAction);
            
            setSuccessMessage('Wachtwoord succesvol gewijzigd!');
            setPasswordForm({
                current_password: '',
                new_password: '',
                confirm_password: ''
            });
        } catch (err) {
            console.error('Failed to change password:', err);
            setError(err.message || 'Kon wachtwoord niet wijzigen');
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container mt-5 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Laden...</span>
                </div>
                <p>Profiel laden...</p>
            </div>
        );
    }

    return (
        <div className="container mt-4">
            <div className="row justify-content-center">
                <div className="col-md-8">
                    <h2>Profiel & Instellingen</h2>
                    
                    {/* User Profile Information */}
                    <div className="card mb-4">
                        <div className="card-header">
                            <h5 className="card-title mb-0">Profiel Informatie</h5>
                        </div>
                        <div className="card-body">
                            {userProfile ? (
                                <table className="table table-borderless">
                                    <tbody>
                                        <tr>
                                            <td><strong>User ID:</strong></td>
                                            <td>{userProfile.id}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Email:</strong></td>
                                            <td>{userProfile.email}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Rol:</strong></td>
                                            <td>
                                                <span className={`badge bg-${userProfile.role === 'admin' ? 'info' : 'secondary'}`}>
                                                    {userProfile.role}
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td><strong>Status:</strong></td>
                                            <td>
                                                <span className={`badge bg-${userProfile.is_active ? 'success' : 'danger'}`}>
                                                    {userProfile.is_active ? 'Actief' : 'Inactief'}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-muted">Profiel informatie niet beschikbaar</p>
                            )}
                        </div>
                    </div>

                    {/* Password Change Form */}
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">Wachtwoord Wijzigen</h5>
                        </div>
                        <div className="card-body">
                            {error && (
                                <div className="alert alert-danger" role="alert">
                                    {error}
                                </div>
                            )}
                            
                            {successMessage && (
                                <div className="alert alert-success" role="alert">
                                    {successMessage}
                                </div>
                            )}

                            <form onSubmit={handlePasswordSubmit}>
                                <div className="mb-3">
                                    <label htmlFor="current_password" className="form-label">
                                        Huidig Wachtwoord *
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
                                        Nieuw Wachtwoord *
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
                                        Wachtwoord moet minimaal 8 karakters lang zijn.
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="confirm_password" className="form-label">
                                        Bevestig Nieuw Wachtwoord *
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
                                                Wachtwoord wijzigen...
                                            </>
                                        ) : (
                                            'Wachtwoord Wijzigen'
                                        )}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-3">
                                <h6>Veiligheidstips:</h6>
                                <ul className="small text-muted">
                                    <li>Gebruik een sterk wachtwoord met minimaal 8 karakters</li>
                                    <li>Combineer letters, cijfers en speciale tekens</li>
                                    <li>Gebruik geen persoonlijke informatie in je wachtwoord</li>
                                    <li>Deel je wachtwoord nooit met anderen</li>
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