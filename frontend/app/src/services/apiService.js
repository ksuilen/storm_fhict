// For development, use proxy directly without full URL; for production use env var or /api default
const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? '/api'  // Use proxy in development
    : (process.env.REACT_APP_API_URL || '/api'); // Use env var in production

const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Fetches data with authorization headers and handles common API responses.
 * @param {string} url The URL to fetch.
 * @param {object} options The options for the fetch call.
 * @param {function} [logoutAction] Optional function to call on 401 Unauthorized.
 * @returns {Promise<any>} The JSON response from the API.
 */
export const fetchWithAuth = async (url, options = {}, logoutAction = null) => {
    const defaultHeaders = {
        'Accept': 'application/json',
        // 'Content-Type' is set conditionally below
    };

    const requestOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...getAuthHeaders(),
            ...options.headers, // Allow overriding default headers
        },
    };

    // Set Content-Type to application/json by default if body exists and is not FormData or URLSearchParams
    if (requestOptions.body && 
        !(requestOptions.body instanceof FormData) && 
        !(requestOptions.body instanceof URLSearchParams) && 
        !requestOptions.headers['Content-Type']) {
        requestOptions.headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, requestOptions);

        if (response.status === 401) {
            console.warn("Unauthorized (401) response from API.");
            if (logoutAction && typeof logoutAction === 'function') {
                console.log("Performing logout action due to 401.");
                logoutAction();
            } else {
                console.warn('fetchWithAuth: logoutAction not provided or not a function, cannot perform clean logout.');
            }
            // Throw an error that can be caught by the caller to handle UI updates (e.g., redirect)
            // Include a message that helps identify it as an auth error.
            const errorData = await response.json().catch(() => ({ detail: "Unauthorized" }));
            throw new Error(errorData.detail || "Unauthorized access. Please log in again.");
        }

        if (!response.ok) {
            let errorBody = { detail: `API Error: ${response.statusText}` }; // Default error
            try {
                errorBody = await response.json();
            } catch (e) {
                // If response is not JSON, use the default error or statusText
                console.warn("API response was not valid JSON for error.");
            }
            
            let errorMessage = "An unknown error occurred";
            if (errorBody.detail && Array.isArray(errorBody.detail)) { // FastAPI validation errors
                errorMessage = errorBody.detail.map(err => `${err.loc.join(' -> ')} - ${err.msg}`).join("; ");
            } else if (errorBody.detail) {
                errorMessage = errorBody.detail;
            } else if (typeof errorBody === 'string') {
                errorMessage = errorBody;
            }
            console.error('API Error:', errorMessage);
            throw new Error(errorMessage);
        }

        // Handle cases where response might be empty (e.g., 204 No Content)
        if (response.status === 204) {
            return null; // Or an appropriate representation of no content
        }

        // Check Content-Type header to decide how to parse the response
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await response.json();
        } else if (contentType && (contentType.includes("text/plain") || contentType.includes("text/markdown"))) {
            return await response.text();
        } else {
            // Fallback or error for unexpected content types, or assume JSON if no content-type
            console.warn(`Unexpected content-type: ${contentType}. Attempting to parse as JSON.`);
            return await response.json(); // Or handle as an error, or return response.blob() for other types
        }

    } catch (error) {
        // Re-throw the error so it can be caught by the calling function
        // This ensures that component-level error handling can take place
        console.error("Error in fetchWithAuth:", error.message);
        throw error; // Make sure to re-throw the original error object if it's already an Error instance
    }
}; 