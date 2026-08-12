import { Link } from 'react-router-dom';

export default function ProductCard({ product }) {
  return (
    <Link to={`/product/${product.id}`} className="product-card">
      <div className="product-emoji" style={{ background: product.gradient }}>
        <span>{product.emoji}</span>
        {product.is_featured && <span className="tag">مميز 🔥</span>}
        {product.sold_count > 0 && <span className="sold">+{product.sold_count} بيع</span>}
      </div>
      <div className="product-body">
        <h3>{product.name}</h3>
        <span className="cat-name">{product.category_name}</span>
        <div className="price-row">
          {product.old_price > product.price && <del>{product.old_price}</del>}
          <b>{product.price} <small>درهم</small></b>
        </div>
        <button className="btn btn-primary btn-block btn-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <Link to={`/product/${product.id}`} onClick={(e) => e.stopPropagation()}>اطلب الآن</Link>
        </button>
      </div>
    </Link>
  );
}
