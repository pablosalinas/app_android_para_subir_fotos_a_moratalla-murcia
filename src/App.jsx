import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Settings, LogIn, Image as ImageIcon, Video, Trash2, ArrowLeft, Plus, RefreshCw, Eye, EyeOff, Save, Check, FileText, ChevronRight, Repeat } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  SITES,
  initApi,
  getSiteConfig,
  setSiteUrl,
  login,
  getNews,
  toggleNews,
  getMedia,
  deleteMedia,
  uploadMedia,
  updateMediaCaption,
  getActiveSite,
  getActiveSiteConfig,
  getActiveSiteMeta,
  setActiveSite,
  clearSiteCredentials,
} from './api';
import { applyImageWatermark } from './watermark';
import { processVideo } from './videoProcessor';
import './index.css';

const Loader = ({ message = "Cargando..." }) => (
  <div className="loader-overlay">
    <div className="spinner"></div>
    <div style={{ fontWeight: 600 }}>{message}</div>
  </div>
);

const SitePickerScreen = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState({});

  useEffect(() => {
    const map = {};
    SITES.forEach(s => { map[s.id] = getSiteConfig(s.id); });
    setConfigs(map);
  }, []);

  const handleSelect = async (siteId) => {
    await setActiveSite(siteId);
    const cfg = getSiteConfig(siteId);
    if (!cfg.url) navigate(`/config/${siteId}`);
    else if (!cfg.auth) navigate(`/login/${siteId}`);
    else navigate('/news');
  };

  return (
    <div className="animate-fade-in" style={{ padding: 20, paddingTop: 60 }}>
      <div className="card text-center mb-4">
        <h2 style={{ marginBottom: 8 }}>¿A qué web quieres subir contenido?</h2>
        <p className="text-muted text-sm">Elige el sitio de destino</p>
      </div>

      {SITES.map(site => {
        const cfg = configs[site.id] || {};
        const status = !cfg.url ? 'Sin configurar' : !cfg.auth ? 'Configurada, falta iniciar sesión' : 'Lista';
        return (
          <div key={site.id} className="list-item" onClick={() => handleSelect(site.id)} style={{ marginBottom: 12, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: '0 0 4px' }}>{site.name}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{status}</div>
              </div>
              <ChevronRight color="var(--text-muted)" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ConfigScreen = () => {
  const { siteId } = useParams();
  const site = SITES.find(s => s.id === siteId);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setUrl(getSiteConfig(siteId).url || '');
  }, [siteId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    await setSiteUrl(siteId, url);
    setLoading(false);
    navigate(`/login/${siteId}`);
  };

  return (
    <div className="animate-fade-in" style={{ padding: 20, paddingTop: 60 }}>
      {loading && <Loader message="Guardando configuración..." />}
      <div className="card text-center mb-4">
        <Settings size={48} color="var(--primary)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ marginBottom: 8 }}>Configuración — {site?.name}</h2>
        <p className="text-muted text-sm">Introduce la URL del servidor de esta web (ej. https://{site?.watermarkText?.replace('www.', '')})</p>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: 24 }}>
          <input 
            type="url" 
            className="input-field" 
            placeholder="URL del Servidor" 
            value={url} 
            onChange={e => setUrl(e.target.value)} 
            required 
          />
        </div>
        <button type="submit" className="btn btn-primary">Guardar y Continuar</button>
      </form>
    </div>
  );
};

const LoginScreen = () => {
  const { siteId } = useParams();
  const site = SITES.find(s => s.id === siteId);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!getSiteConfig(siteId).url) {
      navigate(`/config/${siteId}`);
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await login(siteId, user, pass);
      await setActiveSite(siteId);
      navigate('/news');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: 20, paddingTop: 60 }}>
      {loading && <Loader message="Autenticando..." />}
      <div className="card text-center mb-4">
        <div style={{ position: 'absolute', top: 20, right: 20, cursor: 'pointer' }} onClick={() => navigate(`/config/${siteId}`)}>
          <Settings size={24} color="var(--text-muted)" />
        </div>
        <LogIn size={48} color="var(--primary)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ marginBottom: 8 }}>Admin Login — {site?.name}</h2>
        <p className="text-muted text-sm">Inicia sesión con tu cuenta de administrador de esta web.</p>
      </div>

      {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: 16, borderRadius: 12, marginBottom: 24, textAlign: 'center' }}>{error}</div>}

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Usuario" 
            value={user} 
            onChange={e => setUser(e.target.value)} 
            required 
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <input 
            type="password" 
            className="input-field" 
            placeholder="Contraseña" 
            value={pass} 
            onChange={e => setPass(e.target.value)} 
            required 
          />
        </div>
        <button type="submit" className="btn btn-primary">Entrar</button>
      </form>
    </div>
  );
};

const NewsScreen = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadNews = async () => {
    setLoading(true);
    try {
      const res = await getNews();
      if (res.success) setNews(res.news);
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('Credenciales')) {
        navigate('/login');
      } else {
        alert(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNews(); }, []);

  const handleToggle = async (item) => {
    const newVal = item.is_active_home ? 0 : 1;
    setNews(news.map(n => n.id === item.id ? { ...n, is_active_home: newVal, is_active_category: newVal } : n));
    try {
      await toggleNews(item.id, newVal);
    } catch (err) {
      alert("Error al cambiar visibilidad");
      loadNews(); // revert
    }
  };

  const logout = async () => {
    await clearSiteCredentials(getActiveSite());
    navigate('/');
  };

  const switchSite = () => navigate('/');
  const siteMeta = getActiveSiteMeta();

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <div className="header-title">Noticias</div>
          {siteMeta && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{siteMeta.name}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Repeat size={22} onClick={switchSite} color="var(--text-muted)" title="Cambiar web" />
          <RefreshCw size={24} onClick={loadNews} color="var(--primary)" />
          <LogIn size={24} onClick={logout} color="var(--text-muted)" style={{ transform: 'rotate(180deg)' }} />
        </div>
      </div>
      
      <div style={{ padding: 16 }}>
        {loading && !news.length ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>Cargando noticias...</div>
        ) : (
          news.map(item => (
            <div key={item.id} className="list-item" onClick={(e) => {
              if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'SPAN') {
                navigate(`/media/${item.id}`, { state: { newsTitle: item.title } });
              }
            }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0 }}>
                  {item.image_path ? (
                    <img src={`${getApiUrl()}/${item.image_path}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <ImageIcon color="var(--text-muted)" />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {item.event_date ? new Date(item.event_date).toLocaleDateString() : 'Sin fecha'}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="switch">
                    <input type="checkbox" checked={!!item.is_active_home} onChange={() => handleToggle(item)} />
                    <span className="slider"></span>
                  </label>
                  <span style={{ fontSize: '0.85rem', color: item.is_active_home ? 'var(--success)' : 'var(--text-muted)' }}>
                    {item.is_active_home ? 'Visible en Web' : 'Oculta'}
                  </span>
                </div>
                <div className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', borderRadius: 8 }}>
                  Ver Galería
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const MediaScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [stepMessage, setStepMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const fileInputRef = useRef(null);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const res = await getMedia(id);
      if (res.success) setMedia(res.media);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMedia(); }, [id]);

  const handleDelete = async (mediaId) => {
    if (!window.confirm('¿Seguro que deseas eliminar este archivo?')) return;
    try {
      await deleteMedia(mediaId);
      setMedia(media.filter(m => m.id !== mediaId));
    } catch (err) {
      alert("Error al borrar");
    }
  };

  const handleSaveCaption = async (mediaId) => {
    try {
      await updateMediaCaption(mediaId, editCaption);
      setMedia(media.map(m => m.id === mediaId ? { ...m, caption: editCaption } : m));
      setEditingId(null);
    } catch (err) {
      alert("Error al guardar descripción");
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const siteMeta = getActiveSiteMeta();
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    const failed = [];
    const newItems = [];

    // Se procesan uno a uno para no saturar el servidor y poder mostrar progreso real
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      const original = files[i];
      let toUpload = original;

      try {
        if (original.type.startsWith('image/') && siteMeta) {
          setStepMessage('Aplicando marca de agua...');
          toUpload = await applyImageWatermark(original, siteMeta.watermarkText, siteMeta.logoUrl);
        } else if (original.type.startsWith('video/') && siteMeta) {
          setStepMessage('Comprimiendo vídeo 0%...');
          toUpload = await processVideo(original, siteMeta.watermarkText, siteMeta.logoUrl, (ratio) => {
            setStepMessage(`Comprimiendo vídeo ${Math.round(ratio * 100)}%...`);
          });
        }

        setStepMessage('Subiendo al servidor...');
        const res = await uploadMedia(id, toUpload);
        if (res.success) newItems.push(res.media);
      } catch (err) {
        failed.push(original.name);
      }
    }
    setStepMessage('');

    if (newItems.length) setMedia(prev => [...prev, ...newItems]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (failed.length) {
      alert(`No se pudieron subir ${failed.length} archivo(s): ${failed.join(', ')}`);
    }
  };

  return (
    <div className="animate-fade-in">
      {uploading && (
        <Loader message={
          (uploadProgress.total > 1 ? `Archivo ${uploadProgress.current} de ${uploadProgress.total} — ` : '') +
          (stepMessage || 'Procesando...')
        } />
      )}
      
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ArrowLeft size={24} onClick={() => navigate('/news')} style={{ cursor: 'pointer' }} />
          <div className="header-title">Galería</div>
        </div>
        <div className="btn btn-primary" style={{ width: 'auto', padding: '6px 12px', borderRadius: 20 }} onClick={handleUploadClick}>
          <Plus size={18} /> Añadir
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
        />
      </div>

      <div style={{ padding: 16 }}>
        {loading && !media.length ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>Cargando galería...</div>
        ) : media.length === 0 ? (
          <div className="card text-center" style={{ marginTop: 20 }}>
            <ImageIcon size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)' }}>No hay imágenes ni vídeos en esta noticia.</p>
            <button className="btn btn-primary mt-4" onClick={handleUploadClick}>Subir el primero</button>
          </div>
        ) : (
          <div className="media-grid">
            {media.map(item => {
              const isPdf = item.image_path && item.image_path.toLowerCase().endsWith('.pdf');
              return (
              <div key={item.id} className="media-item">
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', padding: 4, borderRadius: 6, zIndex: 10 }}>
                  {item.is_video ? <Video size={16} color="white" /> : isPdf ? <FileText size={16} color="white" /> : <ImageIcon size={16} color="white" />}
                </div>
                
                {item.is_video ? (
                  <video src={`${getApiUrl()}/${item.image_path}`} controls style={{ width: '100%', height: 120, objectFit: 'cover', background: '#000' }} />
                ) : isPdf ? (
                  <div onClick={() => window.open(`${getApiUrl()}/${item.image_path}`, '_blank')} style={{ cursor: 'pointer', width: '100%', height: 120, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                     <FileText size={32} color="#ef4444" opacity={0.8} />
                     <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px', fontWeight: 'bold' }}>PDF (Tocar para ver)</div>
                  </div>
                ) : (
                  <img src={`${getApiUrl()}/${item.image_path}`} onClick={() => window.open(`${getApiUrl()}/${item.image_path}`, '_blank')} style={{ cursor: 'pointer' }} />
                )}
                
                <div className="media-actions">
                  {editingId === item.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input 
                        type="text" 
                        value={editCaption} 
                        onChange={e => setEditCaption(e.target.value)} 
                        style={{ width: '100%', padding: 4, fontSize: '0.75rem', borderRadius: 4, border: 'none', background: 'white', color: 'black' }}
                        autoFocus
                      />
                      <div onClick={() => handleSaveCaption(item.id)} style={{ background: 'var(--success)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                        <Check size={14} color="white" />
                      </div>
                    </div>
                  ) : (
                    <div 
                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 4 }}
                      onClick={() => { setEditingId(item.id); setEditCaption(item.caption || ''); }}
                    >
                      {item.caption || 'Sin descripción (Tocar)'}
                    </div>
                  )}
                  
                  <div className="btn btn-danger" style={{ padding: '6px', fontSize: '0.8rem', borderRadius: 6 }} onClick={() => handleDelete(item.id)}>
                    <Trash2 size={14} /> Borrar
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
};

const AppRoot = () => {
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    initApi().then(() => setInitDone(true));
  }, []);

  if (!initDone) return <Loader message="Iniciando..." />;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<SitePickerScreen />} />
        <Route path="/config/:siteId" element={<ConfigScreen />} />
        <Route path="/login/:siteId" element={<LoginScreen />} />
        <Route path="/news" element={getActiveSite() ? <NewsScreen /> : <Navigate to="/" />} />
        <Route path="/media/:id" element={getActiveSite() ? <MediaScreen /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default AppRoot;
