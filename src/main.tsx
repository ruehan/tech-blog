// Keep the original room and book experiences isolated from APEX's styles and bundle.
const legacy = /^\/(room|posts)(\/|$)/.test(window.location.pathname);
if (legacy) void import('./legacy-main');
else void import('./apex-main');
