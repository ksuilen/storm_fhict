import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';
import './App.css';

const PrivateRoute = ({ children }) => {
    const { user, isLoading } = useAuth();
    if (isLoading) {
        return <div className="container text-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Authenticatie controleren...</p></div>;
    }
    return user ? children : <Navigate to="/login" replace />;
};

const HomeRoute = () => {
    const { user, isLoading } = useAuth();
    if (isLoading) {
        return <div className="container text-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Laden...</p></div>; 
    }
    return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

// --- API Helper ---
// (Vervang met je daadwerkelijke API service/configuratie)
const API_BASE_URL = 'http://localhost:8000'; // Backend URL

async function fetchWithAuth(url, options = {}, logoutAction = null) {
    const token = localStorage.getItem('authToken');
    // --- DEBUG LOG --- 
    console.log("fetchWithAuth: Using token:", token ? token.substring(0, 10) + '...' : 'null or empty');
    // --- END DEBUG LOG ---
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };

    // Voor GET requests, verwijder Content-Type als er geen body is
    if (options.method === 'GET' || !options.body) {
        delete headers['Content-Type'];
    }

    const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });

    if (response.status === 401) {
        localStorage.removeItem('authToken');
        if (logoutAction) {
            console.log("fetchWithAuth: Detected 401, calling logoutAction.");
            logoutAction();
        } else {
            console.warn("fetchWithAuth: logoutAction not provided, cannot perform clean logout.");
        }
        throw new Error('Unauthorized');
    }
    if (!response.ok && response.status !== 204) { // 204 No Content is OK voor DELETE
         const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    // Voor DELETE requests of andere requests die geen body teruggeven
     if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null; // Geen content om te parsen
    }
    // Voor text responses (zoals de outline)
    if (response.headers.get('content-type')?.includes('text/plain')) {
        return await response.text();
    }
    
    return await response.json(); // Ga uit van JSON voor andere responses
}

// Helper function for status badge styling
const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'completed': return 'bg-success';
        case 'running': return 'bg-primary';
        case 'pending': return 'bg-warning text-dark'; // Aangepast voor betere leesbaarheid
        case 'failed': return 'bg-danger';
        default: return 'bg-light text-dark';
    }
};

// --- Dashboard Component ---
// (Dit kan ook in een apart bestand staan, bv. pages/DashboardPage.js)
function Dashboard() {
    const { logoutAction, user, isLoading: authIsLoading } = useAuth();
    const [runs, setRuns] = useState([]);
    const [selectedRun, setSelectedRun] = useState(null);
    const [articleContent, setArticleContent] = useState('');
    const [outlineContent, setOutlineContent] = useState(''); // Nieuwe state voor outline
    const [sources, setSources] = useState([]); // Nieuwe state voor sources
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [error, setError] = useState(null);
    const [topic, setTopic] = useState(''); // State voor nieuw run topic
    const [isSubmitting, setIsSubmitting] = useState(false); // State voor submit knop

    const pollIntervalRef = React.useRef(null);
    const initialHistoryFetchAttempted = React.useRef(false); // Ref om initiële fetch te volgen

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            console.log("Stopping polling.");
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []); // Geen dependencies nodig

    const fetchRunHistory = useCallback(async () => {
        if (!user || authIsLoading) {
            console.log("Skipping fetchRunHistory: user not yet available or auth is loading.");
            setRuns([]);
            return;
        }
        try {
            const data = await fetchWithAuth('/storm/history', { method: 'GET' }, logoutAction);
            setRuns(data || []); // Zorg ervoor dat runs altijd een array is
        } catch (err) {
            console.error("Failed to fetch run history:", err);
            if (err.message !== 'Unauthorized') {
                setError(err.message);
            }
        }
    }, [logoutAction, user, authIsLoading]);

    const fetchRunDetails = useCallback(async (runId) => {
        const currentRuns = runs; // Lees de state op het moment van uitvoeren
        const run = currentRuns.find(r => r.id === runId);

        if (!run || run.status !== 'completed') {
             setArticleContent('');
             setOutlineContent('');
             setSources([]);
            return;
        }

        setIsLoadingDetails(true);
        setArticleContent('');
        setOutlineContent('');
        setSources([]);
        setError(null); // Reset error

        try {
            // Fetch article, outline, and sources in parallel
            const [articleData, outlineData, sourcesData] = await Promise.all([
                fetchWithAuth(`/storm/results/${runId}/article`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e; // Hergooi voor centrale afhandeling
                    console.error('Article fetch error:', e); return 'Kon artikel niet laden.'; 
                }),
                fetchWithAuth(`/storm/results/${runId}/outline`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e;
                    console.error('Outline fetch error:', e); return 'Kon inhoudsopgave niet laden.'; 
                }),
                fetchWithAuth(`/storm/results/${runId}/summary`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e;
                    console.error('Sources fetch error:', e); return []; 
                })
            ]);

            setArticleContent(articleData || ''); // articleData is text
            setOutlineContent(outlineData || ''); // outlineData is text
            setSources(Array.isArray(sourcesData) ? sourcesData : []); // sourcesData is JSON array

        } catch (err) {
            console.error("Failed to fetch run details:", err);
            if (err.message !== 'Unauthorized') {
                setError(`Failed to load details for run ${runId}: ${err.message}`);
                setArticleContent('Fout bij laden artikel.'); // Toon fout in content area
                setOutlineContent('Fout bij laden inhoudsopgave.');
                setSources([]);
            }
        } finally {
            setIsLoadingDetails(false);
        }
    }, [runs, logoutAction]);

    const fetchRunStatus = useCallback(async (jobId) => {
        try {
            console.log(`Polling status for job ${jobId}`);
            const statusData = await fetchWithAuth(`/storm/status/${jobId}`, { method: 'GET' }, logoutAction);
            console.log("Status data received:", statusData);

            // Update de specifieke run in de lijst ALLEEN als de status verandert
            setRuns(prevRuns => {
                const runIndex = prevRuns.findIndex(run => run.id === jobId);
                if (runIndex === -1) return prevRuns; // Run niet gevonden?
                
                const currentRun = prevRuns[runIndex];
                if (currentRun.status === statusData.status) {
                    return prevRuns; // Geen wijziging nodig, retourneer de oude state referentie
                }
                
                // Status is veranderd, maak een nieuwe array
                const newRuns = [...prevRuns];
                newRuns[runIndex] = { ...currentRun, status: statusData.status };
                return newRuns;
            });

            // Update geselecteerde run details als deze geselecteerd is
            if (selectedRun && selectedRun.id === jobId) {
                // Alleen updaten als de status daadwerkelijk verandert
                if (selectedRun.status !== statusData.status) {
                    setSelectedRun(prevSelected => ({...prevSelected, status: statusData.status}));
                }
            }

            if (statusData.status === 'completed' || statusData.status === 'failed') {
                console.log(`Run ${jobId} finished with status: ${statusData.status}. Stopping polling.`);
                stopPolling();
                // Fetch history opnieuw om eventuele eindtijd etc. te krijgen
                fetchRunHistory();
                // Als de nu voltooide run geselecteerd was, fetch details opnieuw
                 if (selectedRun && selectedRun.id === jobId && statusData.status === 'completed') {
                    fetchRunDetails(jobId); // Fetch artikel, outline, sources
                }
            }
        } catch (err) {
            console.error(`Failed to fetch status for job ${jobId}:`, err);
            if (err.message !== 'Unauthorized') {
                console.warn(`Polling error for ${jobId}: ${err.message}`);
            }
        }
    }, [fetchRunHistory, selectedRun, fetchRunDetails, stopPolling, logoutAction]);

    const startPolling = useCallback((jobId) => {
        stopPolling(); // Stop eventuele vorige polls
        console.log(`Starting polling for job ${jobId}`);
        // Roep direct aan, en dan elke 5 seconden
        fetchRunStatus(jobId);
        pollIntervalRef.current = setInterval(() => fetchRunStatus(jobId), 5000); // Poll elke 5s
    }, [fetchRunStatus, stopPolling]); // Dependencies zijn nu hierboven gedefinieerd
    
    // --- Effect Hooks ---
    useEffect(() => {
        // Als auth nog laadt, doe nog niets.
        if (authIsLoading) {
            console.log("Dashboard useEffect: Auth is loading, skipping history fetch logic.");
            return () => stopPolling();
        }

        if (user) {
            // Gebruiker is ingelogd
            if (!initialHistoryFetchAttempted.current) {
                console.log("Dashboard useEffect: User logged in, initial fetch attempt.");
                fetchRunHistory();
                initialHistoryFetchAttempted.current = true;
            }
        } else {
            // Geen gebruiker (uitgelogd), reset de fetch poging flag.
            console.log("Dashboard useEffect: No user, resetting initial fetch flag.");
            initialHistoryFetchAttempted.current = false;
            setRuns([]); // Leeg de runs als de gebruiker uitlogt
            setSelectedRun(null); // Deselecteer run
            setArticleContent('');
            setOutlineContent('');
            setSources([]);
        }

        return () => {
            console.log("Dashboard useEffect cleanup: Stopping polling.");
            stopPolling();
        };
    }, [stopPolling, authIsLoading, user, fetchRunHistory]);

    // --- Event Handlers ---
     const handleRunSelect = (run) => {
        stopPolling(); // Stop polling als we een andere run selecteren
        setSelectedRun(run);
        if (run.status === 'running' || run.status === 'pending') {
            startPolling(run.id);
            setArticleContent(''); // Clear details for running job
            setOutlineContent('');
            setSources([]);
            setError(null);
        } else if (run.status === 'completed') {
             fetchRunDetails(run.id);
        } else { // Failed or other status
             setArticleContent(`Run gefaald: ${run.error_message || 'Onbekende fout'}`);
             setOutlineContent('');
             setSources([]);
             setError(null);
        }
    };

    const handleNewRunSubmit = async (e) => {
        e.preventDefault();
        if (!topic.trim()) return;

        setIsSubmitting(true);
        setError(null);
        stopPolling(); // Stop polling van vorige runs

        try {
            const newRunData = await fetchWithAuth('/storm/run', {
                method: 'POST',
                body: JSON.stringify({ topic: topic })
            }, logoutAction);
            console.log("New run initiated:", newRunData);
            setTopic(''); // Clear input field
             // Voeg nieuwe run toe aan lijst (bovenaan) en selecteer deze
            setRuns(prevRuns => [newRunData, ...prevRuns]);
            handleRunSelect(newRunData); // Selecteer en begin met pollen
        } catch (err) {
            console.error("Failed to initiate new run:", err);
            if (err.message !== 'Unauthorized') {
                setError(`Failed to start run: ${err.message}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRun = async (runId, e) => {
        e.stopPropagation(); // Voorkom dat selectie trigger wordt
        if (!window.confirm(`Weet je zeker dat je run ${runId} wilt verwijderen? Dit kan niet ongedaan gemaakt worden.`)) {
            return;
        }

        setError(null);
        stopPolling(); // Stop polling als we gaan verwijderen

        try {
            await fetchWithAuth(`/storm/run/${runId}`, { method: 'DELETE' }, logoutAction);
            
            // Verwijder uit de lijst
            setRuns(prevRuns => prevRuns.filter(run => run.id !== runId));
            
            // Deselecteer als de verwijderde run geselecteerd was
            if (selectedRun && selectedRun.id === runId) {
                setSelectedRun(null);
                setArticleContent('');
                 setOutlineContent('');
                 setSources([]);
            }
            
            console.log(`Run ${runId} deleted successfully.`);
            
        } catch (err) {
            console.error(`Failed to delete run ${runId}:`, err);
            if (err.message !== 'Unauthorized') {
                setError(`Failed to delete run ${runId}: ${err.message}`);
            }
        }
    };

    // --- Render JSX ---
    return (
        // Gebruik Bootstrap grid system voor layout naast elkaar
        // Geef row een hoogte van 100% binnen zijn flex parent (.app-content)
        <div className="dashboard-container row g-0 flex-grow-1"> 
            {/* Sidebar kolom (bv. 1/3 van de breedte op medium schermen en groter) */}
            <div className="sidebar col-md-4 col-lg-3 border-end bg-light p-3" style={{ overflowY: 'auto' }}>
                <h2>Nieuwe Storm Run</h2>
                 <form onSubmit={handleNewRunSubmit} className="new-run-form mb-4"> {/* Extra marge onder form */}
                    <div className="mb-3">
                        <input
                            type="text"
                            className="form-control" // Bootstrap class
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Voer onderwerp in"
                            disabled={isSubmitting}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary w-100" disabled={!topic.trim() || isSubmitting}> {/* Bootstrap button */}
                        {isSubmitting ? (
                             <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Starten...</> 
                        ) : 'Start Run'}
                    </button>
                </form>
                
                <h2>Run Geschiedenis</h2>
                <ul className="list-group run-history mb-3">
                    {runs.map(run => (
                        <li
                            key={run.id}
                            className={`list-group-item list-group-item-action d-flex justify-content-between align-items-start ${selectedRun?.id === run.id ? 'active' : ''}`}
                            onClick={() => handleRunSelect(run)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="run-info me-3 overflow-hidden">
                                <div className="d-flex align-items-center">
                                    <span className="fw-bold me-2 text-truncate">{run.topic}</span>
                                    <span className={`badge rounded-pill ${getStatusBadgeClass(run.status)}`}>{run.status}</span>
                                </div>
                                <small className="text-muted d-block">
                                    {run.start_time ? new Date(run.start_time).toLocaleString() : 'Invalid Date'}
                                 </small>
                            </div>
                            <button 
                                className="btn btn-sm btn-outline-danger border-0"
                                onClick={(e) => handleDeleteRun(run.id, e)}
                                title="Verwijder run"
                                style={{ marginLeft: 'auto' }}
                             >
                                &#x1F5D1;
                            </button>
                        </li>
                    ))}
                </ul>
                {runs.length === 0 && !authIsLoading && <p>Geen runs gevonden.</p>}
            </div>
            {/* Main content kolom (neemt resterende ruimte) */}
            <div className="main-content col-md-8 col-lg-9 p-4" style={{ overflowY: 'auto' }}>
                <h2>Taak Details & Resultaten</h2>
                {error && <div className="alert alert-danger">Fout: {error}</div>} {/* Bootstrap alert */}
                {selectedRun ? (
                    <div className="run-details"> 
                        <h3>{selectedRun.topic} (ID: {selectedRun.id})</h3>
                        <p>
                            <strong>Status:</strong> 
                            <span className={`badge rounded-pill ms-2 ${getStatusBadgeClass(selectedRun.status)}`}>
                                {selectedRun.status}
                            </span>
                        </p>
                         {(selectedRun.status === 'running' || selectedRun.status === 'pending') && (
                            <div className="d-flex align-items-center text-primary mb-3">
                                <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                <span>Taak wordt uitgevoerd...</span>
                            </div>
                         )}

                         {isLoadingDetails && (
                            <div className="d-flex align-items-center text-muted mb-3">
                                <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                <span>Details laden...</span>
                            </div>
                         )}

                         {/* Outline, Artikel, Bronnen secties (kunnen in cards voor betere structuur) */} 
                         {selectedRun.status === 'completed' && (
                             <div className="card shadow-sm mb-3"> {/* Card voor Outline */}
                                 <div className="card-header">
                                     <h4 className="mb-0">Inhoudsopgave</h4>
                                 </div>
                                <div className="card-body">
                                    <pre className="outline-content bg-light p-2 rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>{outlineContent || 'Geen inhoudsopgave beschikbaar.'}</pre>
                                 </div>
                             </div>
                         )}

                        <div className="card shadow-sm mb-3"> {/* Card voor Artikel */}
                            <div className="card-header">
                                <h4 className="mb-0">Gegenereerd Artikel</h4>
                            </div>
                            <div className="card-body">
                                <div className="article-content" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                    <ReactMarkdown>{articleContent || (selectedRun.status !== 'running' && selectedRun.status !== 'pending' && !isLoadingDetails ? <span className="text-muted">Selecteer een voltooide run om resultaten te zien.</span> : '')}</ReactMarkdown>
                                </div>
                            </div>
                        </div>

                         {selectedRun.status === 'completed' && sources.length > 0 && (
                             <div className="card shadow-sm"> {/* Card voor Bronnen */}
                                 <div className="card-header">
                                     <h4 className="mb-0">Bronnen</h4>
                                 </div>
                                 <div className="card-body">
                                     <ul className="sources-list list-unstyled mb-0" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                         {sources.map(source => (
                                             <li key={source.index} className="mb-1 text-truncate">
                                                 <span className="badge bg-secondary me-2">{source.index}</span> 
                                                 <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.url}>
                                                     {source.title || source.url}
                                                 </a>
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                             </div>
                         )}

                    </div>
                ) : (
                    <p className="text-muted">Selecteer een run uit de geschiedenis om details te zien, of start een nieuwe run.</p>
                )}
            </div>
        </div>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <Navbar /> 
                <div className="app-content">
                    <Routes>
                        <Route path="/" element={<HomeRoute />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegistrationPage />} /> 
                        <Route 
                            path="/dashboard"
                            element={
                                <PrivateRoute>
                                    <Dashboard />
                                </PrivateRoute>
                            }
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;
