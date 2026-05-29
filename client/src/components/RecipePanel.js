'use client';
import { useState, useEffect, useCallback } from 'react';
import { invApi, invFetch } from '../lib/inventoryBehavior';

const INP = 'h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all';

/**
 * RecipePanel
 * Maps a dish/menu-item to its raw ingredients.
 * Ingredients are deducted from stock automatically when the dish is sold
 * (if the sale item has deduct_recipe: true in item_metadata — set by sales/page.js).
 *
 * Props:
 *   productId  – string product _id (the dish)
 *   dishName   – string (shown in panel header)
 *   inv        – inventoryBehavior config
 */
export default function RecipePanel({ productId, dishName, inv }) {
  const [recipe,    setRecipe]   = useState(null);
  const [loading,   setLoading]  = useState(true);
  const [saving,    setSaving]   = useState(false);
  const [deleting,  setDeleting] = useState(false);
  const [error,     setError]    = useState('');
  const [success,   setSuccess]  = useState('');

  // Ingredient search
  const [query,    setQuery]     = useState('');
  const [results,  setResults]   = useState([]);
  const [searching,setSearching] = useState(false);

  // Editable ingredients list
  const [ingredients, setIngredients] = useState([]);  // [{ ingredient_id, ingredient_name, quantity, unit }]
  const [serving,     setServing]     = useState('1');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invFetch(invApi.getRecipe(productId));
      if (data) {
        setRecipe(data);
        setServing(String(data.serving_quantity || 1));
        setIngredients((data.ingredients || []).map(i => ({
          ingredient_id:   i.ingredient?._id || i.ingredient,
          ingredient_name: i.ingredient?.name || i.ingredient_name || '',
          quantity:        String(i.quantity),
          unit:            i.unit || 'pcs',
        })));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  // Search products to add as ingredients
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    setSearching(true);
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '';
    fetch(`/api/products?search=${encodeURIComponent(query.trim())}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(d => { setResults((d.products || d).slice(0, 8)); setSearching(false); })
      .catch(() => setSearching(false));
    return () => controller.abort();
  }, [query]);

  const addIngredient = (product) => {
    if (ingredients.some(i => i.ingredient_id === product._id)) return;
    setIngredients(prev => [...prev, {
      ingredient_id:   product._id,
      ingredient_name: product.name,
      quantity:        '1',
      unit:            product.unit || 'pcs',
    }]);
    setQuery(''); setResults([]);
  };

  const removeIngredient = (id) => setIngredients(prev => prev.filter(i => i.ingredient_id !== id));
  const updateIngredient = (id, field, val) => setIngredients(prev => prev.map(i => i.ingredient_id === id ? { ...i, [field]: val } : i));

  const handleSave = async () => {
    setError(''); setSuccess('');
    if (ingredients.length === 0) { setError('Add at least one ingredient'); return; }
    const invalid = ingredients.some(i => !i.quantity || Number(i.quantity) <= 0);
    if (invalid) { setError('All ingredient quantities must be > 0'); return; }
    setSaving(true);
    try {
      await invFetch(invApi.saveRecipe(productId, {
        serving_quantity: Number(serving) || 1,
        ingredients: ingredients.map(i => ({
          ingredient_id:   i.ingredient_id,
          ingredient_name: i.ingredient_name,
          quantity:        Number(i.quantity),
          unit:            i.unit,
        })),
      }));
      await load();
      setSuccess('Recipe saved! Ingredients will be deducted when this item is sold.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete recipe? Ingredients will no longer be auto-deducted on sale.')) return;
    setDeleting(true);
    try {
      await invFetch(invApi.deleteRecipe(productId));
      setRecipe(null); setIngredients([]); setServing('1');
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {inv.recipeLabel || 'Recipe'} — {dishName}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ingredients defined here are auto-deducted from stock when this item is sold.
          </p>
        </div>
        {recipe && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="shrink-0 px-3 py-1.5 rounded-xl border-2 border-rose-200 text-rose-600 text-[12px] font-semibold hover:bg-rose-50 disabled:opacity-50 transition-colors"
          >
            {deleting ? '…' : 'Delete Recipe'}
          </button>
        )}
      </div>

      {error   && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700 font-medium">{error}</div>}
      {success && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-700 font-semibold">{success}</div>}

      {loading ? (
        <p className="text-center text-[12px] text-slate-400 py-4">Loading recipe…</p>
      ) : (
        <>
          {/* Serving size */}
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">This recipe makes</p>
            <input
              type="number"
              min="1"
              value={serving}
              onChange={e => setServing(e.target.value)}
              className="h-9 w-20 rounded-xl border-2 border-slate-200 px-2 text-center text-[14px] font-bold text-slate-900 focus:outline-none focus:border-green-600"
            />
            <p className="text-[11px] text-slate-400">serving(s) / batch</p>
          </div>

          {/* Ingredient list */}
          <div className="space-y-2">
            {ingredients.length === 0 ? (
              <p className="text-[12px] text-slate-400 text-center py-3">No ingredients yet. Search below to add.</p>
            ) : (
              ingredients.map(ing => (
                <div key={ing.ingredient_id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="flex-1 text-[13px] font-semibold text-slate-800 truncate">{ing.ingredient_name}</p>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ing.quantity}
                    onChange={e => updateIngredient(ing.ingredient_id, 'quantity', e.target.value)}
                    className="h-8 w-20 rounded-lg border-2 border-slate-200 px-2 text-center text-[13px] font-semibold text-slate-900 focus:outline-none focus:border-green-600"
                  />
                  <select
                    value={ing.unit}
                    onChange={e => updateIngredient(ing.ingredient_id, 'unit', e.target.value)}
                    className="h-8 rounded-lg border-2 border-slate-200 px-1 text-[12px] text-slate-700 focus:outline-none focus:border-green-600 bg-white"
                  >
                    {['pcs', 'kg', 'gram', 'litre', 'ml', 'tsp', 'tbsp', 'cup'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeIngredient(ing.ingredient_id)}
                    className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-600 text-[14px] transition-colors"
                  >✕</button>
                </div>
              ))
            )}
          </div>

          {/* Ingredient search */}
          <div className="relative">
            <input
              className={INP}
              type="text"
              placeholder="Search ingredient to add (e.g. Flour, Tomato, Oil)…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {(searching || results.length > 0) && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {searching ? (
                  <p className="px-4 py-3 text-[12px] text-slate-400">Searching…</p>
                ) : (
                  results.map(p => (
                    <button
                      key={p._id}
                      onClick={() => addIngredient(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-green-50 text-left transition-colors border-b border-slate-50 last:border-0"
                    >
                      <span className="text-[13px] font-semibold text-slate-800">{p.name}</span>
                      <span className="text-[11px] text-slate-400">{p.unit} · Stock: {p.quantity}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 rounded-xl bg-green-600 text-white text-[14px] font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving Recipe…' : 'Save Recipe'}
          </button>
        </>
      )}
    </div>
  );
}
