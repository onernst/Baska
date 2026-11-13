const API_BASE = '/api';

let authToken = localStorage.getItem('authToken');

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

export async function fetchItems() {
  const response = await fetch(`${API_BASE}/items`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch items');
  return response.json();
}

export async function createItem(item) {
  const response = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error('Failed to create item');
  return response.json();
}

export async function updateItem(id, item) {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error('Failed to update item');
  return response.json();
}

export async function deleteItem(id) {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete item');
  return response.json();
}

export async function toggleItemDone(id) {
  const response = await fetch(`${API_BASE}/items/${id}/toggle`, {
    method: 'PATCH',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to toggle item');
  return response.json();
}

export async function fetchStores() {
  const response = await fetch(`${API_BASE}/stores`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch stores');
  return response.json();
}

export async function createStore(name) {
  const response = await fetch(`${API_BASE}/stores`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Failed to create store');
  return response.json();
}

export async function deleteStore(id) {
  const response = await fetch(`${API_BASE}/stores/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete store');
  return response.json();
}
