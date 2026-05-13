import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Custom HTML template for Expo Router web builds.
 * Injects PWA meta tags, manifest link, and Service Worker registration.
 *
 * This file only runs on the web platform during static rendering.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* ─── SEO ──────────────────────────────────── */}
        <title>Công Đoàn Cảng Nghệ Tĩnh</title>
        <meta
          name="description"
          content="Ứng dụng quản lý hoạt động Công Đoàn - Cảng Nghệ Tĩnh. Bảng tin, vinh danh, hoạt động, đào tạo, khảo sát."
        />

        {/* ─── PWA Meta Tags ────────────────────────── */}
        <meta name="theme-color" content="#0866ff" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Công Đoàn" />
        <meta name="application-name" content="Công Đoàn" />
        <meta name="msapplication-TileColor" content="#0866ff" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />

        {/* ─── Icons ────────────────────────────────── */}
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=3" />
        <link rel="icon" type="image/png" sizes="96x96" href="/icons/icon-96x96.png?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png?v=3" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png?v=3" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144x144.png?v=3" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/icon-128x128.png?v=3" />

        {/* ─── PWA Manifest ─────────────────────────── */}
        <link rel="manifest" href="/manifest.json" />

        {/* ─── Apple Splash Screens (optional) ──────── */}
        <meta name="format-detection" content="telephone=no" />

        {/* ─── Service Worker Registration ──────────── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('[PWA] Service Worker registered:', reg.scope);
                      // Listen for updates
                      reg.addEventListener('updatefound', function() {
                        var newWorker = reg.installing;
                        if (newWorker) {
                          newWorker.addEventListener('statechange', function() {
                            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                              console.log('[PWA] New content available, refreshing…');
                            }
                          });
                        }
                      });
                    })
                    .catch(function(err) {
                      console.warn('[PWA] Service Worker registration failed:', err);
                    });
                });
              }
            `,
          }}
        />

        {/* ─── Expo ScrollView Reset ────────────────── */}
        <ScrollViewStyleReset />

        {/* ─── Prevent FOUC with dark bg ────────────── */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                margin: 0;
                padding: 0;
                background-color: #ffffff;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              /* Standalone mode: hide the default scrollbar for app feel */
              @media all and (display-mode: standalone) {
                body { overflow: hidden; }
                ::-webkit-scrollbar { display: none; }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
