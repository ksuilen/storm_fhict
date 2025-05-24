import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Pas pad aan indien nodig
import { fetchWithAuth } from '../../services/apiService'; // Importeer gecentraliseerde fetchWithAuth

// const API_BASE_URL = 'http://localhost:8000'; // VERWIJDERD

// Functie om API calls te maken (vergelijkbaar met die in App.js, evt. centraliseren) - VERWIJDERD
// async function fetchWithAuthAdmin(url, options = {}, logoutAction) { ... }

function RunStatisticsPage() {
    const { logoutAction } = useAuth();
    const [voucherStats, setVoucherStats] = useState([]);
    const [adminRunStats, setAdminRunStats] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Roep de nieuwe endpoint aan
            const data = await fetchWithAuth('/v1/admin/stats/overview', { method: 'GET' }, logoutAction);
            if (data) {
                setVoucherStats(data.voucher_stats || []);
                setAdminRunStats(data.admin_run_stats || []);
            } else {
                setVoucherStats([]);
                setAdminRunStats([]);
            }
        } catch (err) {
            setError(err.message);
            setVoucherStats([]);
            setAdminRunStats([]);
        } finally {
            setIsLoading(false);
        }
    }, [logoutAction]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return (
        <div className="container mt-4">
            <h2>Run Statistics Overview</h2>
            {error && <div className="alert alert-danger">Error fetching statistics: {error}</div>}
            {isLoading ? (
                <p>Loading statistics...</p>
            ) : (
                <>
                    <section className="mb-5">
                        <h3>Voucher Statistics</h3>
                        {voucherStats.length > 0 ? (
                            <table className="table table-striped table-hover table-sm">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Code</th>
                                        <th>Prefix</th>
                                        <th>Max Runs</th>
                                        <th>Used Runs</th>
                                        <th>Remaining</th>
                                        <th>Active</th>
                                        <th>Created At</th>
                                        <th>Created By (Admin ID)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {voucherStats.map(voucher => (
                                        <tr key={voucher.id}>
                                            <td>{voucher.id}</td>
                                            <td><code>{voucher.code}</code></td>
                                            <td>{voucher.prefix || '-'}</td>
                                            <td>{voucher.max_runs}</td>
                                            <td>{voucher.used_runs}</td>
                                            <td>{voucher.max_runs - voucher.used_runs}</td>
                                            <td><span className={`badge bg-${voucher.is_active ? 'success' : 'secondary'}`}>{voucher.is_active ? 'Yes' : 'No'}</span></td>
                                            <td>{new Date(voucher.created_at).toLocaleString()}</td>
                                            <td>{voucher.created_by_admin_id || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p>No voucher statistics found.</p>
                        )}
                    </section>

                    <section>
                        <h3>Admin User Run Counts</h3>
                        {adminRunStats.length > 0 ? (
                            <table className="table table-striped table-hover table-sm">
                                <thead>
                                    <tr>
                                        <th>User ID</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Run Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adminRunStats.map(stat => (
                                        <tr key={stat.user_id}>
                                            <td>{stat.user_id}</td>
                                            <td>{stat.email}</td>
                                            <td><span className={`badge bg-info`}>{stat.role}</span></td>
                                            <td>{stat.run_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p>No admin run statistics found.</p>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

export default RunStatisticsPage; 