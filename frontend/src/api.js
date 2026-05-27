const getUserId = () => localStorage.getItem('studybot_user') || 'test-user-001';

// Vite in production might have an empty API_BASE if it's served from the same domain
// In dev, the proxy handles it.
const API_BASE = import.meta.env.VITE_API_BASE || '';

export const callApi = async (path, opts = {}) => {
  const userId = getUserId();
  const headers = new Headers(opts.headers || {});
  headers.set('X-User-Id', userId);

  const response = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'API Error');
  }

  return response.json();
};

export const uploadFile = async (file) => {
  const userId = getUserId();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: {
      'X-User-Id': userId
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Upload Error');
  }

  return response.json();
};
