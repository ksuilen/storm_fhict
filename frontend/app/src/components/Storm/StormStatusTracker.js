import React, { useState, useEffect, useRef } from 'react';
import './StormStatusTracker.css';

const StormStatusTracker = ({ runId, onComplete, onError }) => {
  // DEBUG: Log component initialization
  console.log('🔍 DEBUG: StormStatusTracker component initialized with runId:', runId);
  
  const [status, setStatus] = useState({
    phase: 'connecting',
    status: 'info',
    message: 'Connecting to STORM updates...',
    progress: 0,
    details: {},
    isConnected: false,
    isComplete: false
  });
  
  const [updates, setUpdates] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 5;
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

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
    console.log('🔍 DEBUG: StormStatusTracker useEffect triggered with runId:', runId);
    connectWebSocket();
    
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
  }, [runId]);

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
        <div className={`connection-indicator ${status.isConnected ? 'connected' : 'disconnected'}`}>
          {status.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      {connectionError && (
        <div className="connection-error">
          ⚠️ {connectionError}
          {reconnectAttempts < maxReconnectAttempts && (
            <span> (Reconnecting... {reconnectAttempts}/{maxReconnectAttempts})</span>
          )}
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

      <div className="updates-history">
        <h4>Progress Updates</h4>
        <div className="updates-list">
          {updates.slice(-10).reverse().map((update, index) => (
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
      </div>
    </div>
  );
};

export default StormStatusTracker; 