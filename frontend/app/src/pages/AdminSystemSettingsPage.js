import React, { useState, useEffect, useCallback } from 'react';
import { getSystemConfiguration, updateSystemConfiguration } from '../services/adminService';
// import { useAuth } from '../../contexts/AuthContext'; // Alleen nodig als je logoutAction expliciet wilt callen

const AdminSystemSettingsPage = () => {
    // const { logoutAction } = useAuth(); // Haal logoutAction op als je die wilt gebruiken bij 401/403
    const [config, setConfig] = useState({
        small_model_name: '',
        large_model_name: '',
        small_model_name_azure: '',
        large_model_name_azure: '',
        azure_api_base: '',
        openai_api_base: '',
        openai_api_key: '',
        openai_api_type: '',
        azure_api_version: '',
        tavily_api_key: '',
    });
    const [initialConfig, setInitialConfig] = useState(null); // Om updated_at te bewaren
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const fetchConfig = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const response = await getSystemConfiguration();
            if (response.config) {
                setConfig({
                    small_model_name: response.config.small_model_name || '',
                    large_model_name: response.config.large_model_name || '',
                    small_model_name_azure: response.config.small_model_name_azure || '',
                    large_model_name_azure: response.config.large_model_name_azure || '',
                    azure_api_base: response.config.azure_api_base || '',
                    openai_api_base: response.config.openai_api_base || '',
                    openai_api_key: response.config.openai_api_key || '',
                    openai_api_type: response.config.openai_api_type || '',
                    azure_api_version: response.config.azure_api_version || '',
                    tavily_api_key: response.config.tavily_api_key || '',
                });
                setInitialConfig(response.config); // Bewaar de hele config inclusief id en updated_at
            } else {
                // Geen config in DB, laad defaults (lege strings zijn al ingesteld)
                setInitialConfig(null);
            }
        } catch (err) {
            console.error("Failed to fetch system configuration:", err);
            setError(err.message || 'Kon configuratie niet laden.');
            // if (err.message === 'Unauthorized') { /* logoutAction(); */ }
        } finally {
            setIsLoading(false);
        }
    }, []); // logoutAction toevoegen als dependency als je het gebruikt

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        // Stuur alleen waarden die niet leeg zijn, of stuur ze als null als ze leeg zijn
        // De backend CRUD zal de bestaande waarde behouden als een veld niet wordt meegestuurd (exclude_unset)
        // Om een waarde te *verwijderen* zodat de Pydantic default wordt gebruikt, moet de backend
        // expliciet `None` accepteren en de DB kolom op NULL zetten.
        // Voor nu sturen we de waarden zoals ze zijn; lege strings worden lege strings in DB.
        const payload = {};
        for (const key in config) {
            if (config[key] !== '') {
                payload[key] = config[key];
            } else {
                // Als je een leeg veld als NULL wilt sturen (om fallback naar Pydantic default te triggeren)
                // payload[key] = null; 
                // Anders, als je lege strings wilt opslaan, of de backend `None` niet als reset ziet:
                payload[key] = ''; // of laat weg als de backend dat beter afhandelt
            }
        }

        try {
            const response = await updateSystemConfiguration(payload);
            if (response.config) {
                setConfig({
                    small_model_name: response.config.small_model_name || '',
                    large_model_name: response.config.large_model_name || '',
                    small_model_name_azure: response.config.small_model_name_azure || '',
                    large_model_name_azure: response.config.large_model_name_azure || '',
                    azure_api_base: response.config.azure_api_base || '',
                    openai_api_base: response.config.openai_api_base || '',
                    openai_api_key: response.config.openai_api_key || '',
                    openai_api_type: response.config.openai_api_type || '',
                    azure_api_version: response.config.azure_api_version || '',
                    tavily_api_key: response.config.tavily_api_key || '',
                });
                setInitialConfig(response.config);
            }
            setSuccessMessage('Instellingen succesvol opgeslagen!');
        } catch (err) {
            console.error("Failed to update system configuration:", err);
            setError(err.message || 'Kon instellingen niet opslaan.');
            // if (err.message === 'Unauthorized') { /* logoutAction(); */ }
        } finally {
            setIsSaving(false);
            setTimeout(() => setSuccessMessage(null), 5000); // Verberg succesbericht na 5s
        }
    };

    if (isLoading) {
        return <div className="container mt-5 text-center"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Laden...</span></div><p>Configuratie laden...</p></div>;
    }

    return (
        <div className="container mt-4">
            <h2>Systeeminstellingen voor LLM & API</h2>
            <p className="text-muted">Beheer hier de modelnamen en API-eindpunten die door het systeem worden gebruikt. Lege velden vallen terug op de standaardwaarden uit de omgevingsconfiguratie van de backend.</p>
            
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {successMessage && <div className="alert alert-success" role="alert">{successMessage}</div>}

            <form onSubmit={handleSubmit}>
                <fieldset className="mb-3 p-3 border rounded">
                    <legend className="h5">Globale LLM Instellingen</legend>
                    <div className="mb-3">
                        <label htmlFor="openai_api_key" className="form-label">OpenAI API Key (basis)</label>
                        <input type="password" className="form-control" id="openai_api_key" name="openai_api_key" value={config.openai_api_key} onChange={handleChange} placeholder="Laat leeg voor backend default (.env)" />
                        <small className="form-text text-muted">Wordt gebruikt voor OpenAI of als basis voor Azure.</small>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="openai_api_type" className="form-label">OpenAI API Type</label>
                        <select className="form-select" id="openai_api_type" name="openai_api_type" value={config.openai_api_type} onChange={handleChange}>
                            <option value="">Laat leeg voor backend default (.env)</option>
                            <option value="openai">OpenAI</option>
                            <option value="azure">Azure OpenAI</option>
                        </select>
                    </div>
                </fieldset>

                <fieldset className="mb-3 p-3 border rounded">
                    <legend className="h5">OpenAI (Standaard)</legend>
                    <div className="mb-3">
                        <label htmlFor="small_model_name" className="form-label">Naam Klein Model (bv. gpt-3.5-turbo)</label>
                        <input type="text" className="form-control" id="small_model_name" name="small_model_name" value={config.small_model_name} onChange={handleChange} placeholder="Laat leeg voor backend default" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="large_model_name" className="form-label">Naam Groot Model (bv. gpt-4o)</label>
                        <input type="text" className="form-control" id="large_model_name" name="large_model_name" value={config.large_model_name} onChange={handleChange} placeholder="Laat leeg voor backend default" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="openai_api_base" className="form-label">OpenAI API Base URL (optioneel)</label>
                        <input type="text" className="form-control" id="openai_api_base" name="openai_api_base" value={config.openai_api_base} onChange={handleChange} placeholder="Laat leeg voor standaard OpenAI endpoint" />
                    </div>
                </fieldset>

                <fieldset className="mb-3 p-3 border rounded">
                    <legend className="h5">Azure OpenAI</legend>
                    <div className="mb-3">
                        <label htmlFor="small_model_name_azure" className="form-label">Deployment Naam Klein Model</label>
                        <input type="text" className="form-control" id="small_model_name_azure" name="small_model_name_azure" value={config.small_model_name_azure} onChange={handleChange} placeholder="Laat leeg voor backend default" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="large_model_name_azure" className="form-label">Deployment Naam Groot Model</label>
                        <input type="text" className="form-control" id="large_model_name_azure" name="large_model_name_azure" value={config.large_model_name_azure} onChange={handleChange} placeholder="Laat leeg voor backend default" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="azure_api_base" className="form-label">Azure API Base URL</label>
                        <input type="text" className="form-control" id="azure_api_base" name="azure_api_base" value={config.azure_api_base} onChange={handleChange} placeholder="Laat leeg voor backend default" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="azure_api_version" className="form-label">Azure API Version (bv. 2023-07-01-preview)</label>
                        <input type="text" className="form-control" id="azure_api_version" name="azure_api_version" value={config.azure_api_version} onChange={handleChange} placeholder="Laat leeg voor backend default (.env)" />
                    </div>
                </fieldset>
                
                <fieldset className="mb-3 p-3 border rounded">
                    <legend className="h5">Retriever API Keys</legend>
                    <div className="mb-3">
                        <label htmlFor="tavily_api_key" className="form-label">Tavily API Key</label>
                        <input type="password" className="form-control" id="tavily_api_key" name="tavily_api_key" value={config.tavily_api_key} onChange={handleChange} placeholder="Laat leeg voor backend default (.env)" />
                    </div>
                    {/* Voeg hier indien nodig inputs toe voor andere retriever keys zoals YDC_API_KEY, BING_SEARCH_API_KEY etc. */}
                </fieldset>

                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    {isSaving ? (
                        <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Opslaan...</>
                    ) : (
                        'Instellingen Opslaan'
                    )}
                </button>
                {initialConfig && initialConfig.updated_at && (
                    <p className="mt-3 text-muted small">
                        Laatst opgeslagen: {new Date(initialConfig.updated_at).toLocaleString()}
                    </p>
                )}
            </form>
        </div>
    );
};

export default AdminSystemSettingsPage; 