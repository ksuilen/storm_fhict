import React from 'react';

function Sidebar({ runHistory, onViewHistoryItem, onNewRun, selectedRunId }) {
    return (
        <div className="d-flex flex-column p-3 bg-light h-100"> {/* h-100 om de hoogte van parent te nemen */}
            <button className="btn btn-primary mb-3 w-100" onClick={onNewRun}>
                + Nieuwe Storm Run
            </button>
            <h6 className="sidebar-heading d-flex justify-content-between align-items-center px-1 mt-1 mb-1 text-muted">
                <span>Run Geschiedenis</span>
            </h6>
            {runHistory.length > 0 ? (
                <ul className="list-unstyled ps-0 mb-auto overflow-auto">
                    {runHistory.map(run => (
                        <li key={run.id} className="mb-2">
                            <a  
                                href="#" 
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    onViewHistoryItem(run);
                                }}
                                className={`d-block p-2 border rounded text-decoration-none text-dark ${selectedRunId === run.id ? 'bg-primary text-white shadow-sm' : 'bg-white'}`} 
                                title={`Status: ${run.status} - ${new Date(run.timestamp).toLocaleDateString()}`}
                                style={{transition: 'background-color 0.15s ease-in-out'}}
                            >
                                <div className="d-flex w-100 align-items-center justify-content-between mb-1">
                                    <span className="fw-bold text-truncate" style={{maxWidth: '160px'}}>{run.topic}</span>
                                    <small 
                                        className={`badge rounded-pill ms-1 ${selectedRunId === run.id ? (run.status === 'Mislukt' ? 'bg-danger-subtle text-danger-emphasis' : (run.status === 'Voltooid' ? 'bg-success-subtle text-success-emphasis' : 'bg-secondary-subtle text-secondary-emphasis')) : (run.status === 'Mislukt' ? 'bg-danger text-white' : (run.status === 'Voltooid' ? 'bg-success text-white' : 'bg-secondary text-white'))}
                                    `}>
                                        {run.status}
                                    </small>
                                </div>
                                <div className="small text-muted text-truncate" style={{fontSize: '0.8em'}}>{new Date(run.timestamp).toLocaleString()}</div>
                            </a>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted small px-1">Nog geen runs in de geschiedenis.</p>
            )}
            {/* Je kunt hier later nog user info of settings link toevoegen */}
        </div>
    );
}

export default Sidebar; 