import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { Settings, LogIn, Image as ImageIcon, Video, Trash2, ArrowLeft, Plus, RefreshCw, Eye, EyeOff, Save, Check, FileText, ChevronRight, Repeat, User, Star, Edit3, X, Search, UploadCloud } from 'lucide-react';
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
  getPages,
  togglePage,
  getPageMedia,
  deletePageMedia,
  updatePageMediaCaption,
  uploadPageMedia,
  setMainImageFromFile,
  setMainImageFromMedia,
  updateNewsAuthor,
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
  const [modalTarget, setModalTarget] = useState(null); // Noticia seleccionada para cambiar portada/autor
  const [modalAuthor, setModalAuthor] = useState('');
  const [modalFile, setModalFile] = useState(null);
  const [modalPreview, setModalPreview] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const mainFileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const siteMeta = getActiveSiteMeta();
  const isMoratalla = siteMeta?.id === 'moratalla';
  const [currentTab, setCurrentTab] = useState(location.state?.tab || 'news');
  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  const loadPages = async () => {
    if (!isMoratalla) return;
    setLoadingPages(true);
    try {
      const res = await getPages();
      if (res.success) setPages(res.pages || []);
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('Credenciales')) {
        navigate('/login');
      } else {
        alert(err.message);
      }
    } finally {
      setLoadingPages(false);
    }
  };

  useEffect(() => { loadNews(); }, []);

  useEffect(() => {
    if (isMoratalla && currentTab === 'pages') {
      loadPages();
    }
  }, [currentTab, isMoratalla]);

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

  const handleTogglePage = async (page) => {
    const newVal = page.is_visible ? 0 : 1;
    setPages(pages.map(p => p.id === page.id ? { ...p, is_visible: newVal } : p));
    try {
      await togglePage(page.id, newVal);
    } catch (err) {
      alert("Error al cambiar visibilidad de la página");
      loadPages();
    }
  };

  const filteredPages = pages.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (p.title || '').toLowerCase().includes(term) || (p.category_name || '').toLowerCase().includes(term);
  });

  const openMainImageModal = (item, e) => {
    e.stopPropagation();
    setModalTarget(item);
    setModalAuthor(item.image_author || '');
    setModalFile(null);
    setModalPreview(null);
  };

  const handleMainFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModalFile(file);
    const reader = new FileReader();
    reader.onload = () => setModalPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSaveMainImage = async () => {
    if (!modalTarget) return;
    setModalSaving(true);
    const siteMeta = getActiveSiteMeta();
    try {
      let finalFile = modalFile;
      if (modalFile) {
        if (modalFile.type.startsWith('image/') && siteMeta) {
          try {
            finalFile = await applyImageWatermark(modalFile, siteMeta.watermarkText, siteMeta.logoUrl);
          } catch (e) {
            console.warn('Fallo marca de agua portada, usando original', e);
          }
        }
        await setMainImageFromFile(modalTarget.id, finalFile, modalAuthor);
      } else {
        // Solo actualizar el autor de la noticia
        await updateNewsAuthor(modalTarget.id, modalAuthor);
      }
      setModalTarget(null);
      await loadNews();
    } catch (err) {
      alert("Error al guardar imagen principal/autor: " + (err.message || 'Error desconocido'));
    } finally {
      setModalSaving(false);
    }
  };

  const logout = async () => {
    await clearSiteCredentials(getActiveSite());
    navigate('/');
  };

  const switchSite = () => navigate('/');

  return (
    <div className="animate-fade-in">
      {modalSaving && <Loader message="Guardando imagen principal..." />}

      {/* Modal para asignar o cambiar Imagen Principal y Autor */}
      {modalTarget && (
        <div className="loader-overlay" style={{ padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, background: 'var(--bg-card)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Imagen principal y Autor</h3>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setModalTarget(null)} />
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
              <strong>Noticia:</strong> {modalTarget.title}
            </p>

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div 
                onClick={() => mainFileInputRef.current?.click()}
                style={{ 
                  width: '100%', 
                  height: 160, 
                  borderRadius: 12, 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '2px dashed rgba(255,255,255,0.2)',
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {modalPreview ? (
                  <img src={modalPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : modalTarget.image_path ? (
                  <img src={`${getActiveSiteConfig().url}/${modalTarget.image_path}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <ImageIcon size={36} color="var(--primary)" style={{ marginBottom: 8 }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toca para seleccionar foto de portada</span>
                  </>
                )}
                <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem' }}>
                  {modalPreview || modalTarget.image_path ? 'Cambiar foto' : 'Subir foto'}
                </div>
              </div>
              <input 
                type="file" 
                ref={mainFileInputRef} 
                style={{ display: 'none' }} 
                accept="image/*" 
                onChange={handleMainFileSelect} 
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Autor/a de la fotografía:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <User size={16} color="var(--primary)" />
                <input 
                  type="text" 
                  value={modalAuthor} 
                  onChange={e => setModalAuthor(e.target.value)}
                  placeholder="Ej. Juan Pérez / Banda de Música" 
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '8px 0', outline: 'none', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setModalTarget(null)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveMainImage} style={{ flex: 2 }}>
                <Save size={16} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="header">
        <div>
          <div className="header-title">{isMoratalla && currentTab === 'pages' ? 'Páginas' : 'Noticias'}</div>
          {siteMeta && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{siteMeta.name}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Repeat size={22} onClick={switchSite} color="var(--text-muted)" title="Cambiar web" style={{ cursor: 'pointer' }} />
          <RefreshCw size={24} onClick={isMoratalla && currentTab === 'pages' ? loadPages : loadNews} color="var(--primary)" style={{ cursor: 'pointer' }} />
          <LogIn size={24} onClick={logout} color="var(--text-muted)" style={{ transform: 'rotate(180deg)', cursor: 'pointer' }} />
        </div>
      </div>

      {isMoratalla && (
        <div className="tabs-container">
          <button 
            type="button"
            className={`tab-btn ${currentTab === 'news' ? 'active' : ''}`}
            onClick={() => setCurrentTab('news')}
          >
            <ImageIcon size={15} /> Noticias y Eventos
          </button>
          <button 
            type="button"
            className={`tab-btn ${currentTab === 'pages' ? 'active' : ''}`}
            onClick={() => setCurrentTab('pages')}
          >
            <FileText size={15} /> Páginas
          </button>
        </div>
      )}
      
      {isMoratalla && currentTab === 'pages' ? (
        <div style={{ padding: '0 0 16px' }}>
          <div className="search-box">
            <Search size={18} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Buscar página por título o categoría..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <X size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => setSearchTerm('')} />
            )}
          </div>

          <div style={{ padding: '0 16px' }}>
            {loadingPages && !pages.length ? (
              <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>Cargando páginas...</div>
            ) : filteredPages.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>
                {searchTerm ? 'No se encontraron páginas con ese término.' : 'No hay páginas registradas.'}
              </div>
            ) : (
              filteredPages.map(page => (
                <div 
                  key={page.id} 
                  className="list-item" 
                  onClick={(e) => {
                    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SPAN' && !e.target.closest('button')) {
                      navigate(`/page-media/${page.id}`, { state: { pageTitle: page.title, isPage: true } });
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div 
                      style={{ 
                        width: 68, 
                        height: 68, 
                        borderRadius: 10, 
                        background: 'rgba(255,255,255,0.06)', 
                        overflow: 'hidden', 
                        flexShrink: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.08)' 
                      }}
                    >
                      {page.cover_image ? (
                        <img src={`${getActiveSiteConfig().url}/${page.cover_image}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <FileText size={26} color="var(--primary)" opacity={0.6} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {page.title}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.78rem' }}>
                        <span className="badge" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8' }}>
                          {page.category_name || 'General'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label className="switch">
                        <input type="checkbox" checked={!!page.is_visible} onChange={() => handleTogglePage(page)} />
                        <span className="slider"></span>
                      </label>
                      <span style={{ fontSize: '0.82rem', color: page.is_visible ? 'var(--success)' : 'var(--text-muted)' }}>
                        {page.is_visible ? 'Visible en Web' : 'Oculta'}
                      </span>
                    </div>

                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '6px 14px', fontSize: '0.82rem', width: 'auto', borderRadius: 8 }}
                      onClick={() => navigate(`/page-media/${page.id}`, { state: { pageTitle: page.title, isPage: true } })}
                    >
                      Galería
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          {loading && !news.length ? (
            <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>Cargando noticias...</div>
          ) : (
            news.map(item => (
              <div key={item.id} className="list-item" onClick={(e) => {
                if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'SPAN' && !e.target.closest('button')) {
                  navigate(`/media/${item.id}`, { state: { newsTitle: item.title, initialAuthor: item.image_author || '' } });
                }
              }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div 
                    onClick={(e) => openMainImageModal(item, e)}
                    title="Toca para asignar o cambiar foto de portada"
                    style={{ width: 68, height: 68, borderRadius: 10, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, position: 'relative', cursor: 'pointer', border: item.image_path ? '1px solid rgba(255,255,255,0.1)' : '2px dashed var(--primary)' }}
                  >
                    {item.image_path ? (
                      <img src={`${getActiveSiteConfig().url}/${item.image_path}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: 4 }}>
                        <Plus size={20} color="var(--primary)" />
                        <span style={{ fontSize: '9px', color: 'var(--primary)', textAlign: 'center', fontWeight: 600 }}>Portada</span>
                      </div>
                    )}
                    {item.image_path && (
                      <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 2 }}>
                        <Edit3 size={11} color="white" />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</h4>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>{item.event_date ? new Date(item.event_date).toLocaleDateString() : 'Sin fecha'}</span>
                      {item.image_author && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38bdf8' }}>
                          <User size={12} /> {item.image_author}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="switch">
                      <input type="checkbox" checked={!!item.is_active_home} onChange={() => handleToggle(item)} />
                      <span className="slider"></span>
                    </label>
                    <span style={{ fontSize: '0.82rem', color: item.is_active_home ? 'var(--success)' : 'var(--text-muted)' }}>
                      {item.is_active_home ? 'Visible en Web' : 'Oculta'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className="btn btn-ghost" 
                      style={{ padding: '6px 10px', fontSize: '0.8rem', width: 'auto', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onClick={(e) => openMainImageModal(item, e)}
                    >
                      <Star size={13} color="var(--primary)" /> Portada
                    </button>
                    <div className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.82rem', width: 'auto', borderRadius: 8 }}>
                      Galería
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const MediaScreen = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isPage = location.pathname.startsWith('/page-media') || !!location.state?.isPage;
  const targetTitle = isPage ? (location.state?.pageTitle || 'Página') : (location.state?.newsTitle || 'Noticia');

  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [stepMessage, setStepMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [defaultAuthor, setDefaultAuthor] = useState(location.state?.initialAuthor || '');
  
  // Estado para el modal de asignación común previa a la subida
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAuthor, setBatchAuthor] = useState('');
  const [batchCaption, setBatchCaption] = useState('');
  const fileInputRef = useRef(null);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const res = isPage ? await getPageMedia(id) : await getMedia(id);
      if (res.success) setMedia(res.media);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMedia(); }, [id, isPage]);

  const handleDelete = async (mediaId) => {
    if (!window.confirm('¿Seguro que deseas eliminar este archivo?')) return;
    try {
      if (isPage) {
        await deletePageMedia(mediaId);
      } else {
        await deleteMedia(mediaId);
      }
      setMedia(media.filter(m => m.id !== mediaId));
    } catch (err) {
      alert("Error al borrar");
    }
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditCaption(item.caption || '');
    setEditAuthor(item.author || '');
  };

  const handleSaveDetails = async (mediaId) => {
    try {
      if (isPage) {
        await updatePageMediaCaption(mediaId, editCaption, editAuthor);
      } else {
        await updateMediaCaption(mediaId, editCaption, editAuthor);
      }
      setMedia(media.map(m => m.id === mediaId ? { ...m, caption: editCaption, author: editAuthor } : m));
      setEditingId(null);
    } catch (err) {
      alert("Error al guardar detalles de la imagen");
    }
  };

  const handleSetAsMain = async (item) => {
    if (!window.confirm('¿Establecer esta imagen como la principal/portada de la noticia?')) return;
    try {
      await setMainImageFromMedia(id, item, item.author || defaultAuthor);
      alert('¡Imagen establecida como principal de la noticia con éxito!');
    } catch (err) {
      alert('Error al establecer como principal: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingFiles(files);
    setBatchAuthor(defaultAuthor || '');
    setBatchCaption('');
    setShowBatchModal(true);
  };

  const handleCancelBatchModal = () => {
    setShowBatchModal(false);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmBatchUpload = async () => {
    const files = [...pendingFiles];
    setShowBatchModal(false);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const siteMeta = getActiveSiteMeta();
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    const failed = [];
    const newItems = [];

    if (batchAuthor) setDefaultAuthor(batchAuthor);

    // Se procesan uno a uno para no saturar el dispositivo ni el servidor
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      const original = files[i];
      let toUpload = original;

      try {
        if (original.type.startsWith('image/') && siteMeta) {
          setStepMessage('Aplicando marca de agua...');
          try {
            toUpload = await applyImageWatermark(original, siteMeta.watermarkText, siteMeta.logoUrl);
          } catch (imgErr) {
            console.warn('Error al aplicar marca de agua en imagen, subiendo original:', imgErr);
            toUpload = original;
          }
        } else if (original.type.startsWith('video/') && siteMeta) {
          setStepMessage('Comprimiendo vídeo 0%...');
          try {
            toUpload = await processVideo(original, siteMeta.watermarkText, siteMeta.logoUrl, (ratio) => {
              setStepMessage(`Comprimiendo vídeo ${Math.round(ratio * 100)}%...`);
            });
          } catch (vidErr) {
            console.warn('Error al comprimir vídeo, subiendo original:', vidErr);
            toUpload = original;
          }
        }

        setStepMessage('Subiendo al servidor...');
        const res = isPage
          ? await uploadPageMedia(id, toUpload, batchAuthor, batchCaption)
          : await uploadMedia(id, toUpload, batchAuthor, batchCaption);

        if (res.success && res.media) {
          let item = res.media;
          // Si el servidor devolvió el ítem sin el pie de foto asignado, asegurar persistencia
          if (batchCaption && (!item.caption || item.caption !== batchCaption)) {
            try {
              if (isPage) {
                await updatePageMediaCaption(item.id, batchCaption, batchAuthor);
              } else {
                await updateMediaCaption(item.id, batchCaption, batchAuthor);
              }
              item = { ...item, caption: batchCaption, author: batchAuthor || item.author };
            } catch (capErr) {
              console.warn('Actualización de respaldo de pie de foto:', capErr);
            }
          }
          newItems.push(item);
        }
      } catch (err) {
        console.error('Error al subir archivo:', original.name, err);
        failed.push(`${original.name} (${err.message || 'error de subida'})`);
      }
    }
    setStepMessage('');

    if (newItems.length) setMedia(prev => [...prev, ...newItems]);
    setUploading(false);
    if (failed.length) {
      alert(`No se pudieron subir ${failed.length} archivo(s):\n${failed.join('\n')}`);
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

      {/* Modal para agilizar la asignación común de Autor y Descripción antes de la subida */}
      {showBatchModal && (
        <div className="loader-overlay" style={{ padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 440, background: 'var(--bg-card)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UploadCloud size={20} color="var(--primary)" />
                Subir {pendingFiles.length} {pendingFiles.length === 1 ? 'archivo' : 'archivos'}
              </h3>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={handleCancelBatchModal} />
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
              Asigna autor y descripción para {pendingFiles.length === 1 ? 'este archivo' : 'todos los archivos seleccionados'}. Si son iguales, se rellenarán automáticamente en cada uno para no ir uno a uno.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Autor/a de las fotografías / vídeos:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <User size={16} color="var(--primary)" />
                <input 
                  type="text" 
                  value={batchAuthor} 
                  onChange={e => setBatchAuthor(e.target.value)}
                  placeholder="Ej. Juan Pérez / Banda de Música" 
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '8px 0', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Descripción / Pie de foto común:
              </label>
              <textarea 
                value={batchCaption} 
                onChange={e => setBatchCaption(e.target.value)}
                placeholder="Ej. Procesión del Santo Entierro, Concierto de Primavera..." 
                rows={3}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', padding: '10px 12px', outline: 'none', fontSize: '0.88rem', resize: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                * Puedes dejarlo en blanco si prefieres editarlos después individualmente.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={handleCancelBatchModal} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleConfirmBatchUpload} style={{ flex: 2 }}>
                Subir {pendingFiles.length} {pendingFiles.length === 1 ? 'archivo' : 'archivos'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ArrowLeft 
            size={24} 
            onClick={() => navigate('/news', { state: { tab: isPage ? 'pages' : 'news' } })} 
            style={{ cursor: 'pointer' }} 
          />
          <div>
            <div className="header-title">Galería {isPage ? 'de Página' : ''}</div>
            {targetTitle && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {targetTitle}
              </div>
            )}
          </div>
        </div>
        <div className="btn btn-primary" style={{ width: 'auto', padding: '6px 14px', borderRadius: 20 }} onClick={handleUploadClick}>
          <Plus size={18} /> Subir
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
        {/* Barra para definir autor preferente para las próximas subidas */}
        <div className="card" style={{ padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <User size={18} color="var(--primary)" />
          <input 
            type="text" 
            value={defaultAuthor} 
            onChange={e => setDefaultAuthor(e.target.value)}
            placeholder="Autor por defecto para las fotos que subas (opcional)"
            style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>

        {loading && !media.length ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>Cargando galería...</div>
        ) : media.length === 0 ? (
          <div className="card text-center" style={{ marginTop: 20 }}>
            <ImageIcon size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)' }}>No hay imágenes ni vídeos en {isPage ? 'esta página' : 'esta noticia'}.</p>
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
                  <video src={`${getActiveSiteConfig().url}/${item.image_path}`} controls style={{ width: '100%', height: 120, objectFit: 'cover', background: '#000' }} />
                ) : isPdf ? (
                  <div onClick={() => window.open(`${getActiveSiteConfig().url}/${item.image_path}`, '_blank')} style={{ cursor: 'pointer', width: '100%', height: 120, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                     <FileText size={32} color="#ef4444" opacity={0.8} />
                     <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px', fontWeight: 'bold' }}>PDF (Tocar para ver)</div>
                  </div>
                ) : (
                  <img src={`${getActiveSiteConfig().url}/${item.image_path}`} onClick={() => window.open(`${getActiveSiteConfig().url}/${item.image_path}`, '_blank')} style={{ cursor: 'pointer' }} />
                )}
                
                <div className="media-actions">
                  {editingId === item.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input 
                        type="text" 
                        value={editCaption} 
                        onChange={e => setEditCaption(e.target.value)} 
                        placeholder="Descripción..."
                        style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem', borderRadius: 4, border: 'none', background: 'white', color: 'black' }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input 
                          type="text" 
                          value={editAuthor} 
                          onChange={e => setEditAuthor(e.target.value)} 
                          placeholder="Autor de la foto..."
                          style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem', borderRadius: 4, border: 'none', background: 'white', color: 'black' }}
                        />
                        <button onClick={() => handleSaveDetails(item.id)} style={{ background: 'var(--success)', border: 'none', padding: '4px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <Check size={14} color="white" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '5px 8px', borderRadius: 6 }}
                      onClick={() => handleStartEdit(item)}
                    >
                      <div style={{ fontSize: '0.75rem', color: item.caption ? 'white' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.caption || 'Sin descripción'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: item.author ? '#38bdf8' : 'rgba(255,255,255,0.4)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={10} /> {item.author || 'Sin autor (Tocar)'}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!item.is_video && !isPdf && !isPage && (
                      <button 
                        className="btn btn-ghost" 
                        style={{ padding: '5px', fontSize: '0.72rem', borderRadius: 6, flex: 1, border: '1px solid rgba(255,255,255,0.1)' }} 
                        onClick={() => handleSetAsMain(item)}
                        title="Asignar como portada de la noticia"
                      >
                        <Star size={12} color="var(--primary)" /> Portada
                      </button>
                    )}
                    <button className="btn btn-danger" style={{ padding: '5px', fontSize: '0.72rem', borderRadius: 6, width: item.is_video || isPdf || isPage ? '100%' : 'auto' }} onClick={() => handleDelete(item.id)}>
                      <Trash2 size={13} />
                    </button>
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
        <Route path="/page-media/:id" element={getActiveSite() ? <MediaScreen /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default AppRoot;
