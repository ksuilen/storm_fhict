import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext'; // Als je auth context nodig hebt voor redirect na registratie
import * as authService from '../services/authService'; // Voor de registratie API call

function RegistrationPage() {
    const navigate = useNavigate();
    // const { loginAction } = useAuth(); // Eventueel om direct in te loggen na registratie

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (!formData.email || !formData.password || !formData.confirmPassword) {
            setError('Alle velden zijn verplicht.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Wachtwoorden komen niet overeen.');
            return;
        }

        setIsLoading(true);
        try {
            // De authService.register functie verwacht een object met email en password
            await authService.register({ email: formData.email, password: formData.password });
            setSuccessMessage('Registratie succesvol! Je kunt nu inloggen.');
            // Optioneel: direct doorsturen naar login of automatisch inloggen
            setTimeout(() => {
                navigate('/login');
            }, 2000); // Kleine vertraging om succesmelding te lezen
        } catch (err) {
            const errorMessage = err.data?.detail || err.message || 'Registratie mislukt. Probeer het opnieuw.';
            setError(errorMessage);
        }
        setIsLoading(false);
    };

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-6">
                    <div className="card">
                        <div className="card-body">
                            <h2 className="card-title text-center mb-4">Registreren</h2>
                            {error && <div className="alert alert-danger">{error}</div>}
                            {successMessage && <div className="alert alert-success">{successMessage}</div>}
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label htmlFor="emailInputReg" className="form-label">E-mailadres</label>
                                    <input 
                                        type="email" 
                                        className="form-control" 
                                        id="emailInputReg" 
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="passwordInputReg" className="form-label">Wachtwoord</label>
                                    <input 
                                        type="password" 
                                        className="form-control" 
                                        id="passwordInputReg" 
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="confirmPasswordInputReg" className="form-label">Bevestig Wachtwoord</label>
                                    <input 
                                        type="password" 
                                        className="form-control" 
                                        id="confirmPasswordInputReg"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required 
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
                                    {isLoading ? 'Registreren...' : 'Registreer'}
                                </button>
                            </form>
                            <p className="mt-3 text-center">
                                Al een account? <Link to="/login">Log hier in</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegistrationPage; 