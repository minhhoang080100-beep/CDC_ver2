// API utility using native fetch — refactored to eliminate duplication

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ---- Token auto-attach ----
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
    _authToken = token;
}

async function getAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...extra };
    // Auto-attach token if available
    const token = _authToken || await AsyncStorage.getItem('token');
    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// ---- Refresh token logic ----
let _isRefreshing = false;

async function tryRefreshToken(): Promise<boolean> {
    if (_isRefreshing) return false;
    _isRefreshing = true;
    try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) return false;

        const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) return false;

        const data = await response.json();
        if (data?.token) {
            _authToken = data.token;
            await AsyncStorage.setItem('token', data.token);
            return true;
        }
        return false;
    } catch {
        return false;
    } finally {
        _isRefreshing = false;
    }
}

async function handleResponse(response: Response, retryFn?: () => Promise<{ data: any; status: number }>) {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        // Handle token expiry (401 Unauthorized) — try refresh first
        if (response.status === 401 && retryFn) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
                return retryFn(); // Retry the original request
            }
            console.warn('Token expired and refresh failed. Logging out...');
            if (onTokenExpired) {
                onTokenExpired();
            }
        } else if (response.status === 401) {
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
        case 422: return 'Dữ liệu gửi lên không đúng định dạng';
        case 429: return 'Quá nhiều yêu cầu, vui lòng thử lại sau';
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

// ─── Core request function — all HTTP methods delegate to this ───
async function _request(
    method: string,
    path: string,
    body?: any,
    options?: RequestOptions
): Promise<{ data: any; status: number }> {
    const isFormData = body instanceof FormData;
    const hasBody = method !== 'GET' && method !== 'DELETE';

    const buildHeaders = async () => {
        const headers = await getAuthHeaders(options?.headers);
        if (isFormData) {
            // Let browser set Content-Type with boundary for FormData
            delete headers['Content-Type'];
        } else if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    };

    const buildBody = () => {
        if (!hasBody || body === undefined) return undefined;
        return isFormData ? body : JSON.stringify(body);
    };

    const doFetch = async () => {
        const freshHeaders = await buildHeaders();
        const r = await safeFetch(`${BACKEND_URL}${path}`, {
            method,
            headers: freshHeaders,
            body: buildBody(),
        });
        return handleResponse(r);
    };

    const headers = await buildHeaders();
    const response = await safeFetch(`${BACKEND_URL}${path}`, {
        method,
        headers,
        body: buildBody(),
    });
    return handleResponse(response, doFetch);
}

export const api = {
    get: (path: string, options?: RequestOptions) =>
        _request('GET', path, undefined, options),

    post: (path: string, body?: any, options?: RequestOptions) =>
        _request('POST', path, body, options),

    put: (path: string, body?: any, options?: RequestOptions) =>
        _request('PUT', path, body, options),

    delete: (path: string, options?: RequestOptions) =>
        _request('DELETE', path, undefined, options),
};
