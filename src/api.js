// Baska data layer, backed by Supabase (database + sign-in + live updates).
import { supabase } from './supabase';

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---- Accounts -------------------------------------------------------------

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signUp({ name, email, password }) {
  const data = check(
    await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    }),
  );
  return data.session;
}

export async function signIn({ email, password }) {
  return check(await supabase.auth.signInWithPassword({ email, password })).session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function fetchMyName(userId) {
  const data = check(
    await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
  );
  return data?.display_name || '';
}

// ---- Lists ----------------------------------------------------------------

export async function fetchLists() {
  return check(
    await supabase.from('lists').select('id, name, owner_id, share_code, created_at').order('created_at'),
  );
}

export async function createList(name) {
  return check(await supabase.rpc('create_list', { p_name: name }));
}

export async function joinList(code) {
  return check(await supabase.rpc('join_list', { p_code: code }));
}

export async function fetchMembers(listId) {
  const rows = check(
    await supabase.from('list_members').select('user_id').eq('list_id', listId),
  );
  const ids = rows.map((row) => row.user_id);
  if (ids.length === 0) return [];
  return check(await supabase.from('profiles').select('id, display_name').in('id', ids));
}

export function shareLinkFor(list) {
  return `${window.location.origin}${import.meta.env.BASE_URL}?join=${list.share_code}`;
}

// ---- Items ----------------------------------------------------------------

export async function fetchItems(listId) {
  return check(
    await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: false }),
  );
}

export async function createItem(listId, { name, qty = 1, store = '', note = '' }) {
  return check(
    await supabase
      .from('items')
      .insert({ list_id: listId, name, qty, store, note })
      .select()
      .single(),
  );
}

export async function setItemStatus(id, status, statusNote = '') {
  return check(
    await supabase
      .from('items')
      .update({ status, status_note: statusNote })
      .eq('id', id)
      .select()
      .single(),
  );
}

export async function deleteItem(id) {
  check(await supabase.from('items').delete().eq('id', id));
}

// Calls onChange whenever anyone adds, updates or removes an item in this list.
export function subscribeToList(listId, onChange) {
  const channel = supabase
    .channel(`list-${listId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` },
      onChange,
    )
    // Supabase can't filter delete events by list, so listen to all deletes
    // and let the app ignore ones that aren't in its current list.
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
