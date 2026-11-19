const BASE = import.meta.env.VITE_API_URL || '/api';

let token = null;
try {
  token = localStorage.getItem('jm_token');
} catch {
  /* localStorage може бути недоступним */
}

export function setToken(value) {
  token = value;
  try {
    if (value) localStorage.setItem('jm_token', value);
    else localStorage.removeItem('jm_token');
  } catch {
    /* ігноруємо */
  }
}

export const hasToken = () => !!token;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, { json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body });
  } catch {
    throw new ApiError('Немає зʼєднання з сервером. Перевірте, що бекенд запущено.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event('jm:unauthorized'));
    throw new ApiError(data.error || 'Сталася помилка. Спробуйте ще раз.', res.status);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, json) => request('POST', path, { json }),
  put: (path, json) => request('PUT', path, { json }),
  patch: (path, json) => request('PATCH', path, { json }),
  del: (path) => request('DELETE', path),
  upload: (path, form) => request('POST', path, { form }),
};

/** Завантаження файлу з авторизацією (resume/file) */
export async function downloadFile(path, filename) {
  const res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'Не вдалося завантажити файл', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'resume';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
