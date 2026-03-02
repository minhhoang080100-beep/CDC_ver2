// API utility using native fetch - replaces axios for web compatibility

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type RequestOptions = {
    headers?: Record<string, string>;
};

// Custom error class with response data
export class ApiError extends Error {
    status: number;
    detail: string;
    response: { status: number; data: any };

    constructor(status: number, detail: string, data: any) {
        super(detail);
        this.name = 'ApiError';
        this.status = status;
        this.detail = detail;
        this.response = { status, data };
    }
}

// Token expiry callback - set by AuthContext
let onTokenExpired: (() => void) | null = null;

export function setTokenExpiredCallback(callback: () => void) {
    onTokenExpired = callback;
}

async function handleResponse(response: Response) {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        // Handle token expiry (401 Unauthorized)
        if (response.status === 401) {
            console.warn('Token expired or invalid. Logging out...');
            if (onTokenExpired) {
                onTokenExpired();
            }
        }

        const detail = data?.detail || getErrorMessage(response.status);
        throw new ApiError(response.status, detail, data);
    }

    return { data, status: response.status };
}

function getErrorMessage(status: number): string {
    switch (status) {
        case 400: return 'Dữ liệu không hợp lệ';
        case 401: return 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại';
        case 403: return 'Bạn không có quyền thực hiện thao tác này';
        case 404: return 'Không tìm thấy dữ liệu';
        case 500: return 'Lỗi máy chủ, vui lòng thử lại sau';
        default: return `Lỗi kết nối (HTTP ${status})`;
    }
}

async function safeFetch(url: string, options: RequestInit): Promise<Response> {
    try {
        return await fetch(url, options);
    } catch (error: any) {
        // Network error (offline, DNS failure, etc.)
        throw new ApiError(0, 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.', null);
    }
}

export const api = {
    get: async (path: string, options?: RequestOptions) => {
        const response = await safeFetch(`${BACKEND_URL}${path}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        return handleResponse(response);
    },

    post: async (path: string, body?: any, options?: RequestOptions) => {
        const isFormData = body instanceof FormData;
        const headers: Record<string, string> = { ...options?.headers };

        // Let fetch automatically set Content-Type with boundary for FormData
        if (!isFormData && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        } else if (isFormData) {
            // Remove Content-Type if it was manually set to 'multipart/form-data' 
            // without boundary, allowing fetch to set it correctly
            if (headers['Content-Type'] === 'multipart/form-data') {
                delete headers['Content-Type'];
            }
        }

        const response = await safeFetch(`${BACKEND_URL}${path}`, {
            method: 'POST',
            headers,
            body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
        });
        return handleResponse(response);
    },

    put: async (path: string, body?: any, options?: RequestOptions) => {
        const isFormData = body instanceof FormData;
        const headers: Record<string, string> = { ...options?.headers };

        if (!isFormData && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        } else if (isFormData) {
            if (headers['Content-Type'] === 'multipart/form-data') {
                delete headers['Content-Type'];
            }
        }

        const response = await safeFetch(`${BACKEND_URL}${path}`, {
            method: 'PUT',
            headers,
            body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
        });
        return handleResponse(response);
    },

    delete: async (path: string, options?: RequestOptions) => {
        const response = await safeFetch(`${BACKEND_URL}${path}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        return handleResponse(response);
    },
};
