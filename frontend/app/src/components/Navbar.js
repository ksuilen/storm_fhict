import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

function Navbar() {
    const { user, logout, actorType, getRemainingRuns } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const remainingRuns = getRemainingRuns();

    // Helper to determine if a link is active
    const isActive = (path) => location.pathname === path;
    const isDashboardActive = () => location.pathname.startsWith('/dashboard');

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-logo">
                    KnowledgeStorm
                </Link>
                <ul className="nav-menu">
                    <li className="nav-item">
                        <Link className={`nav-links ${isActive(user ? "/dashboard" : "/") ? "active" : ""}`} aria-current={isActive(user ? "/dashboard" : "/") ? "page" : undefined} to={user ? "/dashboard" : "/"}>
                            Home
                        </Link>
                    </li>
                    {user && (
                        <li className="nav-item">
                            <Link className={`nav-links ${isDashboardActive() ? "active" : ""}`} to="/dashboard">
                                Dashboard
                            </Link>
                        </li>
                    )}
                    {user && actorType === 'admin' && (
                        <li className="nav-item">
                            <Link to="/admin/vouchers" className="nav-links">
                                Manage Vouchers
                            </Link>
                        </li>
                    )}
                    {/* Admin dropdown, only visible if user is admin */} 
                    {user && actorType === 'admin' && (
                        <li className="nav-item dropdown">
                            <button className="nav-link dropdown-toggle btn btn-link" type="button" id="adminDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                                Admin
                            </button>
                            <ul className="dropdown-menu" aria-labelledby="adminDropdown">
                                <li><Link className="dropdown-item" to="/admin/users">User Management</Link></li>
                                <li><Link className="dropdown-item" to="/admin/stats">Run Statistics</Link></li>
                                <li><hr className="dropdown-divider" /></li>
                                <li><Link className="dropdown-item" to="/admin/system-settings">System Settings</Link></li>
                                <li><hr className="dropdown-divider" /></li>
                                <li><Link className="dropdown-item" to="/profile">Profile & Password</Link></li>
                            </ul>
                        </li>
                    )}
                </ul>
                
                {/* User/Auth section */} 
                <div className="navbar-user-info">
                    {user ? (
                        <>
                            {actorType === 'admin' && user.actor_email && (
                                <span className="user-details">Admin: {user.actor_email}</span>
                            )}
                            {actorType === 'voucher' && user.actor_voucher_code && (
                                <span className="user-details">
                                    Voucher: {user.actor_voucher_code.substring(0, user.actor_voucher_code.lastIndexOf('-') > 0 ? user.actor_voucher_code.lastIndexOf('-') : 8)} 
                                    (Runs: {remainingRuns !== null ? remainingRuns : 'N/A'})
                                </span>
                            )}
                            <button onClick={handleLogout} className="btn btn-outline-light logout-button">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <li className="nav-item">
                                <Link className={`nav-link ${isActive("/login") ? "active" : ""}`} to="/login">Login</Link>
                            </li>
                            <li className="nav-item">
                                <Link className={`nav-link ${isActive("/register") ? "active" : ""}`} to="/register">Register</Link>
                            </li>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Navbar; 