import api from './client';

// Permanent Hostinger base where all uploaded images live.
const HOSTINGER_BASE = 'https://gatijobs.in/ClothyAI/uploads';

/**
 * normalizeImageUrl
 * -----------------
 * Guarantees every image_url coming from the API or DB is a valid,
 * permanent Hostinger URL. Handles three legacy cases:
 *
 *   1. Relative path    /static/images/abc.jpg
 *      → https://gatijobs.in/ClothyAI/uploads/abc.jpg
 *
 *   2. Absolute Railway URL  https://railway.app/static/images/abc.jpg
 *      → https://gatijobs.in/ClothyAI/uploads/abc.jpg
 *
 *   3. Already a Hostinger (or any other https) URL — passed through as-is.
 */
const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const value = url.trim();
  if (!value) return value;

  // ── Case 1: relative /static/images/ path stored by old local-upload code ──
  if (value.startsWith('/static/images/')) {
    const filename = value.replace('/static/images/', '');
    return `${HOSTINGER_BASE}/${filename}`;
  }

  // ── Case 2: bare "static/images/…" without leading slash ──────────────────
  if (value.startsWith('static/images/')) {
    const filename = value.replace('static/images/', '');
    return `${HOSTINGER_BASE}/${filename}`;
  }

  // ── Case 3: absolute URL — check if it's a /static/images/ Railway URL ─────
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith('/static/images/')) {
        const filename = parsed.pathname.replace('/static/images/', '');
        return `${HOSTINGER_BASE}/${filename}`;
      }
    } catch {
      // malformed URL — fall through and return as-is
    }
    // Already an absolute Hostinger (or other CDN) URL — use it directly.
    return value;
  }

  // ── Fallback: treat as bare filename and append to Hostinger base ──────────
  return `${HOSTINGER_BASE}/${value.replace(/^\/+/, '')}`;
};

const normalizeItem = (item) => {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    image_url: normalizeImageUrl(item.image_url),
    variants: Array.isArray(item.variants)
      ? item.variants.map(normalizeImageUrl)
      : item.variants,
  };
};

// ── Catalog (home page banner) ──────────────────────────────
export const getCatalog = () =>
  api.get('/catalog/').then((res) => ({
    ...res,
    data: Array.isArray(res.data)
      ? res.data.map((entry) => ({ ...entry, image_url: normalizeImageUrl(entry.image_url) }))
      : res.data,
  }));

// ── Items ───────────────────────────────────────────────────
export const getAllItems = (skip = 0, limit = 50) =>
  api.get('/items/', { params: { skip, limit } }).then((res) => ({
    ...res,
    data: Array.isArray(res.data) ? res.data.map(normalizeItem) : res.data,
  }));

export const getItemByUniqueId = (uniqueId) =>
  api.get(`/items/${uniqueId}`).then((res) => ({
    ...res,
    data: normalizeItem(res.data),
  }));

// ── Admin CRUD ───────────────────────────────────────────────
export const createItem = (data) =>
  api.post('/items/', data).then((res) => ({
    ...res,
    data: normalizeItem(res.data),
  }));
export const updateItem = (uniqueId, data) =>
  api.put(`/items/${uniqueId}`, data).then((res) => ({
    ...res,
    data: normalizeItem(res.data),
  }));
export const deleteItem = (uniqueId) => api.delete(`/items/${uniqueId}`);

export const addToCatalog = (item_unique_id, position = 0) =>
  api.post('/catalog/', { item_unique_id, position });
export const removeFromCatalog = (item_unique_id) =>
  api.delete(`/catalog/${item_unique_id}`);

// ── Testimonials ─────────────────────────────────────────────
export const getTestimonials = () =>
  api.get('/testimonials/').then((res) => ({
    ...res,
    data: Array.isArray(res.data)
      ? res.data.map((entry) => ({ ...entry, image_url: normalizeImageUrl(entry.image_url) }))
      : res.data,
  }));
export const createTestimonial = (data) => api.post('/testimonials/', data);
export const deleteTestimonial = (testimonialId) => api.delete(`/testimonials/${testimonialId}`);

// ── Image upload (via Railway backend → Hostinger) ────────────────────────────
// Accepts a local file URI from expo-image-picker.
// Returns the full public Hostinger URL string to store in image_url field.
export const uploadImage = async (localUri) => {
  const filename = localUri.split('/').pop();
  const ext      = (filename.split('.').pop() || 'jpg').toLowerCase();
  const mimeMap  = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const type     = mimeMap[ext] || 'image/jpeg';

  const formData = new FormData();
  formData.append('file', { uri: localUri, name: filename, type });

  const res = await api.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  // Backend always returns an absolute Hostinger URL.
  return res.data.url;
};
