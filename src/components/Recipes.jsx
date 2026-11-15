import { useState } from 'react';
import { searchRecipes } from '../recipes';

export default function Recipes({ lists, currentListId, onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // selected recipe
  const [picked, setPicked] = useState({}); // ingredient index -> bool
  const [listId, setListId] = useState(currentListId);
  const [showSteps, setShowSteps] = useState(false);
  const [adding, setAdding] = useState(false);

  async function runSearch(event) {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setOpen(null);
    try {
      setResults(await searchRecipes(query));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openRecipe(recipe) {
    setOpen(recipe);
    setPicked(Object.fromEntries(recipe.ingredients.map((_, i) => [i, true])));
    setListId(currentListId);
    setShowSteps(false);
  }

  async function addPicked() {
    const chosen = open.ingredients.filter((_, i) => picked[i]);
    if (!chosen.length) return;
    setAdding(true);
    try {
      await onAdd(chosen, listId, open.name);
      setOpen(null);
    } finally {
      setAdding(false);
    }
  }

  const pickedCount = open ? open.ingredients.filter((_, i) => picked[i]).length : 0;

  return (
    <section className="list-sheet inline recipes" id="recipes-panel" aria-label="Recipes">
      <div className="list-sheet-head">
        <h2>{open ? open.name : 'Recipes'}</h2>
        {open && (
          <button type="button" className="ghost-btn small" onClick={() => setOpen(null)}>
            ← Results
          </button>
        )}
        <button type="button" className="sheet-close" aria-label="Close recipes" onClick={onClose}>
          ×
        </button>
      </div>

      {!open && (
        <>
          <form className="recipe-search" onSubmit={runSearch}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a dish, e.g. jerk chicken, lasagna"
              aria-label="Search recipes"
              autoFocus
            />
            <button type="submit" className="next-btn primary" disabled={loading}>
              {loading ? '…' : 'Search'}
            </button>
          </form>
          {error && <p className="recipe-note error">{error}</p>}
          {results && results.length === 0 && (
            <p className="recipe-note">No recipes found. Try a simpler word, like “chicken”.</p>
          )}
          {results && results.length > 0 && (
            <ul className="recipe-grid">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" className="recipe-card" onClick={() => openRecipe(r)}>
                    {r.image && <img src={`${r.image}/small`} alt="" loading="lazy" />}
                    <strong>{r.name}</strong>
                    <small>{[r.area, r.category].filter(Boolean).join(' · ')}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {open && (
        <div className="recipe-detail">
          {open.image && <img className="recipe-hero" src={`${open.image}/medium`} alt="" />}
          <div className="recipe-ingredients-head">
            <span>
              {open.ingredients.length} ingredients · {pickedCount} selected
            </span>
            <button
              type="button"
              className="mini-btn"
              onClick={() =>
                setPicked(
                  Object.fromEntries(open.ingredients.map((_, i) => [i, pickedCount !== open.ingredients.length])),
                )
              }
            >
              {pickedCount === open.ingredients.length ? 'Select none' : 'Select all'}
            </button>
          </div>
          <ul className="recipe-ingredients">
            {open.ingredients.map((ing, i) => (
              <li key={`${ing.name}-${i}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!picked[i]}
                    onChange={() => setPicked({ ...picked, [i]: !picked[i] })}
                  />
                  <span>{ing.name}</span>
                  {ing.measure && <small>{ing.measure}</small>}
                </label>
              </li>
            ))}
          </ul>

          <span className="assign-label">Add to list</span>
          <div className="chip-group">
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                className={listId === l.id ? 'chip active' : 'chip'}
                onClick={() => setListId(l.id)}
              >
                {l.name}
              </button>
            ))}
          </div>
          <div className="assign-buttons">
            <button
              type="button"
              className="next-btn primary"
              disabled={!pickedCount || adding}
              onClick={addPicked}
            >
              {adding ? 'Adding…' : `Add ${pickedCount} to list`}
            </button>
          </div>

          {open.instructions && (
            <div className="recipe-steps">
              <button type="button" className="mini-btn" onClick={() => setShowSteps((v) => !v)}>
                {showSteps ? 'Hide steps' : 'Show cooking steps'}
              </button>
              {showSteps && <p>{open.instructions}</p>}
            </div>
          )}
        </div>
      )}
      <p className="recipe-credit">Recipes from TheMealDB</p>
    </section>
  );
}
