import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parse } from 'yaml';
import './styles.css';

const shopFiles = import.meta.glob('../packs/**/*.yml', {
  eager: true,
  import: 'default',
  query: '?raw',
});

function formatPrice(price = {}) {
  const units = ['pp', 'gp', 'sp', 'cp'];
  const parts = units
    .filter((unit) => price[unit])
    .map((unit) => `${price[unit]} ${unit}`);

  return parts.length ? parts.join(' ') : 'Price unavailable';
}

function stripHtml(html = '') {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return document.body.textContent?.trim() || '';
}

const shops = Object.entries(shopFiles)
  .map(([path, raw]) => {
    const shop = parse(raw);
    const district = path.includes('otari-shops') ? 'Otari' : 'Common goods';

    return {
      id: shop._id,
      name: shop.name,
      district,
      items: (shop.items ?? []).map((item) => ({
        id: item._id,
        name: item.name,
        image: item.img,
        type: item.type,
        quantity: item.system?.quantity ?? 0,
        level: item.system?.level?.value ?? 0,
        rarity: item.system?.traits?.rarity ?? 'common',
        traits: item.system?.traits?.value ?? [],
        price: formatPrice(item.system?.price?.value),
        description: stripHtml(item.system?.description?.value),
      })),
    };
  })
  .sort((first, second) => first.name.localeCompare(second.name));

function ItemArtwork({ image, type }) {
  return (
    <span className="item-artwork" aria-hidden="true">
      <span>{type?.slice(0, 1).toUpperCase() ?? '?'}</span>
      <img src={image} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
    </span>
  );
}

function App() {
  const [activeShopId, setActiveShopId] = useState(shops[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  const activeShop = shops.find((shop) => shop.id === activeShopId) ?? shops[0];
  const itemTypes = [
    'all',
    ...new Set(activeShop?.items.map((item) => item.type).filter(Boolean)),
  ];
  const visibleItems = (activeShop?.items ?? []).filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || [item.name, item.type, ...item.traits]
      .join(' ')
      .toLowerCase()
      .includes(query);

    return matchesQuery && (type === 'all' || item.type === type);
  });

  return (
    <main>
      <header className="masthead">
        <div className="brand-mark" aria-hidden="true">P</div>
        <div>
          <p className="eyebrow">Pathfinder 2e inventory</p>
          <h1>Shop Ledger</h1>
        </div>
        <p className="shop-count">{shops.length} stocked shops</p>
      </header>

      <section className="workspace" aria-label="Shop inventory browser">
        <aside className="shop-list">
          <p className="section-label">Browse shops</p>
          {shops.map((shop) => (
            <button
              className={`shop-button ${shop.id === activeShop.id ? 'active' : ''}`}
              key={shop.id}
              onClick={() => {
                setActiveShopId(shop.id);
                setType('all');
                setSelectedItem(null);
              }}
            >
              <span>{shop.name}</span>
              <small>{shop.items.length} items</small>
            </button>
          ))}
        </aside>

        <section className="inventory">
          <div className="inventory-heading">
            <div>
              <p className="eyebrow">{activeShop?.district}</p>
              <h2>{activeShop?.name}</h2>
            </div>
            <p>{activeShop?.items.length} entries</p>
          </div>

          <div className="filters">
            <label className="search-field">
              <span>Search inventory</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, type, or trait"
              />
            </label>
            <div className="type-filter" aria-label="Filter inventory type">
              {itemTypes.map((itemType) => (
                <button
                  className={type === itemType ? 'selected' : ''}
                  key={itemType}
                  onClick={() => setType(itemType)}
                >
                  {itemType}
                </button>
              ))}
            </div>
          </div>

          {visibleItems.length ? (
            <div className="item-grid">
              {visibleItems.map((item) => (
                <button className="item-card" key={item.id} onClick={() => setSelectedItem(item)}>
                  <ItemArtwork image={item.image} type={item.type} />
                  <span className="item-card-top"><b>{item.name}</b><em>{item.price}</em></span>
                  <span className="item-card-bottom">Level {item.level} · {item.rarity} · {item.quantity} in stock</span>
                </button>
              ))}
            </div>
          ) : <p className="empty-state">No inventory matches that search.</p>}
        </section>
      </section>

      {selectedItem && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setSelectedItem(null)}>
          <article className="item-dialog" role="dialog" aria-modal="true" aria-label={selectedItem.name} onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedItem(null)} aria-label="Close item details">×</button>
            <ItemArtwork image={selectedItem.image} type={selectedItem.type} />
            <p className="eyebrow">{selectedItem.type} · level {selectedItem.level}</p>
            <h2>{selectedItem.name}</h2>
            <p className="price">{selectedItem.price} · {selectedItem.quantity} in stock</p>
            {selectedItem.traits.length > 0 && <p className="traits">{selectedItem.traits.join(' · ')}</p>}
            <p className="description">{selectedItem.description || 'No description is recorded for this item.'}</p>
          </article>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
);