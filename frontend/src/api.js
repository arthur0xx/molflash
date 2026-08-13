const TOKEN_KEY = 'store_token';
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const STATIC_CATALOG_MODE = import.meta.env.VITE_STATIC_CATALOG === 'true';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const publicAssetUrl = (assetPath) => {
  const value = String(assetPath || '');
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${import.meta.env.BASE_URL}${value.replace(/^\/+/, '')}`;
};

let catalogPromise;
function loadStaticCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(`${import.meta.env.BASE_URL}static-api/catalog.json`)
      .then((res) => {
        if (!res.ok) throw new Error('تعذر تحميل كتالوج المعاينة');
        return res.json();
      });
  }
  return catalogPromise;
}

function staticError(message = 'هذه العملية غير متاحة في نسخة المعاينة') {
  return Promise.reject(new Error(message));
}

function filteredTools(catalog, query) {
  const category = query.get('category');
  const q = String(query.get('q') || '').trim().toLowerCase();
  const min = Number(query.get('min'));
  const max = Number(query.get('max'));
  const sort = query.get('sort') || 'popular';
  let tools = catalog.tools.filter((tool) => {
    if (category && String(tool.category_id) !== String(category)) return false;
    if (q && !`${tool.tool_name} ${tool.category_name}`.toLowerCase().includes(q)) return false;
    if (Number.isFinite(min) && min > 0 && tool.price < min) return false;
    if (Number.isFinite(max) && max > 0 && tool.price > max) return false;
    return true;
  });

  if (sort === 'price_asc') tools = tools.sort((a, b) => a.price - b.price || a.tool_name.localeCompare(b.tool_name));
  if (sort === 'price_desc') tools = tools.sort((a, b) => b.price - a.price || a.tool_name.localeCompare(b.tool_name));
  if (sort === 'newest') tools = tools.slice().reverse();
  if (sort === 'popular') tools = tools.sort((a, b) => b.is_featured - a.is_featured || a.tool_name.localeCompare(b.tool_name));
  return tools;
}

async function staticApi(path, { method = 'GET' } = {}) {
  if (method !== 'GET') return staticError();
  const [pathname, rawQuery = ''] = path.split('?');
  const query = new URLSearchParams(rawQuery);
  const catalog = await loadStaticCatalog();

  if (pathname === '/categories') return catalog.categories;
  if (pathname === '/settings') return catalog.settings;
  if (pathname === '/tools') return filteredTools(catalog, query);
  if (pathname === '/tools/featured') return catalog.featured;
  if (pathname === '/products') return catalog.products;

  if (pathname.startsWith('/tools/')) {
    const toolKey = decodeURIComponent(pathname.slice('/tools/'.length));
    const tool = catalog.tools.find((item) => item.tool_key === toolKey);
    if (!tool) return staticError('الأداة غير موجودة');
    const packages = catalog.products.filter((item) => item.tool_key === toolKey);
    const related = catalog.tools.filter((item) => item.category_id === tool.category_id && item.tool_key !== toolKey).slice(0, 4);
    return { tool, packages, related };
  }

  if (pathname.startsWith('/products/')) {
    const productId = Number(pathname.slice('/products/'.length));
    const product = catalog.products.find((item) => item.id === productId);
    if (!product) return staticError('الخدمة غير موجودة');
    const related = catalog.products.filter((item) => item.category_id === product.category_id && item.id !== product.id).slice(0, 4);
    return { product, related };
  }

  return staticError('هذا المسار غير متاح في نسخة المعاينة');
}

export async function api(path, options = {}) {
  if (STATIC_CATALOG_MODE) return staticApi(path, options);

  const { method = 'GET', body } = options;
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}

export const waOpen = (link) => {
  if (link) window.open(link, '_blank');
};
