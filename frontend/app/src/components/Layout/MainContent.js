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
                        <h3 className="card-title">Start a new Storm Run</h3>
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
                        <h3 className="card-title">Task Details & Results</h3>
                        {isJobRunning && !activeJobId && (
                            <div className="d-flex align-items-center">
                                <strong>Task is running...</strong>
                                <div className="spinner-border ms-auto" role="status" aria-hidden="true"></div>
                            </div>
                        )}
                        {isJobRunning && activeJobId && (
                            <div className="alert alert-info mb-3">
                                ⏱️ <strong>STORM run is running...</strong> This process takes approximately 2-3 minutes. You can follow the progress live below.
                            </div>
                        )}
                        {jobError && 
                            <div className="alert alert-danger mt-2" role="alert">
                                <strong>Error:</strong> {jobError}
                            </div>
                        }
                        {currentJobResult && !isJobRunning && (
                            <div className="mt-2">
                                <p><strong>Status:</strong> {currentJobResult.message || currentJobResult.status}</p>
                                {currentJobResult.topic && (
                                    <p><strong>Topic:</strong> {currentJobResult.topic}</p>
                                )}
                                {currentJobResult.start_time && (
                                    <p><strong>Started:</strong> {new Date(currentJobResult.start_time).toLocaleString()}</p>
                                )}
                                {currentJobResult.end_time && (
                                    <p><strong>Completed:</strong> {new Date(currentJobResult.end_time).toLocaleString()}</p>
                                )}
                                {currentJobResult.output_dir && 
                                    <p><small><strong>Output directory:</strong> {currentJobResult.output_dir}</small></p>}
                                {currentJobResult.summary && (
                                    <div className="mt-3">
                                        <h5>Sources & Summary:</h5>
                                        <div className="storm-results bg-light p-2 border rounded">
                                            {Array.isArray(currentJobResult.summary) ? (
                                                <div>
                                                    <p><strong>Found sources: {currentJobResult.summary.length}</strong></p>
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
                                        <h5>Generated Article:</h5>
                                        <div className="storm-results bg-light p-3 border rounded" style={{textAlign: 'left'}}>
                                            <ReactMarkdown>{currentJobResult.article_content}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isJobRunning && !currentJobResult && !jobError && !showForm &&
                            <p className="text-muted">Select a task from history or start a new run.</p>
                        }
                    </div>
                </div>
            )}
            {!showForm && !currentJobResult && !jobError && !isJobRunning &&
                 <div className="text-center mt-5">
                     <h4>Welcome!</h4>
                     <p>Start a new Storm run or select a task from your history.</p>
                 </div>
            }
        </div>
    );
}

export default MainContent; 