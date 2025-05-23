import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
// import * as authService from '../services/authService'; // Verwijderd
// import { useNavigate } from 'react-router-dom'; // Verwijderd
import { jwtDecode } from 'jwt-decode'; // Corrected import
import { fetchWithAuth } from '../services/apiService'; // Importeer fetchWithAuth

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Kan nu admin info of voucher info bevatten
    const [token, setToken] = useState(localStorage.getItem('authToken'));
    const [loading, setLoading] = useState(true); // Initial loading state
    const [isRefreshing, setIsRefreshing] = useState(false); // State for refresh in progress
    const [error, setError] = useState(null);
    
    // useNavigate hook hier als je het nodig hebt voor globale redirects na auth acties
    // const navigate = useNavigate(); 

    const decodeAndSetUser = useCallback((currentToken) => {
        if (currentToken) {
            try {
                const decodedToken = jwtDecode(currentToken);
                if (decodedToken && decodedToken.actor_type && decodedToken.exp) {
                    if (decodedToken.exp * 1000 < Date.now()) {
                        console.log("Token expired during initial load/refresh");
                        localStorage.removeItem('authToken');
                        setToken(null);
                        setUser(null);
                        return false;
                    } else {
                        setUser(decodedToken); // Set user from token first
                        localStorage.setItem('authToken', currentToken);
                        return true;
                    }
                } else {
                    console.error("Invalid token structure after decoding");
                    localStorage.removeItem('authToken');
                    setToken(null);
                    setUser(null);
                    return false;
                }
            } catch (e) {
                console.error("Failed to decode token:", e);
                localStorage.removeItem('authToken');
                setToken(null);
                setUser(null);
                return false;
            }
        } else {
            localStorage.removeItem('authToken');
            setUser(null);
            return false;
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        const currentToken = token || localStorage.getItem('authToken'); // Gebruik state token indien beschikbaar
        if (currentToken) {
            const isValid = decodeAndSetUser(currentToken);
            if (!isValid) {
                // Als de token ongeldig is (bv verlopen tijdens refresh), clear token state
                setToken(null);
            }
        } else {
            setUser(null); // Geen token, geen user
        }
        setLoading(false);
    }, [token, decodeAndSetUser]); // Luister naar token veranderingen

    const login = (newToken) => {
        setError(null);
        setToken(newToken); // Dit triggert de bovenstaande useEffect
    };

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        setToken(null);
        setUser(null);
        setError(null);
        // Potentially redirect to login page via useNavigate if called from a component
        // For now, just clearing context state.
    }, []); // Empty dependency array as logout itself doesn't depend on other reactive values from this scope
    
    const refreshActorDetails = useCallback(async () => {
        if (!user || !token) {
            console.warn("Cannot refresh actor details: no user or token.");
            return;
        }
        setIsRefreshing(true);
        setError(null);
        let actorDetailsEndpoint = '';
        if (user.actor_type === 'admin') {
            actorDetailsEndpoint = '/api/v1/users/me';
        } else if (user.actor_type === 'voucher') {
            actorDetailsEndpoint = '/api/v1/vouchers/me/details';
        } else {
            console.error("Cannot refresh actor details: unknown actor type.", user.actor_type);
            setIsRefreshing(false);
            return;
        }

        try {
            const freshDetails = await fetchWithAuth(actorDetailsEndpoint, {}, logout); // Pass logout for 401 handling
            if (freshDetails) {
                // Belangrijk: De token zelf verandert niet, alleen de 'user' state in de context.
                // De 'user' state wordt nu een mix van token data + verse backend data.
                // Voor een voucher, freshDetails is het VoucherDisplay schema.
                // Voor een admin, freshDetails is het User schema.
                // We moeten de bestaande token-gebaseerde user data mergen/vervangen met freshDetails.

                if (user.actor_type === 'voucher') {
                    // Update de voucher-specifieke velden in de user state
                    setUser(prevUser => ({
                        ...prevUser, // Behoud actor_id, actor_type, actor_voucher_code, exp etc. van token
                        max_runs: freshDetails.max_runs,
                        used_runs: freshDetails.used_runs,
                        is_active: freshDetails.is_active,
                        // ...andere velden uit VoucherDisplay die je wilt overnemen
                    }));
                } else if (user.actor_type === 'admin') {
                    // Update de admin-specifieke velden
                    setUser(prevUser => ({
                        ...prevUser, // Behoud actor_id, actor_type, actor_email, exp etc. van token
                        email: freshDetails.email, // User schema heeft email
                        is_active: freshDetails.is_active, // User schema heeft is_active
                        role: freshDetails.role,
                        // ...andere velden uit User schema
                    }));
                }
            } else {
                console.warn("Received no details from refreshActorDetails endpoint.");
            }
        } catch (err) {
            console.error("Failed to refresh actor details:", err);
            setError(err.message || "Kon actor details niet verversen.");
            // Als de error een auth error is (bv. token ongeldig geworden), handelt fetchWithAuth de logout al af.
        } finally {
            setIsRefreshing(false);
        }
    }, [user, token, logout]); //logout als dependency

    // Helper function to get remaining runs for a voucher user
    const getRemainingRuns = () => {
        if (user && user.actor_type === 'voucher' && user.max_runs !== undefined && user.used_runs !== undefined) {
            return user.max_runs - user.used_runs;
        }
        return null; // Or 0, or undefined, depending on how you want to handle non-voucher users or missing data
    };

    const value = {
        user,
        token,
        loading, // Initial loading of context
        isRefreshing, // For UI to show refresh in progress
        error,       // Error state meegeven
        setError,    // setError functie meegeven
        login,
        logout,
        refreshActorDetails, // Expose the refresh function
        getRemainingRuns,
        actorType: user?.actor_type,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 