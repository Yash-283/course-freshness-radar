import { useEffect, useState } from 'react';

// Tiny hash router: "#/flags?course=X" -> { path: '/flags', query: URLSearchParams }
function read() {
  const [path, qs] = (window.location.hash || '#/').slice(1).split('?');
  return { path: path || '/', query: new URLSearchParams(qs || '') };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const go = (hash) => { window.location.hash = hash; };
