// API utility using native fetch - replaces axios for web compatibility
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type RequestOptions = {
    headers?: Record<string, string>;
};

async function handleResponse(response: Response) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const error: any = new Error(data?.detail || `HTTP ${response.status}`);
        error.response = { status: response.status, data };
        throw error;
    }
    return { data, status: response.status };
}

export const api = {
    get: async (path: string, options?: RequestOptions) => {
        const response = await fetch(`${BACKEND_URL}${path}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        return handleResponse(response);
    },

    post: async (path: string, body?: any, options?: RequestOptions) => {
        const response = await fetch(`${BACKEND_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        return handleResponse(response);
    },

    put: async (path: string, body?: any, options?: RequestOptions) => {
        const response = await fetch(`${BACKEND_URL}${path}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        return handleResponse(response);
    },

    delete: async (path: string, options?: RequestOptions) => {
        const response = await fetch(`${BACKEND_URL}${path}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        return handleResponse(response);
    },
};
