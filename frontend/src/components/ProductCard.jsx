import { Link } from 'react-router-dom';

export default function ProductCard({ product: tool }) {
  const priceText = tool.max_price > tool.price
    ? `من ${tool.price} إلى ${tool.max_price}`
    : `${tool.price}`;

  return (
    <Link to={`/tool/${tool.tool_key}`} className="product-card tool-card">
      <div className="product-emoji tool-visual" style={{ background: tool.gradient }}>
        <img src={tool.asset_path || '/assets/chrigsm-default-service-hero.png'} alt="" loading="lazy" />
        <img className="tool-brand-stamp" src="/assets/chrigsm-mark.png" alt="chrigsm" />
        {tool.is_featured ? <span className="tag">مختارة</span> : null}
        <span className="tool-type">{tool.service_type || 'SERVICE'}</span>
      </div>
      <div className="product-body">
        <h3>{tool.tool_name}</h3>
        <span className="cat-name">{tool.category_name}</span>
        <p className="tool-packages">{tool.package_count} باقات متاحة</p>
        <div className="price-row">
          <b>{priceText} <small>USD</small></b>
        </div>
        <span className="btn btn-primary btn-block btn-sm">عرض الباقات</span>
      </div>
    </Link>
  );
}
