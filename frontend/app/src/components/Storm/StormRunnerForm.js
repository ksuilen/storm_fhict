import React, { useState } from 'react';
import * as stormService from '../../services/stormService';

function StormRunnerForm({ onJobStarted, onJobError, onSubmitting }) {
    const [topic, setTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (onSubmitting) onSubmitting();
        setIsLoading(true);
        if (onJobError) onJobError(null);

        try {
            const params = {
                do_research: true,
                do_generate_outline: true,
                do_generate_article: true,
                do_polish_article: true,
            };
            const result = await stormService.runStormJob(topic, params);
            if (onJobStarted) onJobStarted(result);
            setTopic('');
        } catch (err) {
            console.error("Storm job submission failed:", err);
            if (onJobError) onJobError(err.message || 'Failed to start Storm job.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="mb-3">
                <label htmlFor="storm-topic" className="form-label">Topic:</label>
                <input 
                    type="text" 
                    className="form-control"
                    id="storm-topic"
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)} 
                    required 
                    disabled={isLoading}
                    placeholder="e.g. 'Machine learning in healthcare'"
                />
                <div className="form-text">
                    💡 <strong>Tip:</strong> A STORM run takes approximately 2-3 minutes. Choose a specific but not too narrow topic for best results.
                </div>
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
                {isLoading ? (
                    <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        <span className="ms-1">Starting...</span>
                    </>
                ) : 'Start Storm Run'}
            </button>
            {isLoading && (
                <div className="mt-2 text-center">
                    <small className="text-muted">
                        ⏱️ This process takes approximately 2-3 minutes. You can follow the progress live.
                    </small>
                </div>
            )}
        </form>
    );
}

export default StormRunnerForm; 