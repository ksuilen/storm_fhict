import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import MainContent from '../components/Layout/MainContent';
import * as stormService from '../services/stormService';

const POLLING_INTERVAL = 5000;

function DashboardPage() {
    const { user } = useAuth();
    const [currentJobDetails, setCurrentJobDetails] = useState(null);
    const [jobError, setJobError] = useState(null);
    const [isJobRunning, setIsJobRunning] = useState(false);
    const [runHistory, setRunHistory] = useState([]);
    const [showFormInMain, setShowFormInMain] = useState(true);
    const [selectedHistoryItemId, setSelectedHistoryItemId] = useState(null);
    const [activeJobId, setActiveJobId] = useState(null);

    const pollingIntervalRef = useRef(null);

    const fetchRunHistory = useCallback(async () => {
        if (!user) return;
        try {
            const history = await stormService.getStormRunHistory();
            setRunHistory(history || []); 
        } catch (error) {
            console.error("Failed to fetch run history:", error);
            setRunHistory([]);
        }
    }, [user]);

    useEffect(() => {
        fetchRunHistory();
    }, [fetchRunHistory]);

    const pollJobStatus = useCallback(async (jobId) => {
        try {
            const statusResult = await stormService.getStormJobStatus(jobId);
            const existingContent = currentJobDetails?.job_id === statusResult.job_id 
                ? { summary: currentJobDetails.summary, article_content: currentJobDetails.article_content }
                : {}; 
            setCurrentJobDetails({ ...statusResult, ...existingContent });
            setJobError(null);

            if (statusResult.status === 'running' || statusResult.status === 'pending') {
                setIsJobRunning(true);
                setShowFormInMain(false);
            } else if (statusResult.status === 'completed') {
                setIsJobRunning(false);
                setActiveJobId(null); 
                setShowFormInMain(false);
                fetchRunHistory(); 
                try {
                    const summary = await stormService.getStormRunSummary(jobId);
                    const article = await stormService.getStormRunArticleContent(jobId);
                    setCurrentJobDetails(prevDetails => ({ ...prevDetails, summary, article_content: article }));
                } catch (contentError) {
                    console.error(`Error fetching content for completed job ${jobId}:`, contentError);
                    setJobError(prevError => prevError ? `${prevError}\nFailed to load content: ${contentError.message}` : `Failed to load content: ${contentError.message}`);
                }
            } else if (statusResult.status === 'failed') {
                setIsJobRunning(false);
                setActiveJobId(null); 
                setJobError(statusResult.error_message || 'Job failed with an unknown error.');
                setShowFormInMain(false);
                fetchRunHistory(); 
            } else {
                setIsJobRunning(false);
                setActiveJobId(null);
            }
        } catch (error) {
            console.error(`Error polling job status for ${jobId}:`, error);
            setJobError(`Failed to get job status: ${error.message}`);
            setIsJobRunning(false);
            setActiveJobId(null);
        }
    }, [fetchRunHistory, currentJobDetails]);

    useEffect(() => {
        if (activeJobId) {
            pollJobStatus(activeJobId);
            pollingIntervalRef.current = setInterval(() => pollJobStatus(activeJobId), POLLING_INTERVAL);
        } else {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        }
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [activeJobId, pollJobStatus]);

    const handleJobSubmitting = () => {
        setIsJobRunning(true);
        setJobError(null); 
        setCurrentJobDetails(null);
        setShowFormInMain(false);
        setSelectedHistoryItemId(null);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setActiveJobId(null);
    };

    const handleJobInitiated = (initiatedJob) => {
        setCurrentJobDetails(initiatedJob);
        setJobError(null);
        setShowFormInMain(false);
        setActiveJobId(initiatedJob.job_id);
        setSelectedHistoryItemId(null);
    };

    const handleJobSubmissionError = (errorMessage) => {
        setJobError(errorMessage);
        setCurrentJobDetails(null);
        setIsJobRunning(false);
        setActiveJobId(null);
        setShowFormInMain(true);
        setSelectedHistoryItemId(null);
    };
    
    const handleViewHistoryItem = async (run) => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setActiveJobId(null);
        setIsJobRunning(false);

        const initialDetails = {
            job_id: run.id,
            topic: run.topic,
            status: run.status,
            start_time: run.start_time,
            end_time: run.end_time,
            output_dir: run.output_dir,
            error_message: run.error_message,
            summary: run.status === 'completed' ? "Laden..." : null,
            article_content: run.status === 'completed' ? "Laden..." : null
        };
        setCurrentJobDetails(initialDetails);
        setJobError(run.error_message || null);
        setShowFormInMain(false);
        setSelectedHistoryItemId(run.id); 

        if (run.status === 'running' || run.status === 'pending') {
            setActiveJobId(run.id); 
        } else if (run.status === 'completed') {
            try {
                const summary = await stormService.getStormRunSummary(run.id);
                const article = await stormService.getStormRunArticleContent(run.id);
                setCurrentJobDetails(prevDetails => ({ ...prevDetails, summary, article_content: article }));
            } catch (contentError) {
                console.error(`Error fetching content for history job ${run.id}:`, contentError);
                setCurrentJobDetails(prevDetails => ({
                     ...prevDetails, 
                     summary: "Kon samenvatting niet laden.", 
                     article_content: "Kon artikel niet laden."
                }));
                setJobError(prevError => prevError ? `${prevError}\nFailed to load content: ${contentError.message}` : `Failed to load content: ${contentError.message}`);
            }
        }
    };

    const handleNewRun = () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setActiveJobId(null);
        setCurrentJobDetails(null);
        setJobError(null);
        setIsJobRunning(false);
        setShowFormInMain(true); 
        setSelectedHistoryItemId(null); 
    };

    if (!user) {
        return <div className="container text-center mt-5"><p>Gebruikersdata laden of niet ingelogd...</p><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>; 
    }

    return (
        <div className="dashboard-layout">
            <div className="sidebar-container">
                <Sidebar 
                    runHistory={runHistory} 
                    onViewHistoryItem={handleViewHistoryItem} 
                    onNewRun={handleNewRun} 
                    selectedRunId={selectedHistoryItemId}
                />
            </div>
            <div className="main-content-container">
                <MainContent 
                    currentJobResult={currentJobDetails}
                    jobError={jobError}
                    isJobRunning={isJobRunning}
                    onJobInitiated={handleJobInitiated}
                    onJobSubmissionError={handleJobSubmissionError}
                    onSubmitting={handleJobSubmitting}
                    showForm={showFormInMain}
                    activeJobId={activeJobId}
                />
            </div>
        </div>
    );
}

export default DashboardPage; 