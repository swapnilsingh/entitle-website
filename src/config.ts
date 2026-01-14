// Base URL configuration for GitHub Pages
const baseUrl = import.meta.env.BASE_URL || '/';
export const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
