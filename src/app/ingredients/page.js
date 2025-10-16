import IngredientsList from "@/components/IngredientsList";
import Link from "next/link";

export default function IngredientsPage() {
  return (
    <div className="page">
      <main className="main">
        <div className="title">Ingredients</div>
        <IngredientsList />
      </main>
    </div>
  );
}
