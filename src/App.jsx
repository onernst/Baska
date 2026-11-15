import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Auth from './pages/Auth';
import Assistant from './components/Assistant';
import Recipes from './components/Recipes';
import {
  assignItem,
  createItem,
  createList,
  deleteList,
  deleteItem,
  fetchItems,
  fetchLists,
  fetchMembers,
  fetchMyName,
  getSession,
  joinList,
  leaveList,
  onAuthChange,
  renameList,
  setItemStatus,
  shareLinkFor,
  signOut,
  subscribeToList,
} from './api';
import { searchRecipes } from './recipes';

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
  const [listsOpen, setListsOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [editingList, setEditingList] = useState(null); // { id, name }
  const [confirmingDelete, setConfirmingDelete] = useState(null); // list id
  const [isDark, setIsDark] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [addStep, setAddStep] = useState('idle');
  const [pendingItem, setPendingItem] = useState('');
  const [pendingStore, setPendingStore] = useState('');
  const [pendingPerson, setPendingPerson] = useState('');
  const [pendingListId, setPendingListId] = useState('');
  const [checkMode, setCheckMode] = useState(false);
  const [assignEditor, setAssignEditor] = useState(null); // { id, store, person, listId }
  const [isListening, setIsListening] = useState(false);
  const [statusEditor, setStatusEditor] = useState(null); // { id, status, note }
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const myNameRef = useRef(myName);
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const currentListIdRef = useRef(currentListId);
  currentListIdRef.current = currentListId;
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

  useEffect(() => {
    if (!listsOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeListManager();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listsOpen]);

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

  const unassignedCount = useMemo(
    () => visibleItems.filter((item) => item.status === 'needed' && missingFor(item).length > 0).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleItems],
  );

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

  function startAddFlow(name) {
    setPendingItem(name);
    setPendingStore(selectedStore !== 'All' ? selectedStore : '');
    setPendingPerson(myName);
    setPendingListId(currentListId);
    setAddStep('store');
    setItemName('');
  }

  function addItem(event) {
    event.preventDefault();
    const name = itemName.trim();
    if (!name) return;
    startAddFlow(name);
  }

  // Who an item is for. If nobody was picked, it belongs to its direct sender:
  // the last person who sent or changed it, not the original creator.
  function personOf(item) {
    return (
      (item.assigned_to || '').trim() ||
      (item.updated_by_name || '').trim() ||
      (item.added_by_name || '').trim()
    );
  }

  function missingFor(item) {
    const missing = [];
    if (!(item.store || '').trim()) missing.push('store');
    if (!personOf(item)) missing.push('person');
    return missing;
  }

  async function saveAssignment() {
    if (!assignEditor) return;
    const { id, store, person, listId } = assignEditor;
    try {
      // Left empty: the person sending it now (you) takes ownership.
      const assignedTo = person.trim() || myName;
      const updated = await assignItem(id, { store, assignedTo, listId });
      if (listId !== currentListId) {
        setItems((current) => current.filter((i) => i.id !== id));
        const target = lists.find((l) => l.id === listId);
        showToast(`Moved “${updated.name}” to ${target ? target.name : 'another list'}`);
      } else {
        setItems((current) => current.map((i) => (i.id === id ? updated : i)));
      }
      setAssignEditor(null);
    } catch (err) {
      showToast(`Couldn’t save: ${err.message}`);
    }
  }

  function cancelAddFlow() {
    setAddStep('idle');
    setPendingItem('');
  }

  async function submitAddedItem() {
    const targetListId = pendingListId || currentListId;
    try {
      const created = await createItem(targetListId, {
        name: pendingItem,
        store: pendingStore.trim(),
        assignedTo: pendingPerson.trim() || myName,
      });
      if (targetListId === currentListId) {
        setItems((current) => [created, ...current.filter((i) => i.id !== created.id)]);
      } else {
        const target = lists.find((l) => l.id === targetListId);
        showToast(`Added “${pendingItem}” to ${target ? target.name : 'the other list'}`);
      }
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

  async function handleShare(list = currentList) {
    if (!list || typeof list !== 'object' || !list.share_code) list = currentList;
    if (!list) return;
    const url = shareLinkFor(list);
    const text = `Join my Baska list “${list.name}” so we can shop together:`;
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

  async function saveListName() {
    if (!editingList) return;
    const name = editingList.name.trim();
    if (!name) return;
    try {
      await renameList(editingList.id, name);
      setLists(await fetchLists());
      setEditingList(null);
      showToast('List renamed');
    } catch (err) {
      showToast(`Couldn’t rename: ${err.message}`);
    }
  }

  async function removeList(list) {
    const isOwner = list.owner_id === user.id;
    try {
      if (isOwner) await deleteList(list.id);
      else await leaveList(list.id, user.id);
      let remaining = await fetchLists();
      if (remaining.length === 0) {
        await createList('Shopping list');
        remaining = await fetchLists();
      }
      setLists(remaining);
      if (list.id === currentListId) setCurrentListId(remaining[0].id);
      setConfirmingDelete(null);
      showToast(isOwner ? `Deleted “${list.name}”` : `You left “${list.name}”`);
    } catch (err) {
      showToast(`Couldn’t ${isOwner ? 'delete' : 'leave'}: ${err.message}`);
    }
  }

  async function addRecipeIngredients(ingredients, listId, recipeName) {
    let added = 0;
    for (const ing of ingredients) {
      const name = ing.measure ? `${ing.name} (${ing.measure})` : ing.name;
      try {
        const created = await createItem(listId, { name, assignedTo: myName, note: recipeName });
        added += 1;
        if (listId === currentListIdRef.current) {
          setItems((current) => [created, ...current.filter((i) => i.id !== created.id)]);
        }
      } catch (err) {
        showToast(`Couldn’t add ${ing.name}: ${err.message}`);
      }
    }
    const target = lists.find((l) => l.id === listId);
    showToast(`Added ${added} ingredient${added === 1 ? '' : 's'} for ${recipeName} to ${target ? target.name : 'your list'}`);
  }

  // ---- Assistant: what it can see, and the commands it can run ----
  function assistantContext() {
    return {
      me: myName,
      open_list: listsRef.current.find((l) => l.id === currentListIdRef.current)?.name || '',
      lists: listsRef.current.map((l) => l.name),
      people: Array.from(new Set([myName, ...members.map((m) => m.display_name)].filter(Boolean))),
      stores: storeOptions.filter((st) => st !== 'All'),
      store_filter: selectedStore,
      items: itemsRef.current.slice(0, 200).map((i) => ({
        name: i.name,
        qty: i.qty,
        store: i.store || '',
        person: personOf(i),
        status: i.status,
        note: i.status_note || '',
      })),
    };
  }

  function findByName(collection, name, key = 'name') {
    const wanted = (name || '').trim().toLowerCase();
    if (!wanted) return null;
    return (
      collection.find((x) => (x[key] || '').toLowerCase() === wanted) ||
      collection.find((x) => (x[key] || '').toLowerCase().includes(wanted)) ||
      null
    );
  }

  async function runAssistantTool(name, input) {
    const allLists = listsRef.current;
    const openId = currentListIdRef.current;
    switch (name) {
      case 'add_items': {
        const done = [];
        for (const it of input.items || []) {
          const target = it.list ? findByName(allLists, it.list) : null;
          if (it.list && !target) {
            done.push(`no list called “${it.list}”`);
            continue;
          }
          const listId = target ? target.id : openId;
          const created = await createItem(listId, {
            name: it.name,
            qty: it.qty || 1,
            store: it.store || '',
            assignedTo: it.person || myName,
          });
          if (listId === openId) setItems((current) => [created, ...current.filter((i) => i.id !== created.id)]);
          done.push(`${it.name}${target ? ` → ${target.name}` : ''}`);
        }
        return `Added: ${done.join(', ')}`;
      }
      case 'update_item': {
        const item = findByName(itemsRef.current, input.item);
        if (!item) return `No item called “${input.item}” on the open list.`;
        if (input.status) await setItemStatus(item.id, input.status, input.note || '');
        if (input.store !== undefined || input.person !== undefined || input.list) {
          const target = input.list ? findByName(allLists, input.list) : null;
          if (input.list && !target) return `No list called “${input.list}”.`;
          await assignItem(item.id, {
            store: input.store !== undefined ? input.store : item.store || '',
            assignedTo: (input.person !== undefined ? input.person : personOf(item)) || myName,
            listId: target ? target.id : item.list_id || openId,
          });
        }
        await refreshItems();
        return `Updated ${item.name}`;
      }
      case 'remove_item': {
        const item = findByName(itemsRef.current, input.item);
        if (!item) return `No item called “${input.item}” on the open list.`;
        await deleteItem(item.id);
        setItems((current) => current.filter((i) => i.id !== item.id));
        return `Removed ${item.name}`;
      }
      case 'open_list': {
        const target = findByName(allLists, input.list);
        if (!target) return `No list called “${input.list}”.`;
        setCurrentListId(target.id);
        return `Opened ${target.name}`;
      }
      case 'create_list': {
        const created = await createList(input.name);
        setLists(await fetchLists());
        setCurrentListId(created.id);
        return `Created and opened ${created.name}`;
      }
      case 'filter_store': {
        const wanted = (input.store || '').trim();
        if (!wanted || wanted.toLowerCase() === 'all') {
          setSelectedStore('All');
          return 'Showing all stores';
        }
        const match = storeOptions.find((st) => st.toLowerCase() === wanted.toLowerCase()) || wanted;
        setSelectedStore(match);
        return `Showing ${match}`;
      }
      case 'find_recipes': {
        const found = (await searchRecipes(input.query)).slice(0, 4);
        if (!found.length) return `No recipes found for “${input.query}”.`;
        return JSON.stringify(
          found.map((r) => ({
            name: r.name,
            ingredients: r.ingredients.map((i) => (i.measure ? `${i.name} (${i.measure})` : i.name)),
          })),
        );
      }
      default:
        return `Unknown command ${name}`;
    }
  }

  function closeListManager() {
    setListsOpen(false);
    setEditingList(null);
    setConfirmingDelete(null);
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
            <button type="button" className="share-btn" onClick={() => handleShare()}>
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
              <button type="button" className="share-btn" onClick={() => handleShare()}>
                Share
              </button>
            </div>
          </div>

          {listsOpen && (
              <section className="list-sheet inline" id="list-manager" aria-label="Manage lists">
                <div className="list-sheet-head">
                  <h2>My lists</h2>
                  <button type="button" className="ghost-btn small" onClick={handleNewList}>
                    + New list
                  </button>
                  <button type="button" className="sheet-close" aria-label="Close" onClick={closeListManager}>
                    ×
                  </button>
                </div>

                <ul className="manage-list">
                  {lists.map((list) => {
                    const isOwner = list.owner_id === user.id;
                    const isCurrent = list.id === currentListId;
                    const isEditing = editingList?.id === list.id;
                    const isConfirming = confirmingDelete === list.id;
                    return (
                      <li key={list.id} className={isCurrent ? 'manage-row current' : 'manage-row'}>
                        {isEditing ? (
                          <form
                            className="manage-edit"
                            onSubmit={(event) => {
                              event.preventDefault();
                              saveListName();
                            }}
                          >
                            <input
                              type="text"
                              value={editingList.name}
                              onChange={(event) => setEditingList({ ...editingList, name: event.target.value })}
                              aria-label="List name"
                              autoFocus
                            />
                            <button type="submit" className="mini-btn save">
                              Save
                            </button>
                            <button type="button" className="mini-btn" onClick={() => setEditingList(null)}>
                              Cancel
                            </button>
                          </form>
                        ) : isConfirming ? (
                          <div className="manage-confirm">
                            <span>
                              {isOwner
                                ? `Delete “${list.name}” and all its items for everyone?`
                                : `Leave “${list.name}”? You’ll need a new invite to rejoin.`}
                            </span>
                            <div className="manage-actions">
                              <button type="button" className="mini-btn danger" onClick={() => removeList(list)}>
                                {isOwner ? 'Delete' : 'Leave'}
                              </button>
                              <button type="button" className="mini-btn" onClick={() => setConfirmingDelete(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="manage-name"
                              onClick={() => {
                                setCurrentListId(list.id);
                                closeListManager();
                              }}
                            >
                              <strong>{list.name}</strong>
                              <small>
                                {isCurrent ? 'Open now' : 'Tap to open'}
                                {isOwner ? '' : ' · shared with you'}
                              </small>
                            </button>
                            <div className="manage-actions">
                              {isOwner && (
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={() => {
                                    setConfirmingDelete(null);
                                    setEditingList({ id: list.id, name: list.name });
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                              <button type="button" className="mini-btn" onClick={() => handleShare(list)}>
                                Share
                              </button>
                              <button
                                type="button"
                                className="mini-btn danger"
                                onClick={() => {
                                  setEditingList(null);
                                  setConfirmingDelete(list.id);
                                }}
                              >
                                {isOwner ? 'Delete' : 'Leave'}
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
          )}

          {recipesOpen && (
            <Recipes
              lists={lists}
              currentListId={currentListId}
              onAdd={addRecipeIngredients}
              onClose={() => setRecipesOpen(false)}
            />
          )}

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

          {addStep !== 'idle' && (
            <div className="add-flow">
              <div className="flow-steps" aria-hidden="true">
                {['store', 'person', 'list'].map((step, i) => (
                  <span
                    key={step}
                    className={
                      step === addStep
                        ? 'flow-dot active'
                        : ['store', 'person', 'list'].indexOf(addStep) > i
                          ? 'flow-dot done'
                          : 'flow-dot'
                    }
                  />
                ))}
              </div>

              {addStep === 'store' && (
                <>
                  <label className="flow-label" htmlFor="flow-store">
                    Which store is “{pendingItem}” for? <span className="flow-hint">(optional)</span>
                  </label>
                  <div className="flow-row">
                    <input
                      id="flow-store"
                      type="text"
                      list="store-suggestions"
                      value={pendingStore}
                      onChange={(event) => setPendingStore(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          setAddStep('person');
                        }
                      }}
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
                    <button type="button" className="next-btn" onClick={cancelAddFlow}>
                      Cancel
                    </button>
                    <button type="button" className="next-btn primary" onClick={() => setAddStep('person')}>
                      Next
                    </button>
                  </div>
                </>
              )}

              {addStep === 'person' && (
                <>
                  <label className="flow-label" htmlFor="flow-person">
                    Who is “{pendingItem}” for?
                  </label>
                  <div className="chip-group flow-chips">
                    {Array.from(new Set([myName, ...members.map((m) => m.display_name)].filter(Boolean))).map(
                      (name) => (
                        <button
                          key={name}
                          type="button"
                          className={pendingPerson === name ? 'chip active' : 'chip'}
                          onClick={() => setPendingPerson(name)}
                        >
                          {name}
                          {name === myName ? ' (me)' : ''}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="flow-row">
                    <input
                      id="flow-person"
                      type="text"
                      value={pendingPerson}
                      onChange={(event) => setPendingPerson(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          setAddStep('list');
                        }
                      }}
                      placeholder="Or type a name"
                    />
                    <button type="button" className="next-btn" onClick={() => setAddStep('store')}>
                      Back
                    </button>
                    <button type="button" className="next-btn primary" onClick={() => setAddStep('list')}>
                      Next
                    </button>
                  </div>
                </>
              )}

              {addStep === 'list' && (
                <>
                  <span className="flow-label">Which list should “{pendingItem}” go on?</span>
                  <div className="chip-group flow-chips">
                    {lists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        className={pendingListId === list.id ? 'chip active' : 'chip'}
                        onClick={() => setPendingListId(list.id)}
                      >
                        {list.name}
                      </button>
                    ))}
                  </div>
                  <div className="flow-row flow-row-end">
                    <button type="button" className="next-btn" onClick={() => setAddStep('person')}>
                      Back
                    </button>
                    <button type="button" className="next-btn primary" onClick={submitAddedItem}>
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
              <button
                type="button"
                className={`check-btn${unassignedCount ? ' warn' : ''}${checkMode ? ' active' : ''}`}
                aria-pressed={checkMode}
                onClick={() => setCheckMode((value) => !value)}
                title="Show items missing a store or a person"
              >
                {checkMode
                  ? 'Show all'
                  : unassignedCount
                    ? `Check assignments · ${unassignedCount}`
                    : 'All assigned ✓'}
              </button>
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
                  .filter((item) => (checkMode ? item.status === 'needed' && missingFor(item).length > 0 : true))
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
                          {[
                            item.qty > 1 ? `×${item.qty}` : '',
                            item.store,
                            personOf(item) && `for ${personOf(item)}`,
                            item.added_by_name && `added by ${item.added_by_name}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                        {item.status === 'needed' && missingFor(item).length > 0 && (
                          <span className="missing-tags">
                            {missingFor(item).map((m) => (
                              <span key={m} className="missing-tag">
                                {m === 'store' ? 'No store' : 'No person'}
                              </span>
                            ))}
                          </span>
                        )}
                        {assignEditor?.id === item.id && (
                          <div className="assign-editor">
                            <label>
                              Store
                              <input
                                type="text"
                                list="store-suggestions-assign"
                                value={assignEditor.store}
                                onChange={(e) => setAssignEditor({ ...assignEditor, store: e.target.value })}
                                placeholder="Store name"
                                autoFocus
                              />
                            </label>
                            <datalist id="store-suggestions-assign">
                              {storeOptions
                                .filter((st) => st !== 'All')
                                .map((st) => (
                                  <option key={st} value={st} />
                                ))}
                            </datalist>
                            <span className="assign-label">For</span>
                            <div className="chip-group">
                              {Array.from(
                                new Set([myName, ...members.map((m) => m.display_name)].filter(Boolean)),
                              ).map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  className={assignEditor.person === name ? 'chip active' : 'chip'}
                                  onClick={() => setAssignEditor({ ...assignEditor, person: name })}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              value={assignEditor.person}
                              onChange={(e) => setAssignEditor({ ...assignEditor, person: e.target.value })}
                              placeholder="Or type a name"
                              aria-label="Who it's for"
                            />
                            <span className="assign-label">List</span>
                            <div className="chip-group">
                              {lists.map((list) => (
                                <button
                                  key={list.id}
                                  type="button"
                                  className={assignEditor.listId === list.id ? 'chip active' : 'chip'}
                                  onClick={() => setAssignEditor({ ...assignEditor, listId: list.id })}
                                >
                                  {list.name}
                                </button>
                              ))}
                            </div>
                            <div className="assign-buttons">
                              <button type="button" className="next-btn" onClick={() => setAssignEditor(null)}>
                                Cancel
                              </button>
                              <button type="button" className="next-btn primary" onClick={saveAssignment}>
                                Save
                              </button>
                            </div>
                          </div>
                        )}
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
                          className={
                            item.status === 'needed' && missingFor(item).length > 0 ? 'mini-btn assign warn' : 'mini-btn assign'
                          }
                          onClick={() =>
                            assignEditor?.id === item.id
                              ? setAssignEditor(null)
                              : setAssignEditor({
                                  id: item.id,
                                  store: item.store || '',
                                  person: personOf(item) || myName,
                                  listId: item.list_id || currentListId,
                                })
                          }
                        >
                          Assign
                        </button>
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
        <button
          type="button"
          className={listsOpen ? 'bottom-tab active' : 'bottom-tab'}
          aria-expanded={listsOpen}
          onClick={() => {
            if (listsOpen) {
              closeListManager();
              return;
            }
            setListsOpen(true);
            setRecipesOpen(false);
            requestAnimationFrame(() =>
              document.getElementById('list-manager')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            );
          }}
        >
          <span>Lists</span>
        </button>
        <button
          type="button"
          className={recipesOpen ? 'bottom-tab active' : 'bottom-tab'}
          aria-expanded={recipesOpen}
          onClick={() => {
            if (recipesOpen) {
              setRecipesOpen(false);
              return;
            }
            closeListManager();
            setRecipesOpen(true);
            requestAnimationFrame(() =>
              document.getElementById('recipes-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            );
          }}
        >
          <span>Recipes</span>
        </button>
      </nav>


      <Assistant getContext={assistantContext} runTool={runAssistantTool} />

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
