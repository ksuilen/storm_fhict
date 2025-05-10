// API calls voor authenticatie (login, register, getCurrentUser)

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'; // Je backend URL

export const login = async (email, password) => {
    const response = await fetch(`${API_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: email, password: password })
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Login failed. Invalid server response.' }));
        throw new Error(errorData.detail || 'Login failed');
    }
    return response.json(); // { access_token: "...", token_type: "bearer" }
};

export const register = async (email, password) => {
    const response = await fetch(`${API_URL}/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Registration failed. Invalid server response.' }));
        throw new Error(errorData.detail || 'Registration failed');
    }
    return response.json(); 
};

export const getCurrentUser = async (token) => {
    if (!token) throw new Error("No token provided for getCurrentUser");
    const response = await fetch(`${API_URL}/users/me`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        // Als de token ongeldig is (bv. verlopen), kan de server een 401 sturen.
        // De gebruiker moet dan opnieuw inloggen.
        localStorage.removeItem('authToken'); // Verwijder ongeldige token
        const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch user. Invalid server response.' }));
        throw new Error(errorData.detail || 'Failed to fetch user information');
    }
    return response.json(); // { email: "...", id: ..., is_active: ... }
}; 