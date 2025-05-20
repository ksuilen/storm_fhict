import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Pas pad aan indien nodig
import { fetchWithAuth } from '../../services/apiService'; // Importeer gecentraliseerde fetchWithAuth

// const API_BASE_URL = 'http://localhost:8000'; // VERWIJDERD

// Functie om API calls te maken (vergelijkbaar met die in App.js, evt. centraliseren) - VERWIJDERD
// async function fetchWithAuthAdmin(url, options = {}, logoutAction) { ... }

function RunStatisticsPage() {
    const { logoutAction } = useAuth();
    const [stats, setStats] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Gebruik nu de gecentraliseerde fetchWithAuth
            const data = await fetchWithAuth('/admin/stats/runs_per_user', { method: 'GET' }, logoutAction);
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