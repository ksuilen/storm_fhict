import React from 'react';
import StormRunnerForm from '../Storm/StormRunnerForm';
import ReactMarkdown from 'react-markdown';

function MainContent({ 
    currentJobResult, 
    jobError, 
    isJobRunning, 
    onJobStarted, 
    onJobError, 
    onSubmitting,
    showForm, // Nieuwe prop om formulier te tonen/verbergen
}) {
    return (
        <div className="flex-grow-1 p-4 h-100">
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

            {(currentJobResult || jobError || isJobRunning) && (
                 <div className="card">
                    <div className="card-body">
                        <h3 className="card-title">Taak Details & Resultaten</h3>
                        {isJobRunning && (
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
                                <p><strong>Status:</strong> {currentJobResult.message}</p>
                                {currentJobResult.output_dir && 
                                    <p><small><strong>Output map:</strong> {currentJobResult.output_dir}</small></p>}
                                {currentJobResult.summary && (
                                    <div className="mt-3">
                                        <h5>Samenvatting:</h5>
                                        <pre className="storm-results bg-light p-2 border rounded">{typeof currentJobResult.summary === 'string' ? currentJobResult.summary : JSON.stringify(currentJobResult.summary, null, 2)}</pre>
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