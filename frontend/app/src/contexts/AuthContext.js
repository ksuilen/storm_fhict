import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import * as authService from '../services/authService'; // Importeer de service
import { useNavigate } from 'react-router-dom'; // Kan nuttig zijn voor redirects vanuit context

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Zal user object bevatten { email, id, ...}
    const [token, setToken] = useState(localStorage.getItem('authToken'));
    const [isLoading, setIsLoading] = useState(true); // Start true om initiële check te doen
    const [error, setError] = useState(null); // Error state voor auth-gerelateerde fouten
    
    // useNavigate hook hier als je het nodig hebt voor globale redirects na auth acties
    // const navigate = useNavigate(); 

    const fetchUserOnLoad = useCallback(async () => {
        if (token && !user) {
            setIsLoading(true);
            try {
                const currentUser = await authService.getCurrentUser(token);
                setUser(currentUser);
                setError(null);
            } catch (e) {
                console.error("AuthContext: Failed to fetch user with stored token", e);
                // Token is mogelijk verlopen of ongeldig
                setUser(null);
                setToken(null);
                localStorage.removeItem('authToken');
                setError("Sessie verlopen, log opnieuw in."); // Of een specifiekere error
            }
            setIsLoading(false);
        } else {
            setIsLoading(false); // Geen token, dus niet laden
        }
    }, [token, user]);

    useEffect(() => {
        fetchUserOnLoad();
    }, [fetchUserOnLoad]);

    const loginAction = async (email, password) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await authService.login(email, password);
            if (data.access_token) {
                setToken(data.access_token);
                localStorage.setItem('authToken', data.access_token);
                // Na het zetten van de token, haal de gebruiker op
                const currentUser = await authService.getCurrentUser(data.access_token);
                setUser(currentUser);
                setError(null);
                // Navigatie naar dashboard gebeurt idealiter in LoginPage na succesvolle user set
            } else {
                throw new Error(data.detail || "Login mislukt: Geen access token ontvangen.");
            }
        } catch (err) {
            const errorMessage = err.data?.detail || err.message || "Login mislukt. Controleer uw gegevens.";
            console.error("AuthContext Login Error:", errorMessage, err);
            setError(errorMessage);
            setUser(null);
            setToken(null);
            localStorage.removeItem('authToken');
            // Gooi de error door zodat LoginPage het kan vangen indien nodig, of handel hier af
            // throw err; // Als je wilt dat de component de error ook direct ziet
        } finally {
            setIsLoading(false);
        }
    };

    const logoutAction = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
        setError(null); // Wis errors bij logout
        // Navigatie naar /login gebeurt in de component (bv. Navbar)
    };

    const value = {
        user,
        token,
        isLoading,
        error,       // Error state meegeven
        setError,    // setError functie meegeven
        loginAction,
        logoutAction,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth moet binnen een AuthProvider gebruikt worden');
    }
    return context;
}; 