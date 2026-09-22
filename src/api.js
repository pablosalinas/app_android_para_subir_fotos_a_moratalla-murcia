import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

let apiURL = '';
let basicAuth = '';

export const initApi = async () => {
    const { value: url } = await Preferences.get({ key: 'apiUrl' });
    const { value: auth } = await Preferences.get({ key: 'basicAuth' });
    
    apiURL = url || '';
    basicAuth = auth || '';
};

export const setApiConfig = async (url) => {
    // Ensure URL doesn't end with slash
    const cleanUrl = url.replace(/\/$/, '');
    await Preferences.set({ key: 'apiUrl', value: cleanUrl });
    apiURL = cleanUrl;
};

export const setCredentials = async (username, password) => {
    const auth = btoa(`${username}:${password}`);
    await Preferences.set({ key: 'basicAuth', value: auth });
    basicAuth = auth;
};

export const clearCredentials = async () => {
    await Preferences.remove({ key: 'basicAuth' });
    basicAuth = '';
};

export const getApiUrl = () => apiURL;
export const getBasicAuth = () => basicAuth;

const request = async (action, method = 'GET', data = null, isFormData = false) => {
    if (!apiURL) throw new Error('API URL not configured');
    
    const headers = {
        'Authorization': `Basic ${basicAuth}`,
    };
    
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        method,
        url: `${apiURL}/api_app.php?action=${action}`,
        headers,
    };

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error("API Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || 'Error de conexión');
    }
};

export const login = async (username, password) => {
    const auth = btoa(`${username}:${password}`);
    try {
        const response = await axios.post(`${apiURL}/api_app.php?action=login`, null, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });
        await setCredentials(username, password);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error || 'Login fallido');
    }
};

export const getNews = () => request('news');
export const toggleNews = (id, is_active) => request('toggle_news', 'POST', { id, is_active });
export const getMedia = (news_id) => request(`media&news_id=${news_id}`);
export const deleteMedia = (media_id) => request(`media&id=${media_id}`, 'DELETE');
export const updateMediaCaption = (id, caption) => request('media', 'PUT', { id, caption });

export const uploadMedia = (news_id, file) => {
    const formData = new FormData();
    formData.append('news_id', news_id);
    formData.append('file', file);
    return request('media', 'POST', formData, true);
};
