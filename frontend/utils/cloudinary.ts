type ImageOptions = {
    width?: number;
    quality?: 'auto' | number;
};

export function optimizeCloudinaryImage(url?: string | null, options: ImageOptions = {}) {
    if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
        return url || '';
    }

    const marker = '/image/upload/';
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) return url;

    const prefix = url.slice(0, markerIndex + marker.length);
    const rest = url.slice(markerIndex + marker.length);
    if (!rest) return url;

    const firstSegment = rest.split('/')[0] || '';
    if (firstSegment.includes('f_auto') || firstSegment.includes('q_auto') || firstSegment.includes('w_')) {
        return url;
    }

    const width = options.width ?? 900;
    const quality = options.quality ?? 'auto';
    const transformation = `f_auto,q_${quality},c_limit,w_${width}`;

    return `${prefix}${transformation}/${rest}`;
}
