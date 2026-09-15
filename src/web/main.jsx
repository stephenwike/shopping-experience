import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parse } from 'yaml';
import './styles.css';

const STOCK_API = '/api/stock';
const DM_MODE_KEY = 'shopping-experience:dm-mode';
const POLL_INTERVAL_MS = 15000;

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

function StockStepper({ item, quantity, onAdjust, onSet }) {
  return (
    <div className="stock-stepper" onMouseDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`Decrease stock for ${item.name}`}
        onClick={() => onAdjust(item, -1)}
        disabled={quantity <= 0}
      >
        −
      </button>
      <input
        type="number"
        min="0"
        value={quantity}
        aria-label={`Stock for ${item.name}`}
        onChange={(event) => onSet(item, parseInt(event.target.value, 10))}
      />
      <button type="button" aria-label={`Increase stock for ${item.name}`} onClick={() => onAdjust(item, 1)}>
        +
      </button>
    </div>
  );
}

function StockDisplay({ quantity }) {
  return <span className="stock-display">{quantity} in stock</span>;
}

function App() {
  const [activeShopId, setActiveShopId] = useState(shops[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [stockOverrides, setStockOverrides] = useState({});
  const [isDM, setIsDM] = useState(() => localStorage.getItem(DM_MODE_KEY) === 'true');

  useEffect(() => {
    let cancelled = false;

    async function fetchStock() {
      try {
        const response = await fetch(STOCK_API);
        const data = await response.json();
        if (!cancelled) setStockOverrides(data.overrides ?? {});
      } catch (error) {
        console.error('Failed to load shared stock', error);
      }
    }

    fetchStock();
    const interval = setInterval(fetchStock, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function saveStock(nextOverrides) {
    setStockOverrides(nextOverrides);
    try {
      await fetch(STOCK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextOverrides),
      });
    } catch (error) {
      console.error('Failed to save shared stock', error);
    }
  }

  function getQuantity(item) {
    return stockOverrides[item.id] ?? item.quantity;
  }

  function setQuantity(item, quantity) {
    const nextQuantity = Math.max(0, Number.isFinite(quantity) ? quantity : 0);
    saveStock({ ...stockOverrides, [item.id]: nextQuantity });
  }

  function adjustQuantity(item, delta) {
    setQuantity(item, getQuantity(item) + delta);
  }

  function resetStock() {
    if (confirm('Reset all shop stock back to the original quantities?')) {
      saveStock({});
    }
  }

  function toggleDM() {
    setIsDM((current) => {
      const next = !current;
      localStorage.setItem(DM_MODE_KEY, String(next));
      return next;
    });
  }

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
        <div className="stock-actions">
          <button className={isDM ? 'selected' : ''} onClick={toggleDM}>{isDM ? 'DM mode: on' : 'DM mode: off'}</button>
          {isDM && <button className="reset-stock-button" onClick={resetStock}>Reset stock</button>}
        </div>
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
                <div className="item-card" key={item.id}>
                  <button className="item-card-open" onClick={() => setSelectedItem(item)}>
                    <ItemArtwork image={item.image} type={item.type} />
                    <span className="item-card-top"><b>{item.name}</b><em>{item.price}</em></span>
                    <span className="item-card-bottom">Level {item.level} · {item.rarity}</span>
                  </button>
                  {isDM
                    ? <StockStepper item={item} quantity={getQuantity(item)} onAdjust={adjustQuantity} onSet={setQuantity} />
                    : <StockDisplay quantity={getQuantity(item)} />}
                </div>
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
            <p className="price">{selectedItem.price}</p>
            {isDM
              ? <StockStepper item={selectedItem} quantity={getQuantity(selectedItem)} onAdjust={adjustQuantity} onSet={setQuantity} />
              : <StockDisplay quantity={getQuantity(selectedItem)} />}
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