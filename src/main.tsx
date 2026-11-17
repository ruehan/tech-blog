// Keep the original room and book experiences isolated from APEX's styles and bundle.
const path = window.location.pathname;
if (/^\/(room|posts)(\/|$)/.test(path)) void import('./legacy-main');
else if (/^\/admin(\/|$)/.test(path)) void import('./admin/admin-main');
else void import('./apex-main');
