import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import * as stormService from '../services/stormService';
import './HowToUsePage.css';

const HowToUsePage = () => {
    const { user, getRemainingRuns } = useAuth();
    const remainingRuns = getRemainingRuns();
    const [runHistory, setRunHistory] = useState([]);

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

    const handleViewHistoryItem = (run) => {
        // Redirect to dashboard with the selected run
        window.location.href = `/dashboard`;
    };

    const handleNewRun = () => {
        // Redirect to dashboard for new run
        window.location.href = '/dashboard';
    };

    if (!user) {
        return <div className="container text-center mt-5"><p>Loading user data or not logged in...</p><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>; 
    }

    return (
        <div className="dashboard-container row g-0 flex-grow-1">
            <div className="sidebar col-md-4 col-lg-3 border-end bg-light p-3" style={{ overflowY: 'auto' }}>
                <Sidebar 
                    runHistory={runHistory} 
                    onViewHistoryItem={handleViewHistoryItem} 
                    onNewRun={handleNewRun} 
                    selectedRunId={null}
                />
            </div>
            <div className="main-content col-md-8 col-lg-9 p-4" style={{ overflowY: 'auto' }}>
                <div className="how-to-use-content">
                    <div className="hero-section">
                        <div className="hero-content">
                            <h1 className="hero-title">
                                <span className="storm-logo">🌪️</span>
                                Welcome to STORM
                            </h1>
                            <p className="hero-subtitle">
                                <strong>S</strong>ynthesis of <strong>T</strong>opic <strong>O</strong>utlines through <strong>R</strong>etrieval and <strong>M</strong>ulti-perspective Question Asking
                            </p>
                            <div className="hero-description">
                                <p>STORM is an AI-powered research assistant that automatically generates comprehensive, Wikipedia-style articles from scratch. It conducts internet research, asks intelligent questions from multiple perspectives, and creates well-structured articles with proper citations.</p>
                            </div>
                        </div>
                    </div>

                    <div className="content-sections">
                        {/* Quick Start Section */}
                        <section className="content-section">
                            <h2>🚀 Quick Start</h2>
                            <div className="quick-start-grid">
                                <div className="quick-start-card">
                                    <div className="step-number">1</div>
                                    <h3>Choose Your Topic</h3>
                                    <p>Enter a research topic you want to explore. Be specific but not too narrow.</p>
                                    <div className="example-box">
                                        <strong>Good examples:</strong>
                                        <ul>
                                            <li>"Design thinking methodology"</li>
                                            <li>"Renewable energy in developing countries"</li>
                                            <li>"Machine learning in healthcare"</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className="quick-start-card">
                                    <div className="step-number">2</div>
                                    <h3>Start Research</h3>
                                    <p>Click "Start New Research" and watch STORM work its magic in real-time.</p>
                                    <div className="alert alert-info small mb-2">
                                        ⏱️ <strong>Takes 2-3 minutes</strong> - You can follow the progress live
                                    </div>
                                    <div className="process-preview">
                                        <div className="process-step">🔍 Research Planning</div>
                                        <div className="process-step">🌐 Web Research</div>
                                        <div className="process-step">📋 Outline Generation</div>
                                        <div className="process-step">📝 Article Writing</div>
                                    </div>
                                </div>
                                <div className="quick-start-card">
                                    <div className="step-number">3</div>
                                    <h3>Review Results</h3>
                                    <p>Get a comprehensive article with research questions, sources, and citations.</p>
                                    <div className="results-preview">
                                        <span className="result-item">📄 Full Article</span>
                                        <span className="result-item">🔍 Research Questions</span>
                                        <span className="result-item">📚 Sources & Citations</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Your Account Section */}
                        <section className="content-section account-info">
                            <h2>👤 Your Account</h2>
                            <div className="account-details">
                                <div className="account-card">
                                    <h3>Research Credits</h3>
                                    <div className="credits-display">
                                        <span className="credits-number">{remainingRuns}</span>
                                        <span className="credits-label">runs remaining</span>
                                    </div>
                                    <p className="credits-note">
                                        Each research run typically takes 2-3 minutes and consumes 1 credit. 
                                        Use them wisely for topics you're genuinely interested in exploring!
                                    </p>
                                </div>
                                <div className="account-card">
                                    <h3>Research Quality</h3>
                                    <p>Each STORM run:</p>
                                    <ul>
                                        <li><strong>Duration:</strong> 2-3 minutes with live progress tracking</li>
                                        <li>Asks 8-15 research questions</li>
                                        <li>Consults 50-150 web sources</li>
                                        <li>Generates 1,000-3,000 word articles</li>
                                        <li>Provides proper citations and references</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* How STORM Works */}
                        <section className="content-section">
                            <h2>🧠 How STORM Works</h2>
                            <div className="storm-process">
                                <div className="process-phase">
                                    <div className="phase-header">
                                        <span className="phase-icon">🔍</span>
                                        <h3>Research Planning</h3>
                                    </div>
                                    <p>STORM identifies different perspectives on your topic by analyzing similar subjects and discovering various viewpoints that should be explored.</p>
                                </div>
                                
                                <div className="process-phase">
                                    <div className="phase-header">
                                        <span className="phase-icon">🌐</span>
                                        <h3>Web Research</h3>
                                    </div>
                                    <p>The system conducts intelligent web searches, asking follow-up questions and simulating conversations between a researcher and topic expert to gather comprehensive information.</p>
                                </div>
                                
                                <div className="process-phase">
                                    <div className="phase-header">
                                        <span className="phase-icon">📋</span>
                                        <h3>Outline Generation</h3>
                                    </div>
                                    <p>All collected information is organized into a hierarchical outline, structuring the knowledge into logical sections and subsections.</p>
                                </div>
                                
                                <div className="process-phase">
                                    <div className="phase-header">
                                        <span className="phase-icon">📝</span>
                                        <h3>Article Writing</h3>
                                    </div>
                                    <p>Using the outline and research, STORM generates a comprehensive article with proper citations, following Wikipedia-style formatting and structure.</p>
                                </div>
                            </div>
                        </section>

                        {/* Best Practices */}
                        <section className="content-section">
                            <h2>💡 Best Practices</h2>
                            <div className="best-practices-grid">
                                <div className="practice-card do">
                                    <h3>✅ Do</h3>
                                    <ul>
                                        <li><strong>Be specific:</strong> "AI in medical diagnosis" vs "AI"</li>
                                        <li><strong>Use established topics:</strong> Subjects with existing research</li>
                                        <li><strong>Think encyclopedic:</strong> Topics suitable for Wikipedia</li>
                                        <li><strong>Allow time:</strong> Each run takes 2-3 minutes</li>
                                        <li><strong>Review research questions:</strong> They show STORM's approach</li>
                                    </ul>
                                </div>
                                <div className="practice-card dont">
                                    <h3>❌ Don't</h3>
                                    <ul>
                                        <li><strong>Too broad:</strong> "Technology" or "History"</li>
                                        <li><strong>Too narrow:</strong> "My personal experience with..."</li>
                                        <li><strong>Current events:</strong> Very recent news (last few days)</li>
                                        <li><strong>Personal opinions:</strong> "Why X is better than Y"</li>
                                        <li><strong>Waste credits:</strong> Test topics or duplicates</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Topic Examples */}
                        <section className="content-section">
                            <h2>📚 Topic Examples</h2>
                            <div className="topic-examples">
                                <div className="topic-category">
                                    <h3>🔬 Science & Technology</h3>
                                    <div className="topic-tags">
                                        <span className="topic-tag">Quantum computing applications</span>
                                        <span className="topic-tag">CRISPR gene editing</span>
                                        <span className="topic-tag">Renewable energy storage</span>
                                        <span className="topic-tag">Machine learning ethics</span>
                                    </div>
                                </div>
                                <div className="topic-category">
                                    <h3>🏛️ History & Society</h3>
                                    <div className="topic-tags">
                                        <span className="topic-tag">Digital transformation in education</span>
                                        <span className="topic-tag">Urban planning sustainability</span>
                                        <span className="topic-tag">Remote work culture impact</span>
                                        <span className="topic-tag">Social media psychology</span>
                                    </div>
                                </div>
                                <div className="topic-category">
                                    <h3>💼 Business & Economics</h3>
                                    <div className="topic-tags">
                                        <span className="topic-tag">Circular economy principles</span>
                                        <span className="topic-tag">Cryptocurrency regulation</span>
                                        <span className="topic-tag">Supply chain resilience</span>
                                        <span className="topic-tag">ESG investing trends</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Technical Details */}
                        <section className="content-section technical-section">
                            <h2>⚙️ Technical Details</h2>
                            <div className="technical-grid">
                                <div className="tech-card">
                                    <h3>🤖 AI Models</h3>
                                    <p>STORM uses advanced language models for different tasks:</p>
                                    <ul>
                                        <li><strong>Research:</strong> Efficient models for question generation</li>
                                        <li><strong>Writing:</strong> Powerful models for article creation</li>
                                        <li><strong>Quality:</strong> Optimized for accuracy and citations</li>
                                    </ul>
                                </div>
                                <div className="tech-card">
                                    <h3>🔍 Search Integration</h3>
                                    <p>Multiple search engines provide comprehensive coverage:</p>
                                    <ul>
                                        <li>Web search for current information</li>
                                        <li>Academic sources when available</li>
                                        <li>Fact-checking and verification</li>
                                    </ul>
                                </div>
                                <div className="tech-card">
                                    <h3>📊 Research Process</h3>
                                    <p>Systematic approach ensures quality:</p>
                                    <ul>
                                        <li>Multi-perspective question asking</li>
                                        <li>Iterative information gathering</li>
                                        <li>Source verification and citation</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Getting Started CTA */}
                        <section className="content-section cta-section">
                            <div className="cta-content">
                                <h2>Ready to Start Researching?</h2>
                                <p>You have <strong>{remainingRuns} research credits</strong> available. Choose a topic that interests you and let STORM create a comprehensive research article!</p>
                                <div className="cta-buttons">
                                    <button onClick={handleNewRun} className="btn btn-primary btn-lg">
                                        🚀 Start New Research
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowToUsePage; 