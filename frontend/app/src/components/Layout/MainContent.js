import React from 'react';
import StormRunnerForm from '../Storm/StormRunnerForm';
import StormStatusTracker from '../Storm/StormStatusTracker';
import ReactMarkdown from 'react-markdown';

function MainContent({ 
    currentJobResult, 
    jobError, 
    isJobRunning, 
    onJobStarted, 
    onJobError, 
    onSubmitting,
    showForm, // Nieuwe prop om formulier te tonen/verbergen
    activeJobId, // Nieuwe prop voor WebSocket connection
}) {
    
    const handleStormComplete = (completionData) => {
        console.log('STORM completed:', completionData);
        // Trigger refresh of job status in parent component
        if (onJobStarted) {
            // This will trigger a status refresh in the parent
            onJobStarted({ job_id: activeJobId, status: 'completed' });
        }
    };

    const handleStormError = (error) => {
        console.error('STORM WebSocket error:', error);
        if (onJobError) {
            onJobError(`Real-time connection error: ${error}`);
        }
    };

    return (
        <div className="flex-grow-1 p-4 h-100">
            {/* Hidden component to ensure it's included in bundle */}
            <div style={{ display: 'none' }}>
                <StormStatusTracker runId={0} onComplete={() => {}} onError={() => {}} />
            </div>
            
            {showForm && (
                <div className="card mb-4">
                    <div className="card-body">
                        <h3 className="card-title">Start een nieuwe Storm Run</h3>
                        <StormRunnerForm 
                            onJobStarted={onJobStarted} 
                            onJobError={onJobError}
                            onSubmitting={onSubmitting}
                        />
                    </div>
                </div>
            )}

            {/* Real-time Status Tracker for running jobs */}
            {isJobRunning && activeJobId && (
                <div className="mb-4">
                    <StormStatusTracker 
                        runId={activeJobId}
                        onComplete={handleStormComplete}
                        onError={handleStormError}
                    />
                </div>
            )}

            {(currentJobResult || jobError || isJobRunning) && (
                 <div className="card">
                    <div className="card-body">
                        <h3 className="card-title">Taak Details & Resultaten</h3>
                        {isJobRunning && !activeJobId && (
                            <div className="d-flex align-items-center">
                                <strong>Taak wordt uitgevoerd...</strong>
                                <div className="spinner-border ms-auto" role="status" aria-hidden="true"></div>
                            </div>
                        )}
                        {jobError && 
                            <div className="alert alert-danger mt-2" role="alert">
                                <strong>Fout:</strong> {jobError}
                            </div>
                        }
                        {currentJobResult && !isJobRunning && (
                            <div className="mt-2">
                                <p><strong>Status:</strong> {currentJobResult.message || currentJobResult.status}</p>
                                {currentJobResult.topic && (
                                    <p><strong>Onderwerp:</strong> {currentJobResult.topic}</p>
                                )}
                                {currentJobResult.start_time && (
                                    <p><strong>Gestart:</strong> {new Date(currentJobResult.start_time).toLocaleString()}</p>
                                )}
                                {currentJobResult.end_time && (
                                    <p><strong>Voltooid:</strong> {new Date(currentJobResult.end_time).toLocaleString()}</p>
                                )}
                                {currentJobResult.output_dir && 
                                    <p><small><strong>Output map:</strong> {currentJobResult.output_dir}</small></p>}
                                {currentJobResult.summary && (
                                    <div className="mt-3">
                                        <h5>Bronnen & Samenvatting:</h5>
                                        <div className="storm-results bg-light p-2 border rounded">
                                            {Array.isArray(currentJobResult.summary) ? (
                                                <div>
                                                    <p><strong>Gevonden bronnen: {currentJobResult.summary.length}</strong></p>
                                                    <ul>
                                                        {currentJobResult.summary.map((source, index) => (
                                                            <li key={index}>
                                                                <a href={source.url} target="_blank" rel="noopener noreferrer">
                                                                    {source.title}
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : (
                                                <pre>{typeof currentJobResult.summary === 'string' ? currentJobResult.summary : JSON.stringify(currentJobResult.summary, null, 2)}</pre>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {currentJobResult.article_content && (
                                    <div className="mt-3">
                                        <h5>Gegenereerd Artikel:</h5>
                                        <div className="storm-results bg-light p-3 border rounded" style={{textAlign: 'left'}}>
                                            <ReactMarkdown>{currentJobResult.article_content}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isJobRunning && !currentJobResult && !jobError && !showForm &&
                            <p className="text-muted">Selecteer een item uit de geschiedenis of start een nieuwe run.</p>
                        }
                    </div>
                </div>
            )}
            {!showForm && !currentJobResult && !jobError && !isJobRunning &&
                 <div className="text-center mt-5">
                     <h4>Welkom!</h4>
                     <p>Start een nieuwe Storm run of selecteer een item uit je geschiedenis.</p>
                 </div>
            }
        </div>
    );
}

export default MainContent; 