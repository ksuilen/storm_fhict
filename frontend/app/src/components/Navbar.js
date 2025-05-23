import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
    const { user, logoutAction } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logoutAction();
        navigate('/login');
    };

    // Helper om te bepalen of een link actief is
    const isActive = (path) => location.pathname === path;
    const isDashboardActive = () => location.pathname.startsWith('/dashboard');

    return (
        <nav className="navbar navbar-expand-lg bg-body-tertiary">
            <div className="container-fluid">
                <Link className="navbar-brand" to={user ? "/dashboard" : "/"}>StormWebApp</Link>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarSupportedContent">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        <li className="nav-item">
                            <Link className={`nav-link ${isActive(user ? "/dashboard" : "/") ? "active" : ""}`} aria-current={isActive(user ? "/dashboard" : "/") ? "page" : undefined} to={user ? "/dashboard" : "/"}>
                                Home
                            </Link>
                        </li>
                        {user && (
                            <li className="nav-item">
                                <Link className={`nav-link ${isDashboardActive() ? "active" : ""}`} to="/dashboard">
                                    Dashboard
                                </Link>
                            </li>
                        )}
                        {/* Admin dropdown, alleen zichtbaar als user admin is */} 
                        {user && user.role === 'admin' && (
                            <li className="nav-item dropdown">
                                <button className="nav-link dropdown-toggle btn btn-link" type="button" id="adminDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                                    Admin
                                </button>
                                <ul className="dropdown-menu" aria-labelledby="adminDropdown">
                                    <li><Link className="dropdown-item" to="/admin/users">User Management</Link></li>
                                    <li><Link className="dropdown-item" to="/admin/stats">Run Statistics</Link></li>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li><Link className="dropdown-item" to="/admin/system-settings">Systeeminstellingen</Link></li>
                                </ul>
                            </li>
                        )}
                        {/* Voorbeeld link uit Bootstrap docs - kan later weg */} 
                        {/* <li className="nav-item">
                            <a className="nav-link" href="#">Link</a>
                        </li> */}
                        {/* Voorbeeld dropdown uit Bootstrap docs - kan later weg of aangepast */} 
                        {/* <li className="nav-item dropdown">
                            <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                Extra Opties
                            </a>
                            <ul className="dropdown-menu">
                                <li><a className="dropdown-item" href="#">Action</a></li>
                                <li><a className="dropdown-item" href="#">Another action</a></li>
                                <li><hr className="dropdown-divider" /></li>
                                <li><a className="dropdown-item" href="#">Something else here</a></li>
                            </ul>
                        </li> */}
                    </ul>
                    
                    {/* User/Auth sectie */} 
                    <ul className="navbar-nav mb-2 mb-lg-0">
                        {user ? (
                            <li className="nav-item dropdown">
                                <button className="nav-link dropdown-toggle btn btn-link" type="button" id="navbarUserDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                                    {user.email}
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="navbarUserDropdown">
                                    <li><button className="dropdown-item" onClick={handleLogout}>Logout</button></li>
                                </ul>
                            </li>
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
                    </ul>

                    {/* Voorbeeld search form uit Bootstrap docs - kan later weg */} 
                    {/* <form className="d-flex" role="search">
                        <input className="form-control me-2" type="search" placeholder="Search" aria-label="Search"/>
                        <button className="btn btn-outline-success" type="submit">Search</button>
                    </form> */}
                </div>
            </div>
        </nav>
    );
}

export default Navbar; 