// Recipe search using TheMealDB's free API (test key "1", fine for personal use).
const BASE = 'https://www.themealdb.com/api/json/v1/1';

function toRecipe(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = (meal[`strIngredient${i}`] || '').trim();
    const measure = (meal[`strMeasure${i}`] || '').trim();
    if (name) ingredients.push({ name, measure });
  }
  return {
    id: meal.idMeal,
    name: meal.strMeal,
    category: meal.strCategory || '',
    area: meal.strArea || '',
    image: meal.strMealThumb || '',
    instructions: (meal.strInstructions || '').trim(),
    ingredients,
  };
}

export async function searchRecipes(query) {
  const q = (query || '').trim();
  if (!q) return [];
  const res = await fetch(`${BASE}/search.php?s=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Recipe search is unavailable right now.');
  const data = await res.json();
  return (data.meals || []).map(toRecipe);
}
