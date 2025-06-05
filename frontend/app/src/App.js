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
import VoucherManagementPage from './pages/admin/VoucherManagementPage';
import ProfilePage from './pages/ProfilePage';
import './App.css';
import { fetchWithAuth } from './services/apiService'; // Importeer fetchWithAuth
import html2pdf from 'html2pdf.js/dist/html2pdf.min.js';
// Force import StormStatusTracker to ensure it's included in bundle
import StormStatusTracker from './components/Storm/StormStatusTracker';

const PrivateRoute = ({ children, adminOnly = false }) => {
    const { user, loading, actorType } = useAuth();

    if (loading) {
        return <div className="container text-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Authenticatie controleren...</p></div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && actorType !== 'admin') {
        return <Navigate to="/" replace />; // Redirect non-admins from admin routes
    }
    
    return children;
};

const HomeRoute = () => {
    const { user, isLoading } = useAuth();
    if (isLoading) {
        return <div className="container text-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Loading...</p></div>; 
    }
    return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

// New AdminRoute component
const AdminRoute = ({ children }) => {
    const { user, isLoading, actorType } = useAuth();

    if (isLoading) {
        return <div className="container text-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Checking authentication...</p></div>;
    }
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    if (actorType !== 'admin') { 
        return <Navigate to="/dashboard" replace />;
    }
    return children;
};

// Helper function for stage display text
const getStageDisplayText = (stage) => {
    switch (stage) {
        case 'INITIALIZING': return "Initializing...";
        case 'SETUP_COMPLETE': return "Preparing...";
        case 'RUNNER_INITIALIZED': return "STORM engine started...";
        case 'STORM_PROCESSING': return "Gathering & processing knowledge...";
        case 'STORM_PROCESSING_DONE': return "Data processing completed...";
        case 'GENERATING_OUTLINE': return "Generating outline...";
        case 'GENERATING_ARTICLE': return "Generating article...";
        case 'POLISHING_CONTENT': return "Polishing content...";
        case 'POST_PROCESSING': return "Compiling results...";
        case 'POST_PROCESSING_DONE': return "Compilation completed...";
        case 'FINALIZING': return "Finalizing...";
        case 'RUNNER_INIT_FAILED': return "Initialization failed";
        case 'POST_PROCESSING_FAILED': return "Result processing failed";
        default: return stage ? `(${stage})` : '(Processing...)'; // Show technical stage if no mapping
    }
};

// Helper function for status badge styling (vervangt oude getStatusBadgeClass)
const getDynamicStatusBadgeClass = (status, stage = null) => {
    if (status === 'running') {
        switch (stage) {
            case 'INITIALIZING': return 'bg-info text-dark';
            case 'SETUP_COMPLETE': return 'bg-info text-dark';
            case 'RUNNER_INITIALIZED': return 'bg-primary';
            case 'STORM_PROCESSING': return 'bg-primary';
            case 'STORM_PROCESSING_DONE': return 'bg-primary';
            case 'GENERATING_OUTLINE': return 'bg-secondary';
            case 'GENERATING_ARTICLE': return 'bg-secondary';
            case 'POLISHING_CONTENT': return 'bg-secondary';
            case 'POST_PROCESSING': return 'bg-secondary';
            case 'POST_PROCESSING_DONE': return 'bg-secondary';
            case 'FINALIZING': return 'bg-success';
            case 'RUNNER_INIT_FAILED': return 'bg-danger';
            case 'POST_PROCESSING_FAILED': return 'bg-warning text-dark';
            default: return 'bg-primary';
        }
    }
    switch (status) {
        case 'completed': return 'bg-success';
        case 'pending': return 'bg-warning text-dark';
        case 'failed': return 'bg-danger';
        default: return 'bg-light text-dark';
    }
};

// Helper function to split article content for better readability
const formatArticleContentForReadability = (text) => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    // Split eerst in bestaande paragrafen (dubbele newline)
    const paragraphs = text.split(/\n\n+/);
    const newParagraphs = [];

    paragraphs.forEach(paragraph => {
        // Probeer verder op te splitsen als een paragraaf erg lang is.
        // Regex om zinnen te matchen die eindigen op ., !, ? gevolgd door spatie of einde string.
        const sentences = paragraph.match(/[^.!?]+[.!?](\s+|$)/g);

        if (sentences && sentences.length > 4) { // Arbitraire grens, bv. meer dan 4 zinnen
            let currentNewParagraph = '';
            for (let i = 0; i < sentences.length; i++) {
                currentNewParagraph += sentences[i];
                // Groepeer per 2-3 zinnen, of als het de laatste zin van de originele paragraaf is.
                if ((i + 1) % 3 === 0 || i === sentences.length - 1) {
                    newParagraphs.push(currentNewParagraph.trim());
                    currentNewParagraph = '';
                }
            }
        } else {
            // Korte paragrafen of paragrafen die niet goed in zinnen te splitsen zijn, blijven intact.
            newParagraphs.push(paragraph);
        }
    });

    return newParagraphs.join('\n\n');
};

// --- Dashboard Component ---
// (Dit kan ook in een apart bestand staan, bv. pages/DashboardPage.js)
function Dashboard() {
    const { logoutAction, user, isLoading: authIsLoading, refreshActorDetails, getRemainingRuns } = useAuth();
    const [runs, setRuns] = useState([]);
    const [selectedRun, setSelectedRun] = useState(null);
    const [articleContent, setArticleContent] = useState('');
    const [outlineContent, setOutlineContent] = useState(''); // New state for outline
    const [sources, setSources] = useState([]); // New state for sources
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [error, setError] = useState(null);
    const [topic, setTopic] = useState(''); // State for new run topic
    const [isSubmitting, setIsSubmitting] = useState(false); // State for submit button
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    const pollIntervalRef = React.useRef(null);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []); // No dependencies needed

    const fetchRunHistory = useCallback(async () => {
        if (!user || authIsLoading) {
            setRuns([]);
            return;
        }
        try {
            const data = await fetchWithAuth('/v1/storm/history', { method: 'GET' }, logoutAction);
            setRuns(data || []); // Ensure runs is always an array
        } catch (err) {
            if (err.message !== 'Unauthorized') {
                setError(err.message);
            }
        }
    }, [logoutAction, user, authIsLoading]);

    useEffect(() => {
        if (user && !authIsLoading) { // Fetch when user is available and auth is no longer loading
            fetchRunHistory();
        } else if (!user && !authIsLoading) { // Clear runs if no user and auth settled
            setRuns([]);
        }
    }, [user, authIsLoading, fetchRunHistory]);

    const fetchRunDetails = useCallback(async (runId, latestStatusData = null) => {
        let runToUse = null;
        if (latestStatusData && latestStatusData.id === runId) {
            runToUse = latestStatusData;
        } else if (selectedRun && selectedRun.id === runId) {
            runToUse = selectedRun; 
        }
        if (!runToUse) {
            runToUse = runs.find(r => r.id === runId);
        }

        if (!runToUse || runToUse.status !== 'completed') {
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
            const [articleData, outlineData, sourcesData] = await Promise.all([
                fetchWithAuth(`/v1/storm/results/${runId}/article`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e;
                    return 'Could not load article.'; 
                }),
                fetchWithAuth(`/v1/storm/results/${runId}/outline`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e;
                    return 'Could not load table of contents.'; 
                }),
                fetchWithAuth(`/v1/storm/results/${runId}/summary`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e;
                    return []; 
                })
            ]);

            let finalArticleContent = '';
            if (typeof articleData === 'string') {
                finalArticleContent = articleData;
            } else if (articleData && typeof articleData === 'object') {
                if (typeof articleData.article_text === 'string') {
                    finalArticleContent = articleData.article_text;
                } else if (typeof articleData.text === 'string') {
                    finalArticleContent = articleData.text;
                } else if (typeof articleData.content === 'string') {
                    finalArticleContent = articleData.content;
                } else if (typeof articleData.message === 'string') {
                    finalArticleContent = `Error loading article: ${articleData.message}`;
                } else if (typeof articleData.detail === 'string') {
                    finalArticleContent = `Error loading article: ${articleData.detail}`;
                } else {
                    finalArticleContent = `Unexpected article format. Raw data: ${JSON.stringify(articleData)}`;
                }
            } else if (articleData === null || articleData === undefined) {
                 finalArticleContent = 'Article not (yet) available.';
            } else {
                 finalArticleContent = 'Could not load article (unknown format).';
            }
            setArticleContent(finalArticleContent);

            let finalOutlineContent = '';
            if (typeof outlineData === 'string') {
                finalOutlineContent = outlineData;
            } else if (outlineData && typeof outlineData === 'object') {
                if (typeof outlineData.outline_text === 'string') {
                    finalOutlineContent = outlineData.outline_text;
                } else if (typeof outlineData.text === 'string') {
                    finalOutlineContent = outlineData.text;
                } else if (typeof outlineData.content === 'string') {
                    finalOutlineContent = outlineData.content;
                } else if (typeof outlineData.message === 'string') {
                    finalOutlineContent = `Error loading table of contents: ${outlineData.message}`;
                } else if (typeof outlineData.detail === 'string') {
                    finalOutlineContent = `Error loading table of contents: ${outlineData.detail}`;
                } else {
                    finalOutlineContent = `Unexpected table of contents format. Raw data: ${JSON.stringify(outlineData)}`;
                }
            } else if (outlineData === null || outlineData === undefined) {
                finalOutlineContent = 'Table of contents not (yet) available.';
            } else {
                finalOutlineContent = 'Could not load table of contents (unknown format).';
            }
            setOutlineContent(finalOutlineContent);
            
            setSources(sourcesData || []); // Update de sources state!

        } catch (err) {
            if (err.message !== 'Unauthorized') {
                setError(`Failed to load details for run ${runId}: ${err.message}`);
                setArticleContent('Error loading article.'); // Show error in content area
                setOutlineContent('Error loading table of contents.');
                setSources([]);
            }
        } finally {
            setIsLoadingDetails(false);
        }
    }, [runs, logoutAction, selectedRun]);

    useEffect(() => {
        const startPolling = (runId) => {
            stopPolling(); // Stop eventuele vorige polls

            pollIntervalRef.current = setInterval(async () => {
                try {
                    const statusData = await fetchWithAuth(`/v1/storm/status/${runId}`, { method: 'GET' }, logoutAction);
                    
                    setRuns(prevRuns => prevRuns.map(r => r.id === runId ? { ...r, ...statusData } : r));

                    setSelectedRun(prevSelectedRun => {
                        if (prevSelectedRun && prevSelectedRun.id === runId) {
                            const previousStatus = prevSelectedRun.status;
                            
                            if (statusData.status === 'completed' && previousStatus !== 'completed') {
                                setTimeout(() => {
                                    fetchRunDetails(runId, statusData);
                                }, 5000); // 5 second delay to ensure files are ready
                                if (refreshActorDetails) refreshActorDetails();
                                stopPolling();
                            } else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
                                fetchRunDetails(runId, statusData); // Ook bij fail/cancel details (bv. error message) laden.
                                stopPolling();
                            }
                            return { ...prevSelectedRun, ...statusData };
                        }
                        return prevSelectedRun;
                    });

                } catch (error) {
                    if (error.message !== 'Unauthorized' && error.message !== "Failed to fetch") {
                        setError(`Error fetching status for run ${runId}: ${error.message}`);
                    }
                }
            }, 5000); // Poll elke 5 seconden
        };

        if (selectedRun && (selectedRun.status === 'pending' || selectedRun.status === 'running')) {
            startPolling(selectedRun.id);
        } else {
            stopPolling();
        }

        return () => {
            stopPolling();
        };
    }, [selectedRun, logoutAction, stopPolling, fetchRunDetails, refreshActorDetails]);

    // --- Event Handlers ---
     const handleRunSelect = (run) => {
        stopPolling(); // Stop polling als we een andere run selecteren
        setSelectedRun(run);
        if (run.status === 'running' || run.status === 'pending') {
            setArticleContent(''); // Clear details for running job
            setOutlineContent('');
            setSources([]);
            setError(null);
        } else if (run.status === 'completed') {
             fetchRunDetails(run.id);
        } else { // Failed or other status
             setArticleContent(`Run failed: ${run.error_message || 'Unknown error'}`);
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
            const newRunDataFromApi = await fetchWithAuth('/v1/storm/run', {
                method: 'POST',
                body: JSON.stringify({ topic: topic })
            }, logoutAction);
            setTopic(''); // Clear input field

            const newRunData = {
                ...newRunDataFromApi,
                id: newRunDataFromApi.job_id 
            };

            setRuns(prevRuns => [newRunData, ...prevRuns]);
            handleRunSelect(newRunData); // Selecteer en begin met pollen
        } catch (err) {
            if (err.message !== 'Unauthorized') {
                setError(`Failed to start run: ${err.message}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRun = async (runId, e) => {
        e.stopPropagation(); // Voorkom dat selectie trigger wordt
        if (!window.confirm(`Are you sure you want to delete run ${runId}? This cannot be undone.`)) {
            return;
        }

        setError(null);
        stopPolling(); // Stop polling als we gaan verwijderen

        try {
            await fetchWithAuth(`/v1/storm/run/${runId}`, { method: 'DELETE' }, logoutAction);
            
            setRuns(prevRuns => prevRuns.filter(run => run.id !== runId));
            
            if (selectedRun && selectedRun.id === runId) {
                setSelectedRun(null);
                setArticleContent('');
                 setOutlineContent('');
                 setSources([]);
            }
            
        } catch (err) {
            if (err.message !== 'Unauthorized') {
                setError(`Failed to delete run ${runId}: ${err.message}`);
            }
        }
    };

    const handleDownloadPdf = async () => {
        if (!selectedRun || !articleContent) return;
        setIsDownloadingPdf(true);

        const articleElement = document.querySelector('.article-content');
        const sourcesElement = document.querySelector('.sources-list');

        if (!articleElement) {
            setIsDownloadingPdf(false);
            return;
        }

        const container = document.createElement('div');
        
        const titleElement = document.createElement('h1');
        titleElement.innerText = selectedRun.topic || "Generated Article";
        container.appendChild(titleElement);

        const clonedArticle = articleElement.cloneNode(true);
        clonedArticle.style.maxHeight = 'none'; // Verwijder maxHeight voor PDF
        container.appendChild(clonedArticle);

        if (sourcesElement && sources.length > 0) {
            const sourcesTitleElement = document.createElement('h2');
            sourcesTitleElement.innerText = "Sources";
            sourcesTitleElement.style.marginTop = '20px';
            container.appendChild(sourcesTitleElement);
            
            const clonedSources = sourcesElement.cloneNode(true);
            clonedSources.style.maxHeight = 'none'; // Verwijder maxHeight voor PDF
            clonedSources.style.listStyleType = 'decimal'; // Zorg voor nummering in PDF
            Array.from(clonedSources.getElementsByTagName('a')).forEach(a => {
                a.innerText = a.href;
            });
            container.appendChild(clonedSources);
        }
        
        const pdfFilename = `${selectedRun.topic ? selectedRun.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'article'}_${selectedRun.id}.pdf`;
        const opt = {
            margin:       1,
            filename:     pdfFilename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false }, // useCORS kan nodig zijn voor externe afbeeldingen (niet van toepassing hier)
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        try {
            await html2pdf().from(container).set(opt).save();
        } catch (pdfError) {
            setError("Error generating PDF.");
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    // --- Render JSX ---
    return (
        <div className="dashboard-container row g-0 flex-grow-1"> 
            <div className="sidebar col-md-4 col-lg-3 border-end bg-light p-3" style={{ overflowY: 'auto' }}>
                <h2>New STORM Run</h2>
                 <form onSubmit={handleNewRunSubmit} className="new-run-form mb-4"> {/* Extra marge onder form */}
                    <div className="mb-3">
                        <input
                            type="text"
                            className="form-control" // Bootstrap class
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Enter topic"
                            disabled={isSubmitting}
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="btn btn-primary w-100" 
                        disabled={!topic.trim() || isSubmitting || (user && user.actor_type === 'voucher' && getRemainingRuns() <= 0)}
                    > 
                        {isSubmitting ? (
                             <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Starting...</> 
                        ) : 'Start Run'}
                    </button>
                </form>
                
                <h2>Run History</h2>
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
                                    <span className={`badge rounded-pill ${getDynamicStatusBadgeClass(run.status, run.current_stage)}`}>
                                        {run.status === 'running' ? getStageDisplayText(run.current_stage) : run.status}
                                    </span>
                                </div>
                                <small className="text-muted d-block">
                                    {run.start_time ? new Date(run.start_time).toLocaleString() : 'Invalid Date'}
                                 </small>
                            </div>
                            <button 
                                className="btn btn-sm btn-outline-danger border-0"
                                onClick={(e) => handleDeleteRun(run.id, e)}
                                title="Delete run"
                                style={{ marginLeft: 'auto' }}
                             >
                                &#x1F5D1;
                            </button>
                        </li>
                    ))}
                </ul>
                {runs.length === 0 && !authIsLoading && <p>No runs found.</p>}
            </div>
            <div className="main-content col-md-8 col-lg-9 p-4" style={{ overflowY: 'auto' }}>
                <h2>Task Details & Results</h2>
                {error && <div className="alert alert-danger">Error: {error}</div>} {/* Bootstrap alert */}
                
                {selectedRun && (selectedRun.status === 'running' || selectedRun.status === 'pending') && (
                    <div className="mb-4">
                        <StormStatusTracker 
                            runId={selectedRun.id} 
                            isCompleted={false}
                            onComplete={(data) => {
                                setTimeout(() => {
                                    fetchRunDetails(selectedRun.id);
                                    setSelectedRun(prev => prev ? { ...prev, status: 'completed' } : null);
                                }, 5000); // 5 second delay to ensure files are ready
                                if (refreshActorDetails) refreshActorDetails();
                            }}
                            onError={(error) => {
                                setError(`WebSocket error: ${error}`);
                            }}
                        />
                    </div>
                )}
                
                {selectedRun ? (
                    <div className="run-details"> 
                        <h3>{selectedRun.topic} (ID: {selectedRun.id})</h3>
                        <p>
                            <strong>Status:</strong> 
                            <span className={`badge rounded-pill ms-2 ${getDynamicStatusBadgeClass(selectedRun.status, selectedRun.current_stage)}`}>
                                {selectedRun.status === 'running' 
                                    ? getStageDisplayText(selectedRun.current_stage) 
                                    : (selectedRun.status === 'failed' && selectedRun.error_message 
                                        ? `${selectedRun.status} (Error: ${selectedRun.error_message.substring(0,50)}${selectedRun.error_message.length > 50 ? '...':''})`
                                        : selectedRun.status)}
                            </span>
                            {selectedRun.status === 'completed' && (
                                <button 
                                    className="btn btn-sm btn-outline-primary ms-2" 
                                    onClick={() => fetchRunDetails(selectedRun.id)}
                                    disabled={isLoadingDetails}
                                    title="Reload results"
                                >
                                    {isLoadingDetails ? (
                                        <span className="spinner-border spinner-border-sm" role="status"></span>
                                    ) : (
                                        '🔄 Reload'
                                    )}
                                </button>
                            )}
                        </p>
                         {(selectedRun.status === 'running' || selectedRun.status === 'pending') && !selectedRun.current_stage && (
                            <div className="d-flex align-items-center text-primary mb-3">
                                <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                <span>Task is running...</span>
                            </div>
                         )}

                         {isLoadingDetails && (
                            <div className="d-flex align-items-center text-muted mb-3">
                                <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                <span>Loading details...</span>
                            </div>
                         )}

                         {selectedRun.status === 'completed' ? (
                             <ul className="nav nav-tabs" id={`runTabs-${selectedRun.id}`} role="tablist">
                                 <li className="nav-item" role="presentation">
                                     <button className="nav-link active" id={`results-tab-${selectedRun.id}`} data-bs-toggle="tab" data-bs-target={`#results-${selectedRun.id}`} type="button" role="tab" aria-controls={`results-${selectedRun.id}`} aria-selected="true">
                                         📄 Results
                                     </button>
                                 </li>
                                 <li className="nav-item" role="presentation">
                                     <button className="nav-link" id={`progress-tab-${selectedRun.id}`} data-bs-toggle="tab" data-bs-target={`#progress-${selectedRun.id}`} type="button" role="tab" aria-controls={`progress-${selectedRun.id}`} aria-selected="false">
                                         📊 Progress Data
                                     </button>
                                 </li>
                             </ul>
                         ) : null}

                         <div className="tab-content" id={`runTabContent-${selectedRun.id}`}>
                             <div className={`tab-pane fade ${selectedRun.status === 'completed' ? 'show active' : ''}`} id={`results-${selectedRun.id}`} role="tabpanel" aria-labelledby={`results-tab-${selectedRun.id}`}>
                                 {selectedRun.status === 'completed' && (
                                     <div className="card shadow-sm mb-3 mt-3"> {/* Card voor Outline */}
                                         <div className="card-header">
                                             <h4 className="mb-0">Table of Contents</h4>
                                         </div>
                                        <div className="card-body">
                                            <pre className="outline-content bg-light p-2 rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>{outlineContent || (selectedRun.status === 'completed' && !isLoadingDetails ? 'No table of contents available.' : '')}</pre>
                                         </div>
                                     </div>
                                 )}

                                <div className={`card shadow-sm mb-3 ${selectedRun.status !== 'completed' ? 'mt-3' : ''}`}> {/* Card voor Artikel */}
                                    <div className="card-header d-flex justify-content-between align-items-center">
                                        <h4 className="mb-0">Generated Article</h4>
                                        {selectedRun && selectedRun.status === 'completed' && articleContent && (
                                            <button 
                                                className="btn btn-sm btn-outline-primary" 
                                                onClick={handleDownloadPdf}
                                                disabled={isDownloadingPdf}
                                            >
                                                {isDownloadingPdf ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                        Downloading...
                                                    </>
                                                ) : (
                                                    'Download PDF'
                                                )}
                                            </button>
                                        )}
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
                                              {articleContent ? formatArticleContentForReadability(articleContent) : 
                                                (selectedRun && selectedRun.status === 'completed' && !isLoadingDetails ? "No article available." : 
                                                (selectedRun && selectedRun.status !== 'running' && selectedRun.status !== 'pending' && !isLoadingDetails ? "Results are being loaded or not available for this status." : 
                                                ""))}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>

                                 {selectedRun.status === 'completed' && sources.length > 0 && (
                                     <div className="card shadow-sm"> {/* Card voor Bronnen */}
                                         <div className="card-header">
                                             <h4 className="mb-0">Sources</h4>
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

                             {selectedRun.status === 'completed' && (
                                 <div className="tab-pane fade" id={`progress-${selectedRun.id}`} role="tabpanel" aria-labelledby={`progress-tab-${selectedRun.id}`}>
                                     <div className="mt-3">
                                         <StormStatusTracker 
                                             runId={selectedRun.id} 
                                             isCompleted={true}
                                             onComplete={() => {}}
                                             onError={() => {}}
                                         />
                                     </div>
                                 </div>
                             )}
                         </div>

                    </div>
                ) : (
                    <p className="text-muted">Select a run from the history to see details, or start a new run.</p>
                )}
            </div>
        </div>
    );
}

function App() {
    const { token, logout } = useAuth(); // Haal logout op uit useAuth

    const fetchRunHistory = useCallback(async () => {
        if (!token) return;
        try {
            const historyData = await fetchWithAuth('/v1/storm/history', { method: 'GET' }, logout); // Geef logout mee
            console.log("Fetched history data:", historyData); // Tijdelijke log om te zien of data binnenkomt
        } catch (err) {
        }
    }, [token, logout]); // Voeg logout toe aan dependency array

    useEffect(() => {
        if (token) { // Fetch for both types if logged in
            fetchRunHistory();
        }
    }, [token, fetchRunHistory]);

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
                        <Route 
                            path="/admin/vouchers"
                            element={
                                <PrivateRoute adminOnly={true}>
                                    <VoucherManagementPage />
                                </PrivateRoute>
                            }
                        />
                        <Route 
                            path="/profile"
                            element={
                                <PrivateRoute>
                                    <ProfilePage />
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
