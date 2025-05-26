import { fetchWithAuth } from './apiService';

// Get current user profile
export const getCurrentUser = async (logoutAction) => {
    return await fetchWithAuth('/v1/users/me', { method: 'GET' }, logoutAction);
};

// Change user password
export const changePassword = async (passwordData, logoutAction) => {
    return await fetchWithAuth('/v1/users/change-password', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData),
    }, logoutAction);
}; 