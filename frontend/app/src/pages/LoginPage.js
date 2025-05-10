import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { loginAction, error, setError, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [message, setMessage] = useState(location.state?.message || '');

    useEffect(() => {
        // Als er een bericht is vanuit de state (bv. na redirect van ProtectedRoute), wis het na tonen
        if (location.state?.message) {
            const state = { ...location.state };
            delete state.message;
            navigate(location.pathname, { state, replace: true });
        }

        // Als gebruiker al ingelogd is en op /login komt, stuur naar dashboard
        if (user) {
            navigate('/dashboard', { replace: true });
        }

        // Wis de error van useAuth context als de component mount
        // zodat oude errors niet getoond worden.
        setError(null);

    }, [user, navigate, location, setError]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(''); // Wis pagina-specifiek bericht bij nieuwe poging
        await loginAction(email, password);
        // Navigatie gebeurt in loginAction of AuthContext op basis van user state
    };

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-6 col-lg-5">
                    <div className="card shadow-sm">
                        <div className="card-body p-4">
                            {/* Enkele titel nu, gecentreerd en groter */}
                            <h1 className="card-title text-center mb-4 h3">Login</h1> 
                            
                            {message && <div className="alert alert-info">{message}</div>}
                            {error && <div className="alert alert-danger">{error}</div>}
                            
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label htmlFor="emailInput" className="form-label">E-mailadres</label>
                                    <input 
                                        type="email" 
                                        className="form-control form-control-lg"
                                        id="emailInput"
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        placeholder="uwemail@example.com"
                                        required 
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="passwordInput" className="form-label">Wachtwoord</label>
                                    <input 
                                        type="password" 
                                        className="form-control form-control-lg" 
                                        id="passwordInput" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)} 
                                        placeholder="Wachtwoord"
                                        required 
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary btn-lg w-100 mt-3">
                                    Login
                                </button>
                            </form>
                            <p className="mt-4 text-center mb-0">
                                Nog geen account? <Link to="/register">Registreer hier</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage; 