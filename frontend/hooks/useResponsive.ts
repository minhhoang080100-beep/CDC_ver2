import { useWindowDimensions } from 'react-native';

const BREAKPOINTS = {
    tablet: 768,
    desktop: 1024,
};

export function useResponsive() {
    const { width, height } = useWindowDimensions();

    const isMobile = width < BREAKPOINTS.tablet;
    const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
    const isDesktop = width >= BREAKPOINTS.tablet; // ≥768 = desktop mode
    const isWideDesktop = width >= BREAKPOINTS.desktop;

    // Content max width for centered layout on desktop
    const contentMaxWidth = isWideDesktop ? 900 : isTablet ? 700 : undefined;

    // Number of columns for grid layouts
    const gridColumns = isWideDesktop ? 2 : 1;

    // Sidebar width
    const sidebarWidth = isWideDesktop ? 260 : isDesktop ? 220 : 0;

    return {
        width,
        height,
        isMobile,
        isTablet,
        isDesktop,
        isWideDesktop,
        contentMaxWidth,
        gridColumns,
        sidebarWidth,
    };
}
