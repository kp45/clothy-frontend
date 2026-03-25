import api from './client';
import { BASE_URL } from './client';

const toBaseOrigin = () => {
  try {
    return new URL(BASE_URL).origin;
  } catch {
    return BASE_URL.replace(/\/+$/, '');
  }
};

const BASE_ORIGIN = toBaseOrigin();
const STATIC_PREFIX = '/static/';

const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const value = url.trim();
  if (!value) return value;

  // Relative static path from API (recommended)
  if (value.startsWith('/')) return `${BASE_ORIGIN}${value}`;

  // Absolute URL: preserve CDN links, but rewrite static files to current API host.
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith(STATIC_PREFIX)) {
        return `${BASE_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return value;
    } catch {
      return value;
    }
  }

  // Bare relative path (e.g. "static/images/a.jpg")
  return `${BASE_ORIGIN}/${value.replace(/^\/+/, '')}`;
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

// ── Image upload ─────────────────────────────────────────────
// Accepts a local file URI from expo-image-picker.
// Returns the full public URL string to store in image_url field.
export const uploadImage = async (localUri) => {
  const filename = localUri.split('/').pop();
  const ext      = filename.split('.').pop().toLowerCase();
  const mimeMap  = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const type     = mimeMap[ext] || 'image/jpeg';

  const formData = new FormData();
  formData.append('file', { uri: localUri, name: filename, type });

  const res = await api.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  // Keep uploaded file URL portable across LAN/tunnel host changes.
  return normalizeImageUrl(res.data.url);
};
