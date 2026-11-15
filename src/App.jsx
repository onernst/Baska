import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Auth from './pages/Auth';
import {
  createItem,
  createList,
  deleteItem,
  fetchItems,
  fetchLists,
  fetchMembers,
  fetchMyName,
  getSession,
  joinList,
  onAuthChange,
  setItemStatus,
  shareLinkFor,
  signOut,
  subscribeToList,
} from './api';

const DEFAULT_STORES = ['Costco', 'Walmart', 'Target'];
const JOIN_KEY = 'baska.pendingJoin';
const CURRENT_LIST_KEY = 'baska.currentList';

const STATUS_LABEL = {
  needed: 'To buy',
  got: 'Got it',
  out: 'Out of stock',
  substituted: 'Swapped',
};

function readJoinCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('join');
  if (code) {
    sessionStorage.setItem(JOIN_KEY, code);
    params.delete('join');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
  }
  return sessionStorage.getItem(JOIN_KEY);
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [joinCode] = useState(readJoinCode);

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  if (session === undefined) {
    return <div className="center-note">Loading…</div>;
  }
  if (!session) {
    return <Auth joining={Boolean(joinCode)} />;
  }
  return <ListApp key={session.user.id} user={session.user} />;
}

function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ListApp({ user }) {
  const [myName, setMyName] = useState('');
  const [lists, setLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(() => localStorage.getItem(CURRENT_LIST_KEY) || '');
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('All');
  const [itemName, setItemName] = useState('');
  const [showDone, setShowDone] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [addStep, setAddStep] = useState('idle');
  const [pendingItem, setPendingItem] = useState('');
  const [pendingStore, setPendingStore] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [statusEditor, setStatusEditor] = useState(null); // { id, status, note }
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const myNameRef = useRef(myName);
  myNameRef.current = myName;

  const currentList = lists.find((list) => list.id === currentListId) || null;

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  // First load: who am I, join a shared list if a link brought me here, load my lists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const name = await fetchMyName(user.id);
        if (!cancelled) setMyName(name || user.email.split('@')[0]);

        let joinedId = '';
        const code = sessionStorage.getItem(JOIN_KEY);
        if (code) {
          sessionStorage.removeItem(JOIN_KEY);
          try {
            joinedId = await joinList(code);
          } catch (err) {
            showToast(err.message);
          }
        }

        let myLists = await fetchLists();
        if (myLists.length === 0) {
          await createList('Shopping list');
          myLists = await fetchLists();
        }
        if (cancelled) return;
        setLists(myLists);

        const remembered = localStorage.getItem(CURRENT_LIST_KEY);
        const pick =
          (joinedId && myLists.find((l) => l.id === joinedId)) ||
          myLists.find((l) => l.id === remembered) ||
          myLists[0];
        setCurrentListId(pick.id);
        if (joinedId) showToast(`You joined “${pick.name}”`);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, showToast]);

  const refreshItems = useCallback(async () => {
    if (!currentListId) return;
    try {
      const data = await fetchItems(currentListId);
      setItems(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentListId]);

  // Load the current list, keep it live, and refresh when the app comes back to the front.
  useEffect(() => {
    if (!currentListId) return undefined;
    localStorage.setItem(CURRENT_LIST_KEY, currentListId);
    setLoading(true);
    setSelectedStore('All');
    refreshItems();
    fetchMembers(currentListId).then(setMembers).catch(() => setMembers([]));

    const unsubscribe = subscribeToList(currentListId, (change) => {
      const row = change.new && Object.keys(change.new).length ? change.new : change.old;
      if (change.eventType === 'DELETE' && !itemsRef.current.some((i) => i.id === row?.id)) return;
      if (change.eventType !== 'DELETE' && row?.updated_by_name && row.updated_by_name !== myNameRef.current) {
        const verb =
          change.eventType === 'INSERT'
            ? `added ${row.name}`
            : `marked ${row.name}: ${STATUS_LABEL[row.status] || row.status}`;
        showToast(`${row.updated_by_name} ${verb}`);
      }
      refreshItems();
      if (change.eventType === 'INSERT') fetchMembers(currentListId).then(setMembers).catch(() => {});
    });

    const onFocus = () => {
      if (document.visibilityState === 'visible') refreshItems();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    const poll = setInterval(refreshItems, 60000);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      clearInterval(poll);
    };
  }, [currentListId, refreshItems, showToast]);

  const storeOptions = useMemo(() => {
    const fromItems = items.map((item) => item.store).filter(Boolean);
    return ['All', ...Array.from(new Set([...DEFAULT_STORES, ...fromItems]))];
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => selectedStore === 'All' || item.store === selectedStore),
    [items, selectedStore],
  );

  const stats = useMemo(() => {
    const total = visibleItems.length;
    const done = visibleItems.filter((item) => item.status !== 'needed').length;
    return { total, done, pending: total - done };
  }, [visibleItems]);

  async function changeStatus(item, status, note = '') {
    const previous = items;
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, status, status_note: note, updated_by_name: myName } : i)),
    );
    try {
      await setItemStatus(item.id, status, note);
    } catch (err) {
      setItems(previous);
      showToast(`Couldn’t update: ${err.message}`);
    }
  }

  async function removeItem(item) {
    if (!window.confirm(`Remove ${item.name} from the list?`)) return;
    try {
      await deleteItem(item.id);
      setItems((current) => current.filter((i) => i.id !== item.id));
    } catch (err) {
      showToast(`Couldn’t remove: ${err.message}`);
    }
  }

  function addItem(event) {
    event.preventDefault();
    const name = itemName.trim();
    if (!name) return;
    setPendingItem(name);
    setPendingStore(selectedStore !== 'All' ? selectedStore : '');
    setAddStep('store');
    setItemName('');
  }

  async function submitAddedItem() {
    try {
      const created = await createItem(currentListId, {
        name: pendingItem,
        store: pendingStore.trim(),
      });
      setItems((current) => [created, ...current.filter((i) => i.id !== created.id)]);
      setPendingItem('');
      setPendingStore('');
      setAddStep('idle');
    } catch (err) {
      showToast(`Couldn’t add: ${err.message}`);
    }
  }

  async function handleNewList() {
    const name = window.prompt('Name the new list', 'Groceries');
    if (!name) return;
    try {
      const created = await createList(name);
      setLists(await fetchLists());
      setCurrentListId(created.id);
    } catch (err) {
      showToast(`Couldn’t create list: ${err.message}`);
    }
  }

  async function handleShare() {
    if (!currentList) return;
    const url = shareLinkFor(currentList);
    const text = `Join my Baska list “${currentList.name}” so we can shop together:`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Baska list', text, url });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      showToast('Share link copied. Paste it into a text or WhatsApp.');
    } catch {
      window.prompt('Copy this link and send it:', url);
    }
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfilePhoto(URL.createObjectURL(file));
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
      if (transcript) setItemName(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  return (
    <div className="app-shell">
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
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            <div className={menuOpen ? 'menu-panel' : 'menu-panel hidden'} aria-label="App menu">
              <div className="progress-pill" aria-label="Progress summary">
                <div className="ring">
                  <span>{stats.done}</span>
                </div>
                <small>
                  {stats.done}/{stats.total} done
                </small>
              </div>
              <button type="button" className="theme-toggle" aria-label="Toggle theme" onClick={() => setIsDark((v) => !v)}>
                {isDark ? '☀' : '☼'}
              </button>
              <button type="button" className="status-pill" onClick={signOut}>
                Sign out
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
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePhotoChange} />
            <button
              type="button"
              className={profilePhoto ? 'icon-pill profile-btn has-photo' : 'icon-pill profile-btn'}
              aria-label={`Signed in as ${myName}. Add profile picture`}
              title={`Signed in as ${myName}`}
              onClick={() => fileInputRef.current?.click()}
              style={
                profilePhoto
                  ? { backgroundImage: `url(${profilePhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : undefined
              }
            >
              {!profilePhoto && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7c1.3-3.1 4.1-4.7 6-4.7s4.7 1.6 6 4.7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className={summaryOpen ? 'panel summary-panel open' : 'panel summary-panel'}>
            <button
              type="button"
              className="summary-toggle"
              aria-expanded={summaryOpen}
              onClick={() => setSummaryOpen((open) => !open)}
            >
              <h2>Summary</h2>
              <span className="summary-chevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {(() => {
              const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
              const firstThree = [
                { key: 'complete', label: 'Complete', nums: [percent], percent: true, tone: 'progress' },
                { key: 'lists', label: lists.length === 1 ? 'List' : 'Lists', nums: [lists.length], tone: 'orange' },
                { key: 'doneof', label: 'Done', nums: [stats.done, stats.total], tone: 'green' },
              ];
              const cards = summaryOpen
                ? [
                    ...firstThree,
                    { key: 'onlist', label: 'On list', nums: [stats.total], tone: 'red' },
                    { key: 'tobuy', label: 'To buy', nums: [stats.pending], tone: 'orange' },
                    { key: 'people', label: members.length === 1 ? 'Person' : 'People', nums: [members.length], tone: 'green' },
                  ]
                : firstThree;
              return (
                <div
                  className="stats"
                  onClick={() => setSummaryOpen((open) => !open)}
                  title={summaryOpen ? 'Show less' : 'Show all stats'}
                >
                  {cards.map((card) => (
                    <div
                      key={`${card.key}-${card.nums.join('-')}`}
                      className={`stat tone-${card.tone}`}
                      style={card.percent ? { '--pct': `${percent}%` } : undefined}
                    >
                      <span className="figure" aria-hidden="true">
                        {card.nums.map((n, i) => (
                          <span key={i}>
                            {i > 0 && <span className="figure-sep">/</span>}
                            <span className="num" style={{ '--target': n }} />
                          </span>
                        ))}
                        {card.percent && <span className="figure-suffix">%</span>}
                      </span>
                      <span className="sr-only">
                        {card.nums.join(' of ')}
                        {card.percent ? '%' : ''}
                      </span>
                      <p>{card.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>

          <section className="panel members-panel">
            <h2>Shared with</h2>
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.id}>
                  <span className="member-dot" aria-hidden="true">
                    {(m.display_name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  {m.display_name}
                  {m.id === user.id ? ' (you)' : ''}
                </li>
              ))}
            </ul>
            <button type="button" className="share-btn" onClick={handleShare}>
              Invite someone
            </button>
          </section>
        </aside>

        <main className="main-panel">
          <div className="list-head">
            <div className="list-picker">
              <select
                aria-label="Choose a list"
                value={currentListId}
                onChange={(event) => setCurrentListId(event.target.value)}
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              <p>
                {stats.pending} to buy · {members.length} {members.length === 1 ? 'person' : 'people'}
              </p>
            </div>
            <div className="list-actions">
              <button type="button" className="ghost-btn" onClick={handleNewList}>
                + New list
              </button>
              <button type="button" className="share-btn" onClick={handleShare}>
                Share
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

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
              <button type="submit" className="add-btn">
                Add
              </button>
            </div>
          </form>

          {addStep === 'store' && (
            <div className="add-flow">
              <label className="flow-label">Which store is “{pendingItem}” for? (optional)</label>
              <div className="flow-row">
                <input
                  type="text"
                  list="store-suggestions"
                  value={pendingStore}
                  onChange={(event) => setPendingStore(event.target.value)}
                  placeholder="Store name"
                  autoFocus
                />
                <datalist id="store-suggestions">
                  {storeOptions
                    .filter((s) => s !== 'All')
                    .map((s) => (
                      <option key={s} value={s} />
                    ))}
                </datalist>
                <button type="button" className="next-btn" onClick={() => setAddStep('idle')}>
                  Cancel
                </button>
                <button type="button" className="next-btn primary" onClick={submitAddedItem}>
                  Add item
                </button>
              </div>
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
              <div className="center-note">Loading…</div>
            ) : visibleItems.length === 0 ? (
              <div className="center-note">Nothing here yet. Add the first item above.</div>
            ) : (
              <ul className="item-list">
                {visibleItems
                  .filter((item) => (showDone ? true : item.status === 'needed'))
                  .map((item) => (
                    <li key={item.id} className={`item-row status-${item.status}${item.status !== 'needed' ? ' done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={item.status === 'got'}
                        aria-label={`Mark ${item.name} as got it`}
                        onChange={() => changeStatus(item, item.status === 'got' ? 'needed' : 'got')}
                      />
                      <div className="meta">
                        <strong>{item.name}</strong>
                        <small>
                          {[item.qty > 1 ? `×${item.qty}` : '', item.store, item.added_by_name && `added by ${item.added_by_name}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                        {item.status !== 'needed' && (
                          <span className={`status-badge ${item.status}`}>
                            {STATUS_LABEL[item.status]}
                            {item.status_note ? `: ${item.status_note}` : ''}
                            {item.updated_by_name ? ` · ${item.updated_by_name}, ${timeAgo(item.updated_at)}` : ''}
                          </span>
                        )}
                        {statusEditor?.id === item.id && (
                          <div className="status-editor">
                            <input
                              type="text"
                              value={statusEditor.note}
                              onChange={(e) => setStatusEditor({ ...statusEditor, note: e.target.value })}
                              placeholder={
                                statusEditor.status === 'substituted' ? 'What did you get instead?' : 'Add a note (optional)'
                              }
                              autoFocus
                            />
                            <button
                              type="button"
                              className="next-btn primary"
                              onClick={() => {
                                changeStatus(item, statusEditor.status, statusEditor.note.trim());
                                setStatusEditor(null);
                              }}
                            >
                              Save
                            </button>
                            <button type="button" className="next-btn" onClick={() => setStatusEditor(null)}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="item-actions">
                        <button
                          type="button"
                          className={item.status === 'out' ? 'mini-btn active' : 'mini-btn'}
                          onClick={() =>
                            item.status === 'out'
                              ? changeStatus(item, 'needed')
                              : setStatusEditor({ id: item.id, status: 'out', note: '' })
                          }
                        >
                          Out
                        </button>
                        <button
                          type="button"
                          className={item.status === 'substituted' ? 'mini-btn active' : 'mini-btn'}
                          onClick={() =>
                            item.status === 'substituted'
                              ? changeStatus(item, 'needed')
                              : setStatusEditor({ id: item.id, status: 'substituted', note: '' })
                          }
                        >
                          Swap
                        </button>
                        <button
                          type="button"
                          className="mini-btn remove"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => removeItem(item)}
                        >
                          ×
                        </button>
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
        <button type="button" className="bottom-tab active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span>List</span>
        </button>
        <button type="button" className="bottom-tab" onClick={handleShare}>
          <span>Share</span>
        </button>
        <button type="button" className="bottom-tab" onClick={handleNewList}>
          <span>New list</span>
        </button>
      </nav>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
