import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

// Definición de las webs soportadas por la app
export const SITES = [
    { id: 'moratalla', name: 'Moratalla', watermarkText: 'www.moratalla-murcia.com', logoUrl: '/logos/moratalla.jpg' },
    { id: 'banda', name: 'Banda de Música Moratalla', watermarkText: 'www.bandamusicamoratalla.com', logoUrl: '/logos/banda.jpg' },
];

const STORAGE_KEY = 'siteConfigs';
const ACTIVE_KEY = 'activeSite';
const authKey = (siteId) => `auth_${siteId}`;

// siteConfigs: { [siteId]: { url: string } } — solo la URL, no es un dato sensible.
// Las credenciales (usuario:contraseña en base64) se guardan aparte, cifradas,
// en el almacén seguro del sistema (Keystore en Android), nunca en texto plano.
let siteConfigs = {};
let siteAuth = {};
let activeSite = null;

export const initApi = async () => {
    const { value: raw } = await Preferences.get({ key: STORAGE_KEY });
    siteConfigs = raw ? JSON.parse(raw) : {};

    siteAuth = {};
    for (const site of SITES) {
        try {
            const { value } = await SecureStoragePlugin.get({ key: authKey(site.id) });
            if (value) siteAuth[site.id] = value;
        } catch (e) {
            // No hay credenciales guardadas todavía para esta web; es normal.
        }
    }

    const { value: active } = await Preferences.get({ key: ACTIVE_KEY });
    activeSite = active || null;
};

const persistConfigs = async () => {
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(siteConfigs) });
};

export const getSiteConfig = (siteId) => ({
    url: siteConfigs[siteId]?.url || '',
    auth: siteAuth[siteId] || '',
});

export const setSiteUrl = async (siteId, url) => {
    const cleanUrl = url.replace(/\/$/, '');
    siteConfigs[siteId] = { ...siteConfigs[siteId], url: cleanUrl };
    await persistConfigs();
};

export const setSiteCredentials = async (siteId, username, password) => {
    const auth = btoa(`${username}:${password}`);
    siteAuth[siteId] = auth;
    await SecureStoragePlugin.set({ key: authKey(siteId), value: auth });
};

export const clearSiteCredentials = async (siteId) => {
    delete siteAuth[siteId];
    try {
        await SecureStoragePlugin.remove({ key: authKey(siteId) });
    } catch (e) {
        // Ya estaba vacío
    }
};

export const setActiveSite = async (siteId) => {
    activeSite = siteId;
    await Preferences.set({ key: ACTIVE_KEY, value: siteId });
};

export const getActiveSite = () => activeSite;
export const getActiveSiteConfig = () => getSiteConfig(activeSite);
export const getActiveSiteMeta = () => SITES.find(s => s.id === activeSite);

const request = async (action, method = 'GET', data = null, isFormData = false) => {
    const { url: apiURL, auth: basicAuth } = getActiveSiteConfig();
    if (!apiURL) throw new Error('API URL no configurada para esta web');

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

export const login = async (siteId, username, password) => {
    const { url: apiURL } = getSiteConfig(siteId);
    if (!apiURL) throw new Error('Configura primero la URL de esta web');
    const auth = btoa(`${username}:${password}`);
    try {
        const response = await axios.post(`${apiURL}/api_app.php?action=login`, null, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });
        await setSiteCredentials(siteId, username, password);
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
