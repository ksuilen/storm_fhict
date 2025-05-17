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

function RunStatisticsPage() {
    const { logoutAction } = useAuth();
    const [stats, setStats] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchWithAuthAdmin('/admin/stats/runs_per_user', { method: 'GET' }, logoutAction);
            setStats(data || []);
        } catch (err) {
            setError(err.message);
            setStats([]);
        } finally {
            setIsLoading(false);
        }
    }, [logoutAction]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return (
        <div className="container mt-4">
            <h2>Run Statistics per User</h2>
            {error && <div className="alert alert-danger">Error fetching statistics: {error}</div>}
            {isLoading ? (
                <p>Loading statistics...</p>
            ) : stats.length > 0 ? (
                <table className="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>User ID</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Run Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map(stat => (
                            <tr key={stat.user_id}>
                                <td>{stat.user_id}</td>
                                <td>{stat.email}</td>
                                <td><span className={`badge bg-${stat.role === 'admin' ? 'info' : 'secondary'}`}>{stat.role}</span></td>
                                <td>{stat.run_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>No statistics found.</p>
            )}
        </div>
    );
}

export default RunStatisticsPage; 