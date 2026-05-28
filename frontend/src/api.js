import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://tranminhquang.me';

const addAuthHeaders = async (headers) => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    const user = await getCurrentUser();

    headers.set('X-User-Id', user.userId || user.username || 'cognito-user');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  } catch (err) {
    console.warn('Không lấy được phiên đăng nhập', err);
  }
};

export const callApi = async (path, opts = {}) => {
  const headers = new Headers(opts.headers || {});
  await addAuthHeaders(headers);

  const response = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'API Error');
  }

  return response.json();
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const headers = new Headers();
  await addAuthHeaders(headers);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Upload Error');
  }

  return response.json();
};

export const callDocumentAction = async (actionType, docId = null) => {
  const payload = { action_type: actionType };
  if (docId) payload.doc_id = docId;

  return callApi('/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};
