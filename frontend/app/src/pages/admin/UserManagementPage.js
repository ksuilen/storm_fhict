import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Pas pad aan indien nodig

const API_BASE_URL = 'http://localhost:8000'; // Of haal uit een config

// Functie om API calls te maken (vergelijkbaar met die in App.js, evt. centraliseren)
async function fetchWithAuthAdmin(url, options = {}, logoutAction) {
    const token = localStorage.getItem('authToken');
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
    if (options.method === 'GET' || !options.body) {
        delete headers['Content-Type'];
    }
    const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
    if (response.status === 401) {
        if (logoutAction) logoutAction();
        throw new Error('Unauthorized');
    }
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ detail: 'API Error' }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

function UserManagementPage() {
    const { logoutAction } = useAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // State voor nieuw gebruiker formulier
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState('user');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState('');

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchWithAuthAdmin('/admin/users/', { method: 'GET' }, logoutAction);
            setUsers(data || []);
        } catch (err) {
            setError(err.message);
            setUsers([]);
        } finally {
            setIsLoading(false);
        }
    }, [logoutAction]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess('');
        try {
            const newUser = {
                email: newUserEmail,
                password: newUserPassword,
                role: newUserRole
            };
            await fetchWithAuthAdmin('/admin/users/', { 
                method: 'POST', 
                body: JSON.stringify(newUser) 
            }, logoutAction);
            setSubmitSuccess(`User ${newUserEmail} created successfully with role ${newUserRole}.`);
            // Reset form
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserRole('user');
            fetchUsers(); // Refresh user list
        } catch (err) {
            setSubmitError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mt-4">
            <h2>User Management</h2>
            {error && <div className="alert alert-danger">Error fetching users: {error}</div>}
            
            <div className="card mb-4">
                <div className="card-header">Create New User</div>
                <div className="card-body">
                    <form onSubmit={handleCreateUser}>
                        {submitError && <div className="alert alert-danger">{submitError}</div>}
                        {submitSuccess && <div className="alert alert-success">{submitSuccess}</div>}
                        <div className="mb-3">
                            <label htmlFor="newUserEmail" className="form-label">Email address</label>
                            <input 
                                type="email" 
                                className="form-control" 
                                id="newUserEmail" 
                                value={newUserEmail} 
                                onChange={(e) => setNewUserEmail(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="newUserPassword" className="form-label">Password</label>
                            <input 
                                type="password" 
                                className="form-control" 
                                id="newUserPassword" 
                                value={newUserPassword} 
                                onChange={(e) => setNewUserPassword(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="newUserRole" className="form-label">Role</label>
                            <select 
                                className="form-select" 
                                id="newUserRole" 
                                value={newUserRole} 
                                onChange={(e) => setNewUserRole(e.target.value)}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create User'}
                        </button>
                    </form>
                </div>
            </div>

            <h3>Existing Users</h3>
            {isLoading ? (
                <p>Loading users...</p>
            ) : users.length > 0 ? (
                <table className="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>{user.id}</td>
                                <td>{user.email}</td>
                                <td><span className={`badge bg-${user.role === 'admin' ? 'info' : 'secondary'}`}>{user.role}</span></td>
                                <td>{user.is_active ? 'Yes' : 'No'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>No users found.</p>
            )}
        </div>
    );
}

export default UserManagementPage; 