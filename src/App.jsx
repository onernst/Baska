import { useMemo, useState, useEffect, useRef } from 'react';
import { fetchItems, createItem, toggleItemDone, fetchStores, setAuthToken } from './api';
import Login from './pages/Login';
import Register from './pages/Register';

const storeOptions = ['All', 'Costco', 'Walmart', 'Target'];

export default function App() {
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'
  const [items, setItems] = useState([]);
  const [selectedStore, setSelectedStore] = useState('All');
  const [itemName, setItemName] = useState('');
  const [showDone, setShowDone] = useState(true);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [addStep, setAddStep] = useState('idle');
  const [pendingItem, setPendingItem] = useState('');
  const [pendingStore, setPendingStore] = useState('');
  const [pendingPerson, setPendingPerson] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showFullDatabaseList, setShowFullDatabaseList] = useState(false);
  const [selectedDatabaseItemId, setSelectedDatabaseItemId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('authUser');

    if (savedToken) {
      setAuthToken(savedToken);

      try {
        const parsedUser = savedUser ? JSON.parse(savedUser) : null;
        if (parsedUser && typeof parsedUser === 'object') {
          setUser(parsedUser);
          loadItems();
          return;
        }
      } catch (error) {
        console.warn('Stored user session is invalid. Clearing it.');
      }

      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      setAuthToken(null);
    }

    setLoading(false);
  }, []);

  function handleLogin(userData, token) {
    setAuthToken(token);
    setUser(userData);
    localStorage.setItem('authUser', JSON.stringify(userData));
    loadItems();
  }

  function handleGuestLogin() {
    const guestUser = {
      id: 'guest',
      name: 'Guest user',
      email: 'guest@local',
    };
    handleLogin(guestUser, 'local-demo-token');
  }

  function handleRegister(userData, token) {
    handleLogin(userData, token);
  }

  function handleLogout() {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setItems([]);
    setAuthView('login');
  }

  useEffect(() => {
    document.body.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  async function loadItems() {
    try {
      setLoading(true);
      const data = await fetchItems();
      setItems(data);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter((item) => selectedStore === 'All' || item.store === selectedStore);
  }, [items, selectedStore]);

  const stats = useMemo(() => {
    const total = visibleItems.length;
    const done = visibleItems.filter((item) => item.done).length;
    const pending = total - done;
    return { total, done, pending };
  }, [visibleItems]);

  const selectedDatabaseItem = useMemo(
    () => items.find((item) => item.id === selectedDatabaseItemId) || null,
    [items, selectedDatabaseItemId],
  );

  if (!user) {
    if (authView === 'login') {
      return (
        <Login
          onLogin={handleLogin}
          onGuestLogin={handleGuestLogin}
          onNavigateToRegister={() => setAuthView('register')}
        />
      );
    }

    return (
      <Register
        onRegister={handleRegister}
        onGuestLogin={handleGuestLogin}
        onNavigateToLogin={() => setAuthView('login')}
      />
    );
  }

  async function toggleDone(id) {
    try {
      const updated = await toggleItemDone(id);
      setItems((current) =>
        current.map((item) =>
          item.id === id ? updated : item,
        ),
      );
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  }

  async function addItem(event) {
    event.preventDefault();
    const name = itemName.trim();
    if (!name) return;

    const initialStore = selectedStore !== 'All' ? selectedStore : '';
    setPendingItem(name);
    setPendingStore(initialStore);
    setPendingPerson('');
    setAddStep('store');
    setItemName('');
  }

  async function submitAddedItem() {
    try {
      const newItem = await createItem({
        name: pendingItem,
        qty: 1,
        store: pendingStore || 'Unspecified',
        addedBy: pendingPerson || 'You',
        done: false,
      });

      setItems((current) => [newItem, ...current]);
      setPendingItem('');
      setPendingStore('');
      setPendingPerson('');
      setAddStep('idle');
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  }

  function handleProfileClick() {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setProfilePhoto(objectUrl);
    event.target.value = '';
  }

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();

      if (transcript) {
        setItemName(transcript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  return (
    <div className="app-shell">
      {showFullDatabaseList ? (
        <div className="database-page">
          <header className="database-header">
            <button type="button" className="back-btn" onClick={() => setShowFullDatabaseList(false)}>
              ← Back
            </button>
            <h2>Saved items</h2>
          </header>

          <div className="database-content">
            {items.length === 0 ? (
              <div className="empty-state">No saved items in the database yet.</div>
            ) : (
              <div className="database-list">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={selectedDatabaseItemId === item.id ? 'database-item active' : 'database-item'}
                    onClick={() => setSelectedDatabaseItemId(item.id)}
                  >
                    <span className="database-item-name">{item.name}</span>
                    <span className="database-item-meta">
                      {item.store || 'No store'} · {item.addedBy || 'Unknown'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedDatabaseItem && (
              <div className="database-detail-panel">
                <h3>{selectedDatabaseItem.name}</h3>
                <dl>
                  <div>
                    <dt>Store</dt>
                    <dd>{selectedDatabaseItem.store || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>Person</dt>
                    <dd>{selectedDatabaseItem.addedBy || 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt>Qty</dt>
                    <dd>{selectedDatabaseItem.qty || 1}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedDatabaseItem.done ? 'Done' : 'Pending'}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      ) : (
      <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-menu-wrap">
            <button
              className="icon-pill menu-btn"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>

            <div className={menuOpen ? 'menu-panel' : 'menu-panel hidden'} aria-label="App menu">
              <div className="progress-pill" aria-label="Progress summary">
                <div className="ring">
                  <span>{stats.done}</span>
                </div>
                <small>{stats.done}/{stats.total} done</small>
              </div>
              <button className="status-pill">Alerts off</button>
              <button
                type="button"
                className="theme-toggle"
                aria-label="Toggle theme"
                onClick={() => setIsDark((value) => !value)}
              >
                {isDark ? '☀' : '☼'}
              </button>
              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="brand-wrap" aria-label="Baska brand">
            <span className="brand-flower" aria-hidden="true" />
            <span className="brand-mark">✓</span>
            <span className="brand-name">Baska</span>
            <span className="brand-sub">shared list</span>
          </div>

          <div className="topbar-right">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePhotoChange}
            />
            <button
              type="button"
              className={profilePhoto ? 'icon-pill profile-btn has-photo' : 'icon-pill profile-btn'}
              aria-label="Add profile picture"
              onClick={handleProfileClick}
              style={profilePhoto ? { backgroundImage: `url(${profilePhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            >
              {!profilePhoto && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7c1.3-3.1 4.1-4.7 6-4.7s4.7 1.6 6 4.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="panel summary-panel">
            <h2>Summary</h2>
            <div className="stats-split">
              <div className="stats-block green">
                <label>On list</label>
                <strong>{stats.total}</strong>
              </div>
              <div className="stats-block purple">
                <label>Done</label>
                <strong>{stats.done}</strong>
              </div>
            </div>
          </section>
        </aside>

        <main className="main-panel">
          <div className="list-head">
            <div>
              <h1>Shopping list</h1>
              <p>{stats.pending} items to buy</p>
            </div>
            <div className="segmented-control" aria-label="List options">
              <button type="button" className="seg active">None</button>
              <button type="button" className="seg">Store</button>
              <button type="button" className="seg">Person</button>
            </div>
          </div>

          <form className="composer" onSubmit={addItem}>
            <div className="composer-row">
              <div className="composer-field">
                <input
                  type="text"
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  placeholder="Add an item…"
                  aria-label="Add an item"
                />
                <button
                  type="button"
                  className={isListening ? 'voice-btn listening' : 'voice-btn'}
                  aria-label="Add item by voice"
                  onClick={startVoiceInput}
                >
                  {isListening ? '◉' : '🎙'}
                </button>
              </div>
              <button type="submit" className="add-btn">Add</button>
            </div>
          </form>

          {addStep !== 'idle' && (
            <div className="add-flow">
              {addStep === 'store' && (
                <>
                  <label className="flow-label">Where is it for?</label>
                  <div className="flow-row">
                    <input
                      type="text"
                      value={pendingStore}
                      onChange={(event) => setPendingStore(event.target.value)}
                      placeholder="Store name"
                    />
                    <button
                      type="button"
                      className="next-btn"
                      onClick={() => setAddStep('person')}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}

              {addStep === 'person' && (
                <>
                  <label className="flow-label">Who is adding it?</label>
                  <div className="flow-row">
                    <input
                      type="text"
                      value={pendingPerson}
                      onChange={(event) => setPendingPerson(event.target.value)}
                      placeholder="Person name"
                    />
                    <button
                      type="button"
                      className="next-btn primary"
                      onClick={submitAddedItem}
                    >
                      Add item
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <section className="list-frame">
            <div className="list-toolbar">
              <span>{selectedStore === 'All' ? 'All stores' : selectedStore}</span>
              <button type="button" onClick={() => setShowDone((value) => !value)}>
                {showDone ? 'Hide done' : 'Show done'}
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
            ) : (
              <ul className="item-list">
                {visibleItems
                  .filter((item) => (showDone ? true : !item.done))
                  .map((item) => (
                  <li key={item.id} className={item.done ? 'item-row done' : 'item-row'}>
                    <input
                      type="checkbox"
                      checked={item.done}
                      aria-label={`Mark ${item.name} as done`}
                      onChange={() => toggleDone(item.id)}
                    />
                    <div className="meta">
                      <strong>{item.name}</strong>
                      <small>
                        {item.qty} · {item.store} · {item.addedBy}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <section className="panel store-panel">
          <h2>Stores</h2>
          <div className="chip-group">
            {storeOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={selectedStore === option ? 'chip active' : 'chip'}
                onClick={() => setSelectedStore(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      </div>

      <nav className="bottom-bar" aria-label="Bottom navigation">
        <button type="button" className="bottom-tab active" onClick={() => setShowFullDatabaseList(true)}>
          <span>List</span>
        </button>
        <button type="button" className="bottom-tab" onClick={() => setSelectedStore('All')}>
          <span>Stores</span>
        </button>
        <button type="button" className="bottom-tab" onClick={() => setShowDone(true)}>
          <span>Summary</span>
        </button>
      </nav>

      <button type="button" className="help-fab" aria-label="Open help assistant">
        ?
      </button>
    </>
      )}
    </div>
  );
}
