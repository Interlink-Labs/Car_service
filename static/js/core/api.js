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
        const token = localStorage.getItem('as_token');
        response = await fetch(url, {
            method,
            headers: {
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
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
        patch: (path, body, options) => request(path, { ...options, module, method: 'PATCH', body }),
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
        booking: (booking) => http.post('/client/booking', booking),
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

/** Учётные записи (доступы) и роли: модуль workers. */
export const accountsApi = {
    list: (query) => api.get('/user', { query }),
    stats: () => api.get('/user/stats'),
    create: (account) => api.post('/user', account),
    update: (id, changes) => api.put(`/user/${id}`, changes),
    remove: (id) => api.del(`/user/${id}`),
};

export const workflowApi = (() => {
    const http = createClient('workflow');
    return {
        requests: (query) => http.get('/requests', { query }),
        request: (id) => http.get(`/requests/${id}`),
        requestDetails: (id) => http.get(`/requests/${id}/details`),
        removeRequest: (id) => http.del(`/requests/${id}`),
        reports: () => createClient('reports').get('/summary'),
        createRequest: (payload) => http.post('/requests', payload),
        updateRequest: (id, payload) => http.patch(`/requests/${id}`, payload),
        services: (query) => http.get('/services', { query }),
        createService: (payload) => http.post('/services', payload),
        getService: (id) => http.get(`/services/${id}`),
        updateService: (id, payload) => http.put(`/services/${id}`, payload),
        removeService: (id) => http.del(`/services/${id}`),
        details: (query) => http.get('/details', { query }),
        getDetail: (id) => http.get(`/details/${id}`),
        createDetail: (payload) => http.post('/details', payload),
        updateDetail: (id, payload) => http.put(`/details/${id}`, payload),
        removeDetail: (id) => http.del(`/details/${id}`),
        addItem: (id, payload) => http.post(`/requests/${id}/items`, payload),
        works: (id) => http.get(`/requests/${id}/works`),
        addWork: (id, payload) => http.post(`/requests/${id}/works`, payload),
    };
})();

export const authApi = {
    login: (username, password) => api.post('/auth/login', { username, password }),
    /** @param {{username: string, password: string, name?: string, role?: string}} payload */
    register: (payload) => api.post('/auth/register', payload),
};