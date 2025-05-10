// API calls voor Storm (run, status, results)

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
const MOCK_API_CALLS = false; 

// Helper functie om de token uit localStorage te halen (of waar je het ook opslaat)
const getAuthToken = () => {
    const token = localStorage.getItem('authToken');
    // if (!token) console.warn("Auth token not found in localStorage.");
    return token;
};

const request = async (endpoint, options = {}, isFormData = false) => {
    const token = localStorage.getItem('authToken');
    const headers = { ...options.headers };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    const config = { ...options, headers };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { detail: await response.text() }; 
        }
        const error = new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        error.response = response;
        error.data = errorData;
        throw error;
    }
    if (response.status === 204) return null;
    // Check if response is JSON before trying to parse, for text/markdown
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    } else {
        return response.text(); // Return as text for non-JSON like markdown
    }
};

export const runStormJob = async (topic) => {
    if (MOCK_API_CALLS) {
        console.log("MOCK runStormJob: Called with topic:", topic);
        
        // Simuleer een API delay
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        // ---- PAS DEZE MOCK DATA AAN NAAR JE EIGEN TESTDATA ----
        // Lees idealiter de inhoud van een *daadwerkelijk* gegenereerd artikel
        // en een representatieve samenvatting.
        const mockArticleContent = 
`# Mock Artikel: ${topic}\n\nDit is een automatisch gegenereerd mock-artikel over het onderwerp "${topic}".\n\n## Sectie 1: Introductie\nIn deze sectie introduceren we het onderwerp en bespreken we de relevantie ervan.\n\n## Sectie 2: Kerndetails\n- Punt A\n- Punt B\n- Punt C\n\n## Sectie 3: Conclusie\nDe conclusie vat de belangrijkste bevindingen samen.\n\n*Dit artikel is gemockt en bevat geen echte Storm-gegenereerde inhoud.*`;
        
        const mockSummary = {
            status: "completed_mock",
            retrieved_urls: [
                "http://mockurl1.com/",
                "http://mockurl2.com/"
            ],
            key_points_from_research: [
                `Mocked key point 1 about ${topic}`, 
                `Mocked key point 2 about ${topic}`
            ],
            outline_generated: "Yes (mocked)",
            article_word_count: mockArticleContent.split(' ').length
        };
        
        const mockOutputDir = `/fake_output_dir/storm_output/${topic.replace(/\s+/g, '_').toLowerCase()}`;
        // ------------------------------------------------------

        console.log("MOCK runStormJob: Returning mock data.");
        return {
            message: `Mock Storm run voltooid voor topic '${topic}'. Dit is gesimuleerde data.`, 
            output_dir: mockOutputDir,
            summary: mockSummary,
            article_content: mockArticleContent
        };
    }
    return request('/storm/run', {
        method: 'POST',
        body: JSON.stringify({ topic }),
    });
};

export const getStormJobStatus = async (jobId) => {
    if (MOCK_API_CALLS) {
        console.log("MOCK getStormJobStatus: Called with jobId:", jobId);
        
        // Simuleer een API delay
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        console.log("MOCK getStormJobStatus: Returning mock data.");
        return { status: "simulated_pending_check", message: "Status check (getStormJobStatus) niet volledig geïmplementeerd." };
    }
    return request(`/storm/status/${jobId}`);
};

export const getStormRunHistory = async (skip = 0, limit = 20) => {
    if (MOCK_API_CALLS) {
        console.log("MOCK getStormRunHistory: Called with skip:", skip, "and limit:", limit);
        
        // Simuleer een API delay
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        console.log("MOCK getStormRunHistory: Returning mock data.");
        return Promise.resolve([]);
    }
    return request(`/storm/history?skip=${skip}&limit=${limit}`);
};

export const getStormRunSummary = async (jobId) => {
    if (MOCK_API_CALLS) {
        console.log("MOCK getStormRunSummary: Called with jobId:", jobId);
        
        // Simuleer een API delay
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        console.log("MOCK getStormRunSummary: Returning mock data.");
        return Promise.resolve({});
    }
    return request(`/storm/results/${jobId}/summary`);
};

export const getStormRunArticleContent = async (jobId) => {
    if (MOCK_API_CALLS) {
        console.log("MOCK getStormRunArticleContent: Called with jobId:", jobId);
        
        // Simuleer een API delay
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        console.log("MOCK getStormRunArticleContent: Returning mock data.");
        return Promise.resolve("");
    }
    // This request helper now handles text response, so direct call is fine.
    return request(`/storm/results/${jobId}/article`);
}; 