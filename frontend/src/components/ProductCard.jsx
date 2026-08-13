import { Link } from 'react-router-dom';

const typeIcon = {
  ACTIVATION: '⌁',
  SERVER: '◈',
  RENTAL: '◷',
  MISC: '✦',
};

export function productPrice(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `$${amount.toFixed(2)}` : 'سعر تجريبي';
}

export default function ProductCard({ product: tool, variant = 'card' }) {
  const icon = typeIcon[tool.service_type] || tool.emoji || '◌';
  const destination = `/tool/${tool.tool_key}`;

  if (variant === 'list') {
    return (
      <Link to={destination} className="service-list-card">
        <span className="service-icon" aria-hidden="true">{icon}</span>
        <span className="service-list-copy">
          <b>{tool.tool_name}</b>
          <small>{tool.package_count || 1} باقة · {tool.category_name}</small>
        </span>
        <span className="service-list-price">{productPrice(tool.price)}</span>
        <span className="service-arrow" aria-hidden="true">‹</span>
      </Link>
    );
  }

  return (
    <Link to={destination} className="app-product-card">
      <span className="service-icon app-product-icon" aria-hidden="true">{icon}</span>
      <span className="app-product-copy">
        <b>{tool.tool_name}</b>
        <small>{tool.package_count || 1} باقة متاحة</small>
        <em className="availability"><i /> متوفر</em>
      </span>
      <span className="app-product-footer">
        <strong>{productPrice(tool.price)}</strong>
        <span aria-hidden="true">←</span>
      </span>
    </Link>
  );
}
