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

const PrivateRoute = ({ children, adminOnly = false }) => {
    const { user, loading, actorType } = useAuth();

    if (loading) {
        return <div className="container text-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Authenticatie controleren...</p></div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && actorType !== 'admin') {
        // console.log("User is not admin, redirecting from admin route. Actor type:", actorType);
        return <Navigate to="/" replace />; // Redirect non-admins from admin routes
    }
    
    return children;
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
    const { user, isLoading, actorType } = useAuth();
    // Voeg window.location.pathname toe aan de logs voor context
    // console.log(`AdminRoute Check: Path='${window.location.pathname}', isLoading=${isLoading}, User Loaded=${!!user}, User Role=${user?.role}`);

    if (isLoading) {
        // console.log(`AdminRoute Decision: Path='${window.location.pathname}', Rendering loading state.`);
        return <div className="container text-center mt-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div><p>Authenticatie controleren...</p></div>;
    }
    if (!user) {
        // console.log(`AdminRoute Decision: Path='${window.location.pathname}', No user, redirecting to /login.`);
        return <Navigate to="/login" replace />;
    }
    if (actorType !== 'admin') { 
        // console.log(`AdminRoute Decision: Path='${window.location.pathname}', actorType is '${actorType}', not 'admin'. Redirecting to /dashboard.`);
        return <Navigate to="/dashboard" replace />;
    }
    // console.log(`AdminRoute Decision: Path='${window.location.pathname}', User is admin. Rendering children.`);
    return children;
};

// Helper functie voor stage display tekst
const getStageDisplayText = (stage) => {
    switch (stage) {
        case 'INITIALIZING': return "Initialiseren...";
        case 'SETUP_COMPLETE': return "Voorbereiden...";
        case 'RUNNER_INITIALIZED': return "Storm engine gestart...";
        case 'STORM_PROCESSING': return "Kennis vergaren & verwerken...";
        case 'STORM_PROCESSING_DONE': return "Verwerking data afgerond...";
        case 'GENERATING_OUTLINE': return "Inhoudsopgave genereren...";
        case 'GENERATING_ARTICLE': return "Artikel genereren...";
        case 'POLISHING_CONTENT': return "Tekst polijsten...";
        case 'POST_PROCESSING': return "Resultaten samenstellen...";
        case 'POST_PROCESSING_DONE': return "Samenstellen afgerond...";
        case 'FINALIZING': return "Afronden...";
        case 'RUNNER_INIT_FAILED': return "Fout bij initialisatie";
        case 'POST_PROCESSING_FAILED': return "Fout bij resultaatverwerking";
        default: return stage ? `(${stage})` : '(Bezig...)'; // Toon technische stage als geen mapping
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

// Helper functie om artikelcontent op te delen voor betere leesbaarheid
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
    const [outlineContent, setOutlineContent] = useState(''); // Nieuwe state voor outline
    const [sources, setSources] = useState([]); // Nieuwe state voor sources
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [error, setError] = useState(null);
    const [topic, setTopic] = useState(''); // State voor nieuw run topic
    const [isSubmitting, setIsSubmitting] = useState(false); // State voor submit knop
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    // console.log("Dashboard rendering. SelectedRun:", selectedRun ? JSON.stringify({ id: selectedRun.id, status: selectedRun.status, topic: selectedRun.topic, end_time: selectedRun.end_time }) : null); // DEBUG LOG

    const pollIntervalRef = React.useRef(null);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            // console.log("Stopping polling.");
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []); // Geen dependencies nodig

    const fetchRunHistory = useCallback(async () => {
        if (!user || authIsLoading) {
            // console.log("Skipping fetchRunHistory: user not yet available or auth is loading.");
            setRuns([]);
            return;
        }
        try {
            const data = await fetchWithAuth('/v1/storm/history', { method: 'GET' }, logoutAction);
            setRuns(data || []); // Zorg ervoor dat runs altijd een array is
        } catch (err) {
            console.error("Failed to fetch run history:", err);
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
             // console.log(`fetchRunDetails for ${runId}: Run status is '${runToUse?.status}', not 'completed'. Clearing details.`);
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
                fetchWithAuth(`/v1/storm/results/${runId}/article`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e; // Hergooi voor centrale afhandeling
                    console.error('Article fetch error:', e); return 'Kon artikel niet laden.'; 
                }),
                fetchWithAuth(`/v1/storm/results/${runId}/outline`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e;
                    console.error('Outline fetch error:', e); return 'Kon inhoudsopgave niet laden.'; 
                }),
                fetchWithAuth(`/v1/storm/results/${runId}/summary`, { method: 'GET' }, logoutAction).catch(e => { 
                    if (e.message === 'Unauthorized') throw e;
                    console.error('Sources fetch error:', e); return []; 
                })
            ]);

            // console.log("Raw sourcesData from backend /summary:", sourcesData);

            // Robust handling for articleData
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
                    finalArticleContent = `Fout bij laden van artikel: ${articleData.message}`;
                } else if (typeof articleData.detail === 'string') { // FastAPI common error detail
                    finalArticleContent = `Fout bij laden van artikel: ${articleData.detail}`;
                } else {
                    console.warn("Article data received was an object, not a string. Stringifying for display:", articleData);
                    finalArticleContent = `Onverwacht artikelformaat. Ruwe data: ${JSON.stringify(articleData)}`;
                }
            } else if (articleData === null || articleData === undefined) {
                 finalArticleContent = 'Artikel (nog) niet beschikbaar.';
            } else {
                 finalArticleContent = 'Kon artikel niet laden (onbekend formaat).';
            }
            setArticleContent(finalArticleContent);

            // Robust handling for outlineData
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
                    finalOutlineContent = `Fout bij laden van inhoudsopgave: ${outlineData.message}`;
                } else if (typeof outlineData.detail === 'string') {
                    finalOutlineContent = `Fout bij laden van inhoudsopgave: ${outlineData.detail}`;
                } else {
                    console.warn("Outline data received was an object, not a string. Stringifying for display:", outlineData);
                    finalOutlineContent = `Onverwacht formaat inhoudsopgave. Ruwe data: ${JSON.stringify(outlineData)}`;
                }
            } else if (outlineData === null || outlineData === undefined) {
                finalOutlineContent = 'Inhoudsopgave (nog) niet beschikbaar.';
            } else {
                finalOutlineContent = 'Kon inhoudsopgave niet laden (onbekend formaat).';
            }
            setOutlineContent(finalOutlineContent);
            
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

    useEffect(() => {
        // Functie om polling te starten voor de geselecteerde run
        const startPolling = (runId) => {
            stopPolling(); // Stop eventuele vorige polls

            pollIntervalRef.current = setInterval(async () => {
                try {
                    // console.log(`Polling for status of run ${runId}...`);
                    const statusData = await fetchWithAuth(`/v1/storm/status/${runId}`, { method: 'GET' }, logoutAction);
                    
                    // Update de run in de 'runs' lijst
                    setRuns(prevRuns => prevRuns.map(r => r.id === runId ? { ...r, ...statusData } : r));

                    // Update ook de selectedRun als deze overeenkomt, met de NIEUWSTE data.
                    setSelectedRun(prevSelectedRun => {
                        if (prevSelectedRun && prevSelectedRun.id === runId) {
                            const previousStatus = prevSelectedRun.status; // Status *voor* deze update
                            
                            // Als de nieuwe status 'completed' is en de vorige niet, trigger acties
                            if (statusData.status === 'completed' && previousStatus !== 'completed') {
                                console.log(`Run ${runId} completed. Fetching details and refreshing actor info.`);
                                // Add a small delay to ensure files are ready
                                setTimeout(() => {
                                    fetchRunDetails(runId, statusData);
                                }, 2000); // 2 second delay
                                if (refreshActorDetails) refreshActorDetails(); // Refresh voucher/admin info
                                stopPolling(); 
                                
                                // Show success notification
                                const notification = document.createElement('div');
                                notification.className = 'alert alert-success alert-dismissible fade show position-fixed';
                                notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
                                notification.innerHTML = `
                                    <strong>✅ Run Voltooid!</strong><br>
                                    "${statusData.topic || 'Run'}" is klaar. Resultaten worden geladen...
                                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                                `;
                                document.body.appendChild(notification);
                                
                                // Auto-remove after 5 seconds
                                setTimeout(() => {
                                    if (notification.parentNode) {
                                        notification.parentNode.removeChild(notification);
                                    }
                                }, 5000);
                            } else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
                                console.log(`Run ${runId} ${statusData.status}. Stopping polling, fetching details.`);
                                fetchRunDetails(runId, statusData); // Ook bij fail/cancel details (bv. error message) laden.
                                stopPolling();
                            }
                            return { ...prevSelectedRun, ...statusData }; // Return de geupdatete state
                        }
                        return prevSelectedRun; // Geen wijziging als de ID niet matcht
                    });

                } catch (error) {
                    console.error(`Error polling status for run ${runId}:`, error);
                    if (error.message !== 'Unauthorized' && error.message !== "Failed to fetch") { // Voorkom error spam bij logout/netwerkissues
                        setError(`Fout bij ophalen status run ${runId}: ${error.message}`);
                    }
                    // Overweeg polling te stoppen bij bepaalde (niet-auth) fouten om loops te voorkomen
                    // Bijv. als error.message wijst op een serverfout die niet snel herstelt.
                    // stopPolling(); 
                }
            }, 5000); // Poll elke 5 seconden
        };

        if (selectedRun && (selectedRun.status === 'pending' || selectedRun.status === 'running')) {
            // console.log(`Starting polling for selected run ${selectedRun.id} with status ${selectedRun.status}`);
            startPolling(selectedRun.id);
        } else {
            // console.log("Selected run is not pending or running, or no run selected. Stopping polling.");
            stopPolling();
        }

        return () => {
            stopPolling();
        };
    }, [selectedRun, logoutAction, stopPolling, fetchRunDetails, refreshActorDetails]); // refreshActorDetails toegevoegd als dependency

    // --- Event Handlers ---
     const handleRunSelect = (run) => {
        stopPolling(); // Stop polling als we een andere run selecteren
        setSelectedRun(run);
        if (run.status === 'running' || run.status === 'pending') {
            // startPolling(run.id); // This call is removed as useEffect [selectedRun] handles polling initiation
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
            const newRunDataFromApi = await fetchWithAuth('/v1/storm/run', {
                method: 'POST',
                body: JSON.stringify({ topic: topic })
            }, logoutAction);
            // console.log("New run initiated (API response):", newRunDataFromApi);
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
            await fetchWithAuth(`/v1/storm/run/${runId}`, { method: 'DELETE' }, logoutAction);
            
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

    const handleDownloadPdf = async () => {
        if (!selectedRun || !articleContent) return;
        setIsDownloadingPdf(true);

        const articleElement = document.querySelector('.article-content');
        const sourcesElement = document.querySelector('.sources-list');

        if (!articleElement) {
            console.error("Article element not found for PDF generation.");
            setIsDownloadingPdf(false);
            return;
        }

        // Creëer een container div om beide elementen in te stoppen voor de PDF
        const container = document.createElement('div');
        
        // Titel voor het artikel
        const titleElement = document.createElement('h1');
        titleElement.innerText = selectedRun.topic || "Gegenereerd Artikel";
        container.appendChild(titleElement);

        // Kloon het artikel en de bronnen om de originele weergave niet te beïnvloeden
        const clonedArticle = articleElement.cloneNode(true);
        clonedArticle.style.maxHeight = 'none'; // Verwijder maxHeight voor PDF
        container.appendChild(clonedArticle);

        if (sourcesElement && sources.length > 0) {
            const sourcesTitleElement = document.createElement('h2');
            sourcesTitleElement.innerText = "Bronnen";
            sourcesTitleElement.style.marginTop = '20px';
            container.appendChild(sourcesTitleElement);
            
            const clonedSources = sourcesElement.cloneNode(true);
            clonedSources.style.maxHeight = 'none'; // Verwijder maxHeight voor PDF
            clonedSources.style.listStyleType = 'decimal'; // Zorg voor nummering in PDF
            // Maak links volledig zichtbaar
            Array.from(clonedSources.getElementsByTagName('a')).forEach(a => {
                a.innerText = a.href;
            });
            container.appendChild(clonedSources);
        }
        
        // Opties voor html2pdf
        const pdfFilename = `${selectedRun.topic ? selectedRun.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'artikel'}_${selectedRun.id}.pdf`;
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
            console.error("Error generating PDF:", pdfError);
            setError("Fout bij het genereren van de PDF.");
        } finally {
            setIsDownloadingPdf(false);
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
                    <button 
                        type="submit" 
                        className="btn btn-primary w-100" 
                        disabled={!topic.trim() || isSubmitting || (user && user.actor_type === 'voucher' && getRemainingRuns() <= 0)}
                    > 
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
                            <span className={`badge rounded-pill ms-2 ${getDynamicStatusBadgeClass(selectedRun.status, selectedRun.current_stage)}`}>
                                {selectedRun.status === 'running' 
                                    ? getStageDisplayText(selectedRun.current_stage) 
                                    : (selectedRun.status === 'failed' && selectedRun.error_message 
                                        ? `${selectedRun.status} (Fout: ${selectedRun.error_message.substring(0,50)}${selectedRun.error_message.length > 50 ? '...':''})` 
                                        : selectedRun.status)}
                            </span>
                            {selectedRun.status === 'completed' && (
                                <button 
                                    className="btn btn-sm btn-outline-primary ms-2" 
                                    onClick={() => fetchRunDetails(selectedRun.id)}
                                    disabled={isLoadingDetails}
                                    title="Herlaad resultaten"
                                >
                                    {isLoadingDetails ? (
                                        <span className="spinner-border spinner-border-sm" role="status"></span>
                                    ) : (
                                        '🔄 Herlaad'
                                    )}
                                </button>
                            )}
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
                                    <pre className="outline-content bg-light p-2 rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>{outlineContent || (selectedRun.status === 'completed' && !isLoadingDetails ? 'Geen inhoudsopgave beschikbaar.' : '')}</pre>
                                 </div>
                             </div>
                         )}

                        <div className="card shadow-sm mb-3"> {/* Card voor Artikel */}
                            <div className="card-header d-flex justify-content-between align-items-center">
                                <h4 className="mb-0">Gegenereerd Artikel</h4>
                                {selectedRun && selectedRun.status === 'completed' && articleContent && (
                                    <button 
                                        className="btn btn-sm btn-outline-primary" 
                                        onClick={handleDownloadPdf}
                                        disabled={isDownloadingPdf}
                                    >
                                        {isDownloadingPdf ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                Downloaden...
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
                                      {articleContent ? formatArticleContentForReadability(articleContent) : 
                                        (selectedRun && selectedRun.status === 'completed' && !isLoadingDetails ? "Geen artikel beschikbaar." : 
                                        (selectedRun && selectedRun.status !== 'running' && selectedRun.status !== 'pending' && !isLoadingDetails ? "Resultaten worden geladen of zijn niet beschikbaar voor deze status." : 
                                        ""))}
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
    const { /* user, actorType, isLoading, */ token, logout } = useAuth(); // Haal logout op uit useAuth
    // const [runHistory, setRunHistory] = useState([]);
    // const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    // const [errorHistory, setErrorHistory] = useState(null);

    // Navigatie items
    // const commonNavItems = [
    //     { path: "/dashboard", label: "Dashboard" },
    // ];
    // const adminNavItems = [
    //     ...commonNavItems,
    //     { path: "/admin/vouchers", label: "Voucher Management" },
    //     { path: "/admin/users", label: "User Management" }, 
    //     { path: "/admin/system-settings", label: "System Settings" },
    //     { path: "/admin/run-history-all", label: "All Run History" },
    // ];
    // const voucherNavItems = [
    //     ...commonNavItems,
    //     // Vouchers zien hun eigen history op het dashboard of een /my-history pagina
    // ];

    // const currentNavItems = actorType === 'admin' ? adminNavItems : (actorType === 'voucher' ? voucherNavItems : commonNavItems);

    const fetchRunHistory = useCallback(async () => {
        if (!token) return;
        // setIsLoadingHistory(true);
        // setErrorHistory(null);
        try {
            // Admins en Vouchers gebruiken hetzelfde /storm/history endpoint nu.
            // De backend differentieert op basis van de token (actor_type).
            const historyData = await fetchWithAuth('/v1/storm/history', { method: 'GET' }, logout); // Geef logout mee
            // setRunHistory(historyData || []);
            console.log("Fetched history data:", historyData); // Tijdelijke log om te zien of data binnenkomt
        } catch (err) {
            console.error("Failed to fetch run history:", err);
            // setErrorHistory(err.message || "Failed to load run history.");
            // Als de error door logout komt, hoeft hier niet nogmaals gelogd te worden, fetchWithAuth doet dat al.
        }
        // setIsLoadingHistory(false);
    }, [token, logout]); // Voeg logout toe aan dependency array

    useEffect(() => {
        if (token /* && (actorType === 'admin' || actorType === 'voucher') */) { // Fetch for both types if logged in
            fetchRunHistory();
        }
    }, [token, /* actorType, */ fetchRunHistory]);

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
