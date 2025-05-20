const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'; // Gebruik env var, fallback naar /api als veilig default

export async function fetchWithAuth(url, options = {}, logoutAction = null) {
    const token = localStorage.getItem('authToken');
    console.log("fetchWithAuth: Using token:", token ? token.substring(0, 10) + '...' : 'null or empty');
    const headers = {
        ...options.headers,
        'Authorization': token ? `Bearer ${token}` : ''
    };

    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if ((options.method === 'GET' || !options.body) && !options.headers?.['Content-Type']) {
        delete headers['Content-Type'];
    }

    const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });

    if (response.status === 401) {
        localStorage.removeItem('authToken');
        if (logoutAction) {
            console.log("fetchWithAuth: Detected 401, calling logoutAction.");
            logoutAction();
        } else {
            console.warn("fetchWithAuth: logoutAction not provided, cannot perform clean logout.");
        }
        throw new Error('Unauthorized');
    }

    const contentType = response.headers.get('content-type');
    console.log(`fetchWithAuth for ${url}: Content-Type: ${contentType}, Status: ${response.status}`);

    if (!response.ok && response.status !== 204) { 
        const errorData = await response.json().catch(() => ({ detail: `Failed to fetch with status ${response.status}` }));
        console.error('API Error:', errorData);
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null; 
    }

    if (contentType && (contentType.includes('text/plain') || contentType.includes('text/markdown'))) {
        console.log(`fetchWithAuth for ${url}: Returning as text.`);
        return await response.text();
    }
    
    console.log(`fetchWithAuth for ${url}: Attempting to parse as JSON.`);
    try {
        return await response.json(); 
    } catch (e) {
        console.error(`fetchWithAuth for ${url}: Failed to parse JSON. Content-Type was ${contentType}. Error:`, e);
        const textBody = await response.text().catch(() => "Could not read response body as text.");
        console.error("Response body (text fallback):", textBody.substring(0, 500));
        throw new Error(`Failed to parse JSON from ${url}. Server responded with Content-Type: ${contentType} but body was not valid JSON. Check console for text fallback.`);
    }
} 