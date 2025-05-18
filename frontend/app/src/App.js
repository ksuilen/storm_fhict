import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import RunStatisticsPage from './pages/admin/RunStatisticsPage';
import AdminSystemSettingsPage from './pages/AdminSystemSettingsPage';
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

// Nieuwe AdminRoute component
const AdminRoute = ({ children }) => {
    const { user, isLoading } = useAuth();
    // Voeg window.location.pathname toe aan de logs voor context
    console.log(`AdminRoute Check: Path='${window.location.pathname}', isLoading=${isLoading}, User Loaded=${!!user}, User Role=${user?.role}`);

    if (isLoading) {
        console.log(`AdminRoute Decision: Path='${window.location.pathname}', Rendering loading state.`);
        return <div className="container text-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Authenticatie controleren...</p></div>;
    }
    if (!user) {
        console.log(`AdminRoute Decision: Path='${window.location.pathname}', No user, redirecting to /login.`);
        return <Navigate to="/login" replace />;
    }
    if (user.role !== 'admin') {
        console.log(`AdminRoute Decision: Path='${window.location.pathname}', User role is '${user.role}', not 'admin'. Redirecting to /dashboard.`);
        return <Navigate to="/dashboard" replace />; 
    }
    console.log(`AdminRoute Decision: Path='${window.location.pathname}', User is admin. Rendering children.`);
    return children;
};

// --- API Helper ---
// (Vervang met je daadwerkelijke API service/configuratie)
const API_BASE_URL = 'http://localhost:8000'; // Backend URL

async function fetchWithAuth(url, options = {}, logoutAction = null) {
    const token = localStorage.getItem('authToken');
    console.log("fetchWithAuth: Using token:", token ? token.substring(0, 10) + '...' : 'null or empty');
    const headers = {
        ...options.headers,
        'Authorization': token ? `Bearer ${token}` : ''
        // Content-Type wordt hier niet meer standaard gezet, alleen als er een body is.
    };

    if (options.body && !(options.body instanceof FormData)) { // FormData zet zijn eigen Content-Type
        headers['Content-Type'] = 'application/json';
    }

    // Voor GET requests, verwijder Content-Type als er geen body is (tenzij expliciet gezet)
    // Dit is een beetje dubbelop met bovenstaande, maar voor de zekerheid.
    if ((options.method === 'GET' || !options.body) && !options.headers?.['Content-Type']) {
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

    const contentType = response.headers.get('content-type');
    console.log(`fetchWithAuth for ${url}: Content-Type: ${contentType}, Status: ${response.status}`);

    if (!response.ok && response.status !== 204) { 
        const errorData = await response.json().catch(() => ({ detail: `Failed to fetch with status ${response.status}` }));
        console.error('API Error:', errorData);
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null; 
    }

    if (contentType && (contentType.includes('text/plain') || contentType.includes('text/markdown'))) {
        console.log(`fetchWithAuth for ${url}: Returning as text.`);
        return await response.text();
    }
    
    // Default to JSON if not text/plain or text/markdown
    console.log(`fetchWithAuth for ${url}: Attempting to parse as JSON.`);
    try {
        return await response.json(); 
    } catch (e) {
        console.error(`fetchWithAuth for ${url}: Failed to parse JSON. Content-Type was ${contentType}. Error:`, e);
        // Probeer de body als tekst te lezen om te zien wat er misging, als debug info
        const textBody = await response.text().catch(() => "Could not read response body as text.");
        console.error("Response body (text fallback):", textBody.substring(0, 500)); // Log eerste 500 chars
        throw new Error(`Failed to parse JSON from ${url}. Server responded with Content-Type: ${contentType} but body was not valid JSON. Check console for text fallback.`);
    }
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

    console.log("Dashboard rendering. SelectedRun:", selectedRun ? JSON.stringify({ id: selectedRun.id, status: selectedRun.status, topic: selectedRun.topic, end_time: selectedRun.end_time }) : null); // DEBUG LOG

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

    const fetchRunDetails = useCallback(async (runId, latestStatusData = null) => {
        // const currentRuns = runs; // runs kan verouderd zijn direct na een setRuns
        // const run = currentRuns.find(r => r.id === runId);

        // Gebruik latestStatusData als die beschikbaar en relevant is, anders selectedRun, anders zoek in runs list.
        let runToUse = null;
        if (latestStatusData && latestStatusData.id === runId) {
            runToUse = latestStatusData;
        } else if (selectedRun && selectedRun.id === runId) {
            runToUse = selectedRun; 
        }
        // Fallback naar de runs lijst als laatste redmiddel (kan verouderd zijn)
        if (!runToUse) {
            runToUse = runs.find(r => r.id === runId);
        }

        // We zijn alleen geïnteresseerd in het laden van details als de run voltooid is.
        if (!runToUse || runToUse.status !== 'completed') {
             console.log(`fetchRunDetails for ${runId}: Run status is '${runToUse?.status}', not 'completed'. Clearing details.`);
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

            console.log("Raw sourcesData from backend /summary:", sourcesData);

            setArticleContent(articleData || ''); // articleData is text
            setOutlineContent(outlineData || ''); // outlineData is text
            setSources(sourcesData || []); // Update de sources state!

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
    }, [runs, logoutAction, selectedRun]);

    const fetchRunStatus = useCallback(async (jobId) => {
        // LOG AAN HET BEGIN VAN fetchRunStatus (KAN BEHOUDEN WORDEN INDIEN GEWENST, OF VERWIJDERD)
        // console.log(`fetchRunStatus CALLED for jobId: ${jobId}. Current selectedRun in closure:`, 
        //             selectedRun ? { id: selectedRun.id, status: selectedRun.status, topic: selectedRun.topic } : null);

        try {
            // console.log(`Polling status for job ${jobId}`); // Kan veel logs geven
            const statusData = await fetchWithAuth(`/storm/status/${jobId}`, { method: 'GET' }, logoutAction);
            // console.log("Status data received:", statusData); // Kan veel logs geven

            // Update de specifieke run in de lijst ALLEEN als de status verandert
            setRuns(prevRuns => {
                const runIndex = prevRuns.findIndex(run => run.id === jobId);
                if (runIndex === -1) return prevRuns;
                
                const currentRunInList = prevRuns[runIndex];
                if (currentRunInList.status === statusData.status && currentRunInList.error_message === statusData.error_message) {
                    return prevRuns; 
                }
                
                const newRuns = [...prevRuns];
                newRuns[runIndex] = { 
                    ...currentRunInList, 
                    status: statusData.status,
                    error_message: statusData.error_message // Voeg error message toe aan runs lijst update
                };
                return newRuns;
            });

            setSelectedRun(prevSelected => {
                // console.log(`Inside setSelectedRun updater for selectedRun. jobId from poll: ${jobId}, prevSelected:`, 
                //             prevSelected ? { id: prevSelected.id, status: prevSelected.status } : null);

                if (prevSelected && prevSelected.id === jobId) {
                    if (statusData && (prevSelected.status !== statusData.status || prevSelected.error_message !== statusData.error_message)) {
                        // console.log(`Attempting to update selectedRun (id: ${prevSelected.id}). Current status: ${prevSelected.status}, New statusData.status: ${statusData.status}`);
                        const newState = {
                            ...prevSelected,
                            ...(statusData || {}),
                            id: prevSelected.id, 
                            topic: prevSelected.topic || (statusData?.topic || "Unknown Topic")
                        };
                        delete newState.job_id;
                        // console.log(`setSelectedRun: New state for selectedRun (id: ${newState.id}):`, JSON.stringify({ id: newState.id, status: newState.status, topic: newState.topic, end_time: newState.end_time, error_message: newState.error_message }));
                        return newState;
                    }
                    // console.log(`SelectedRun (id: ${prevSelected.id}) status (${prevSelected.status}) is same as statusData.status (${statusData?.status}). No update needed.`);
                    return prevSelected; 
                }
                return prevSelected; 
            });

            if (statusData && statusData.job_id === jobId && statusData.status === 'completed') {
                if (selectedRun && selectedRun.id === jobId) { 
                    // console.log(`Run ${jobId} (selected) has status 'completed'. Fetching details.`);
                    fetchRunDetails(jobId, statusData); 
                }
            }

            // Stop polling for completed or failed/error runs
            if (statusData.status === 'completed' || statusData.status === 'failed' || statusData.status === 'error' || statusData.status === 'cancelled') {
                // console.log(`Run ${jobId} (from status poll) finished with status: ${statusData.status}. Attempting to stop polling.`);
                if (pollIntervalRef.current) { 
                     stopPolling(); 
                }
            }
        } catch (err) {
            console.error(`Failed to fetch status for job ${jobId}:`, err);
            if (err.message !== 'Unauthorized') {
                // console.warn(`Polling error for ${jobId}: ${err.message}`);
            }
        }
    }, [selectedRun, fetchRunDetails, stopPolling, logoutAction]);

    const startPolling = useCallback((jobId) => {
        // console.log(`Attempting to start polling for job ${jobId}. Current pollIntervalRef: ${pollIntervalRef.current}`);
        stopPolling(); 
        // console.log(`Starting polling for job ${jobId} after stopPolling.`);
        fetchRunStatus(jobId); 
        pollIntervalRef.current = setInterval(() => {
            fetchRunStatus(jobId);
        }, 5000); 
    }, [fetchRunStatus, stopPolling]); 
    
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
            const newRunDataFromApi = await fetchWithAuth('/storm/run', {
                method: 'POST',
                body: JSON.stringify({ topic: topic })
            }, logoutAction);
            console.log("New run initiated (API response):", newRunDataFromApi);
            setTopic(''); // Clear input field

            // Map job_id to id for frontend consistency
            const newRunData = {
                ...newRunDataFromApi,
                id: newRunDataFromApi.job_id 
            };

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
                                    <ReactMarkdown
                                      components={{
                                        p: (paragraph) => {
                                          const { node, children, ...rest } = paragraph; // children here is an array of strings or React elements
                                    
                                          const newChildren = React.Children.toArray(children).flatMap((child, childIdx) => {
                                            if (typeof child === 'string') {
                                              const parts = [];
                                              let lastIndex = 0;
                                              const regex = /\[(\d+)\]/g; // Match [number]
                                              // Use node.position to help ensure key uniqueness across paragraphs
                                              const pKey = node && node.position ? `${node.position.start.line}-${node.position.start.column}` : `p-node-${childIdx}`;
                                    
                                              let match;
                                              while ((match = regex.exec(child)) !== null) {
                                                if (match.index > lastIndex) {
                                                  parts.push(child.slice(lastIndex, match.index));
                                                }
                                                const number = match[1];
                                                parts.push(<a key={`${pKey}-cite-${match.index}`} href={`#source-${number}`}>{`[${number}]`}</a>);
                                                lastIndex = regex.lastIndex;
                                              }
                                              if (lastIndex < child.length) {
                                                parts.push(child.slice(lastIndex));
                                              }
                                              return parts; // flatMap will handle array of parts
                                            }
                                            return child; // Return React elements (like <strong>, <em> etc.) as-is
                                          });
                                          return <p {...rest}>{newChildren}</p>;
                                        }
                                      }}
                                    >
                                      {articleContent || (selectedRun.status !== 'running' && selectedRun.status !== 'pending' && !isLoadingDetails ? <span className="text-muted">Selecteer een voltooide run om resultaten te zien.</span> : '')}
                                    </ReactMarkdown>
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
                                             <li key={source.index} id={`source-${source.index}`} className="mb-1 text-truncate">
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
                        {/* Admin Routes */}
                        <Route 
                            path="/admin/users"
                            element={
                                <AdminRoute>
                                    <UserManagementPage />
                                </AdminRoute>
                            }
                        />
                        <Route 
                            path="/admin/stats"
                            element={
                                <AdminRoute>
                                    <RunStatisticsPage />
                                </AdminRoute>
                            }
                        />
                        <Route 
                            path="/admin/system-settings"
                            element={
                                <AdminRoute>
                                    <AdminSystemSettingsPage />
                                </AdminRoute>
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
