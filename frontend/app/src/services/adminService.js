const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        // Dit zou idealiter niet moeten gebeuren als de route correct beveiligd is,
        // maar als voorzorgsmaatregel.
        console.error("No auth token found in localStorage for admin service call.");
        // Overweeg hier een custom error te throwen of de gebruiker uit te loggen.
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
};

export const getSystemConfiguration = async () => {
    const response = await fetch(`${API_URL}/admin/system-configuration`, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            // Optioneel: token verwijderen en/of gebruiker uitloggen via een AuthContext actie
            // localStorage.removeItem('authToken'); 
        }
        const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch system configuration. Invalid server response.' }));
        throw new Error(errorData.detail || 'Failed to fetch system configuration');
    }
    return response.json();
};

export const updateSystemConfiguration = async (configData) => {
    const response = await fetch(`${API_URL}/admin/system-configuration`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(configData),
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            // Optioneel: localStorage.removeItem('authToken');
        }
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update system configuration. Invalid server response.' }));
        throw new Error(errorData.detail || 'Failed to update system configuration');
    }
    return response.json();
}; 