const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('hmas_token') : null;

const request = async (method, path, body, options = {}) => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: options.isFormData ? { Authorization: `Bearer ${token}` } : headers,
    body: options.isFormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/login')) {
    localStorage.removeItem('hmas_token');
    localStorage.removeItem('hmas_user');
    window.location.href = '/login';
    return;
  }
  if (!res.ok) throw new Error(data.message || `Request failed with status ${res.status}`);
  return data;
};

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, formData, { isFormData: true }),
  download: async (path) => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.message || 'Download failed'); }
    return res.blob();
  },
};
