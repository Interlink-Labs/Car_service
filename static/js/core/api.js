/**
 * core/api.js — единая обёртка над fetch.
 * Каждый модуль бэкенда живёт под своим префиксом (/workers, /clients, /cars),
 * внутри — общий /api/v1. Клиенты создаются фабрикой createClient().
 */

const API_VERSION = '/api/v1';

export class ApiError extends Error {
    constructor(message, status, payload) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.payload = payload;
    }
}

/** Достать человекочитаемое сообщение из ответа FastAPI. */
function extractDetail(payload, fallback) {
    if (!payload) return fallback;
    const detail = payload.detail ?? payload.message;

    if (typeof detail === 'string') return detail;
    // Ошибка валидации pydantic: массив объектов
    if (Array.isArray(detail)) {
        return detail
            .map((item) => (typeof item === 'string' ? item : item?.msg))
            .filter(Boolean)
            .join('; ') || fallback;
    }
    return fallback;
}

/**
 * @param {string} path   путь после префикса модуля, например '/worker'
 * @param {object} [options]
 * @param {string} [options.module]  префикс модуля, по умолчанию 'workers'
 * @param {string} [options.method]
 * @param {object} [options.body]
 * @param {object} [options.query]  undefined/null/'' — пропускаются
 */
export async function request(path, { module = 'workers', method = 'GET', body, query } = {}) {
    let url = `/${module}${API_VERSION}${path}`;

    if (query) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null || value === '') continue;
            params.set(key, value);
        }
        const qs = params.toString();
        if (qs) url += `?${qs}`;
    }

    let response;
    try {
        response = await fetch(url, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (cause) {
        throw new ApiError('Сервер недоступен. Проверьте подключение.', 0, null);
    }

    const raw = await response.text();
    let payload = null;
    if (raw) {
        try {
            payload = JSON.parse(raw);
        } catch {
            payload = raw;
        }
    }

    if (!response.ok) {
        throw new ApiError(
            extractDetail(payload, `Ошибка запроса (${response.status})`),
            response.status,
            payload,
        );
    }

    return payload;
}

/** Фабрика клиента конкретного модуля: createClient('cars').get('/car') */
export function createClient(module) {
    return {
        get: (path, options) => request(path, { ...options, module, method: 'GET' }),
        post: (path, body, options) => request(path, { ...options, module, method: 'POST', body }),
        put: (path, body, options) => request(path, { ...options, module, method: 'PUT', body }),
        del: (path, options) => request(path, { ...options, module, method: 'DELETE' }),
    };
}

export const api = createClient('workers');

/* ---------- Доменный слой: сотрудники и роли ---------- */

export const workersApi = {
    list: (query) => api.get('/worker', { query }),
    stats: () => api.get('/worker/stats'),
    roles: () => api.get('/roles'),
    createRole: (label) => api.post('/role', { label }),
    create: (worker) => api.post('/worker', worker),
    update: (id, worker) => api.put(`/worker/${id}`, worker),
    remove: (id) => api.del(`/worker/${id}`),
};

export const clientsApi = (() => {
    const http = createClient('clients');
    return {
        list: (query) => http.get('/client', { query }),
        stats: () => http.get('/client/stats'),
        get: (id) => http.get(`/client/${id}`),
        create: (client) => http.post('/client', client),
        update: (id, client) => http.put(`/client/${id}`, client),
        remove: (id) => http.del(`/client/${id}`),
    };
})();

export const carsApi = (() => {
    const http = createClient('cars');
    return {
        list: (query) => http.get('/car', { query }),
        stats: () => http.get('/car/stats'),
        get: (id) => http.get(`/car/${id}`),
        create: (car) => http.post('/car', car),
        update: (id, car) => http.put(`/car/${id}`, car),
        remove: (id) => http.del(`/car/${id}`),
    };
})();

export const authApi = {
    login: (username, password) => api.post('/auth/login', { username, password }),
    register: (username, password) => api.post('/auth/register', { username, password }),
};