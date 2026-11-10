const API_BASE = '/api';

export async function fetchItems() {
  const response = await fetch(`${API_BASE}/items`);
  if (!response.ok) throw new Error('Failed to fetch items');
  return response.json();
}

export async function createItem(item) {
  const response = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error('Failed to create item');
  return response.json();
}

export async function updateItem(id, item) {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error('Failed to update item');
  return response.json();
}

export async function deleteItem(id) {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete item');
  return response.json();
}

export async function toggleItemDone(id) {
  const response = await fetch(`${API_BASE}/items/${id}/toggle`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to toggle item');
  return response.json();
}

export async function fetchStores() {
  const response = await fetch(`${API_BASE}/stores`);
  if (!response.ok) throw new Error('Failed to fetch stores');
  return response.json();
}

export async function createStore(name) {
  const response = await fetch(`${API_BASE}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Failed to create store');
  return response.json();
}

export async function deleteStore(id) {
  const response = await fetch(`${API_BASE}/stores/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete store');
  return response.json();
}
