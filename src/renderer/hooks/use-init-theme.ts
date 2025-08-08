import { useEffect } from 'react';

export function useInitTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const stored = localStorage.getItem('theme');

    if (stored === 'dark') {
      html.classList.add('dark');
    } else if (stored === 'light') {
      html.classList.remove('dark');
    } else {
      // Lần đầu: lấy theo system
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches;
      if (prefersDark) {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  }, []);
}
