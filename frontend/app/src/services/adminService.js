import { fetchWithAuth } from './apiService'; // Importeer gecentraliseerde fetchWithAuth

// const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'; // VERWIJDERD

// const getAuthHeaders = () => { ... }; // VERWIJDERD - wordt afgehandeld door fetchWithAuth

export const getSystemConfiguration = async () => {
    // Roep fetchWithAuth aan; logoutAction kan null zijn als niet direct nodig hier
    return fetchWithAuth('/api/v1/admin/system-configuration', { method: 'GET' }, null);
};

export const updateSystemConfiguration = async (configData) => {
    // Roep fetchWithAuth aan; logoutAction kan null zijn als niet direct nodig hier
    return fetchWithAuth('/api/v1/admin/system-configuration', { 
        method: 'PUT', 
        body: JSON.stringify(configData) 
    }, null);
}; 