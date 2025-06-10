import React, { useState, useEffect, useRef } from 'react';
import { fetchWithAuth } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import './StormStatusTracker.css';

const StormStatusTracker = ({ runId, isCompleted, onComplete, onError }) => {
  // DEBUG: Log component initialization
  console.log('🔍 DEBUG: StormStatusTracker component initialized with runId:', runId, 'isCompleted:', isCompleted);
  
  const { logout } = useAuth();
  const [status, setStatus] = useState({
    phase: isCompleted ? 'completed' : 'connecting',
    status: 'info',
    message: isCompleted ? 'Loading historical progress...' : 'Connecting to STORM updates...',
    progress: isCompleted ? 100 : 0,
    details: {},
    isConnected: false,
    isComplete: isCompleted
  });
  
  const [updates, setUpdates] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 5;
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const loadHistoricalProgress = async () => {
    if (!runId || !isCompleted) return;
    
    setIsLoadingHistory(true);
    try {
      console.log('🔍 DEBUG: Loading historical progress for completed run:', runId);
      
      const progressData = await fetchWithAuth(`/v1/storm/progress/${runId}`, {
        method: 'GET'
      }, logout);
      
      console.log('🔍 DEBUG: Historical progress data loaded:', progressData);
      
      if (progressData && progressData.length > 0) {
        // Convert timestamps and set updates
        const formattedUpdates = progressData.map(update => ({
          ...update,
          timestamp: new Date(update.timestamp)
        }));
        
        setUpdates(formattedUpdates);
        
        // Set final status from last update
        const lastUpdate = formattedUpdates[formattedUpdates.length - 1];
        setStatus(prev => ({
          ...prev,
          phase: lastUpdate.phase || 'completed',
          status: lastUpdate.status || 'success',
          message: lastUpdate.message || 'Run completed successfully',
          progress: lastUpdate.progress || 100,
          details: lastUpdate.details || {},
          isConnected: false, // Not connected for historical data
          isComplete: true
        }));
        
        console.log('🔍 DEBUG: Historical progress loaded successfully');
      } else {
        console.log('🔍 DEBUG: No historical progress data found');
        setStatus(prev => ({
          ...prev,
          message: 'No detailed progress history available for this run',
          isConnected: false,
          isComplete: true
        }));
      }
    } catch (error) {
      console.error('🔍 DEBUG: Error loading historical progress:', error);
      setConnectionError('Failed to load progress history');
      setStatus(prev => ({
        ...prev,
        message: 'Error loading progress history',
        isConnected: false,
        isComplete: true
      }));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const connectWebSocket = () => {
    if (!runId) {
      console.log('🔍 DEBUG: No runId provided, skipping WebSocket connection');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/storm/${runId}`;
    
    console.log(`🔍 DEBUG: Connecting to WebSocket: ${wsUrl}`);
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('🔍 DEBUG: WebSocket connected successfully');
        setConnectionError(null);
        setReconnectAttempts(0);
        setStatus(prev => ({
          ...prev,
          isConnected: true,
          phase: 'connected',
          message: '🔗 Connected to STORM progress updates'
        }));
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🔍 DEBUG: WebSocket message received:', data);
          
          // Update current status
          setStatus(prev => ({
            ...prev,
            phase: data.phase || prev.phase,
            status: data.status || prev.status,
            message: data.message || prev.message,
            progress: data.progress || prev.progress,
            details: data.details || prev.details,
            isComplete: data.phase === 'completed'
          }));
          
          // Add to updates history
          setUpdates(prev => [...prev, {
            ...data,
            timestamp: new Date(data.timestamp || Date.now())
          }]);
          
          // Handle completion
          if (data.phase === 'completed' && onComplete) {
            console.log('🔍 DEBUG: STORM run completed, calling onComplete callback');
            onComplete(data);
          }
          
        } catch (error) {
          console.error('🔍 DEBUG: Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = (event) => {
        console.log('🔍 DEBUG: WebSocket closed:', event.code, event.reason);
        setStatus(prev => ({ ...prev, isConnected: false }));
        
        // Attempt reconnection if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          console.log(`🔍 DEBUG: Attempting reconnection in ${timeout}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, timeout);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.log('🔍 DEBUG: Max reconnection attempts reached');
          setConnectionError('Failed to maintain connection after multiple attempts');
          if (onError) onError('Connection failed');
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('🔍 DEBUG: WebSocket error:', error);
        setConnectionError('WebSocket connection error');
        if (onError) onError('WebSocket error');
      };
      
    } catch (error) {
      console.error('🔍 DEBUG: Failed to create WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
      if (onError) onError('Connection setup failed');
    }
  };

  useEffect(() => {
    console.log('🔍 DEBUG: StormStatusTracker useEffect triggered with runId:', runId, 'isCompleted:', isCompleted);
    
    if (isCompleted) {
      // For completed runs, load historical progress data
      loadHistoricalProgress();
    } else {
      // For active runs, connect to WebSocket
      connectWebSocket();
    }
    
    // Cleanup on unmount
    return () => {
      console.log('🔍 DEBUG: StormStatusTracker cleanup - closing WebSocket');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [runId, isCompleted]);

  const getPhaseIcon = (phase) => {
    switch (phase) {
      case 'connecting':
      case 'connected':
        return '🔗';
      case 'research_planning':
        return '🔍';
      case 'research_execution':
        return '🌐';
      case 'outline_generation':
        return '📋';
      case 'article_generation':
        return '✍️';
      case 'completed':
        return '🎉';
      default:
        return '⚙️';
    }
  };

  const getPhaseTitle = (phase) => {
    switch (phase) {
      case 'connecting':
        return 'Connecting';
      case 'connected':
        return 'Connected';
      case 'research_planning':
        return 'Research Planning';
      case 'research_execution':
        return 'Web Research';
      case 'outline_generation':
        return 'Outline Generation';
      case 'article_generation':
        return 'Article Generation';
      case 'completed':
        return 'Completed';
      default:
        return 'Processing';
    }
  };

  const getStatusClass = (statusType) => {
    switch (statusType) {
      case 'success':
        return 'status-success';
      case 'error':
        return 'status-error';
      case 'warning':
        return 'status-warning';
      default:
        return 'status-info';
    }
  };

  return (
    <div className="storm-status-tracker">
      <div className="status-header">
        <h3>STORM Progress</h3>
        <div className={`connection-indicator ${status.isConnected ? 'connected' : (isCompleted ? 'completed' : 'disconnected')}`}>
          {isCompleted ? '📋 Historical Data' : (status.isConnected ? '🟢 Connected' : '🔴 Disconnected')}
        </div>
      </div>

      {!isCompleted && (
        <div className="status-message status-info">
          ⏱️ <strong>Estimated duration:</strong> 2-3 minutes • You can follow the progress live
        </div>
      )}

      {connectionError && (
        <div className="connection-error">
          ⚠️ {connectionError}
          {reconnectAttempts < maxReconnectAttempts && (
            <span> (Reconnecting... {reconnectAttempts}/{maxReconnectAttempts})</span>
          )}
        </div>
      )}

      {isLoadingHistory && (
        <div className="loading-history">
          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
          Loading progress history...
        </div>
      )}

      <div className="current-status">
        <div className="status-main">
          <div className="phase-info">
            <span className="phase-icon">{getPhaseIcon(status.phase)}</span>
            <span className="phase-title">{getPhaseTitle(status.phase)}</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${status.progress}%` }}
            ></div>
            <span className="progress-text">{status.progress}%</span>
          </div>
        </div>
        
        <div className={`status-message ${getStatusClass(status.status)}`}>
          {status.message}
        </div>

        {status.details && Object.keys(status.details).length > 0 && (
          <div className="status-details">
            {status.details.perspectives && (
              <div className="detail-item">
                <strong>Research Perspectives:</strong> {status.details.perspectives.join(', ')}
              </div>
            )}
            {status.details.dialogue_number && (
              <div className="detail-item">
                <strong>Research Question {status.details.dialogue_number}:</strong> {status.details.question}
              </div>
            )}
            {status.details.sources_found && (
              <div className="detail-item">
                <strong>Sources Found:</strong> {status.details.sources_found}
                {status.details.total_sources_so_far && (
                  <span> (Total: {status.details.total_sources_so_far})</span>
                )}
              </div>
            )}
            {status.details.top_sources && (
              <div className="detail-item">
                <strong>Top Sources:</strong>
                <ul className="sources-list">
                  {status.details.top_sources.map((source, index) => (
                    <li key={index}>
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.domain}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {status.details.section_count && (
              <div className="detail-item">
                <strong>Outline Sections:</strong> {status.details.section_count}
                {status.details.subsection_count && (
                  <span> ({status.details.subsection_count} subsections)</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Research Questions Section */}
      <div className="research-questions-section">
        <h4>Research Questions</h4>
        <div className="research-questions-list">
          {updates
            .filter(update => update.message.includes('Research question'))
            .map((update, index) => (
              <div key={index} className="research-question-item">
                <div className="question-time">
                  {update.timestamp.toLocaleTimeString()}
                </div>
                <div className="question-text">
                  {getPhaseIcon(update.phase)} {update.message}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Progress Updates Accordion */}
      <div className="progress-accordion">
        <details>
          <summary>
            <h4>All Progress Updates ({updates.length})</h4>
          </summary>
          <div className="updates-list">
            {updates.slice().reverse().map((update, index) => (
              <div key={index} className={`update-item ${getStatusClass(update.status)}`}>
                <div className="update-time">
                  {update.timestamp.toLocaleTimeString()}
                </div>
                <div className="update-message">
                  {getPhaseIcon(update.phase)} {update.message}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};

export default StormStatusTracker; 