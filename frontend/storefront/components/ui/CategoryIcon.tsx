import { Dumbbell, Gem, Headphones, Lamp, Sofa, Sparkles, ToyBrick } from "lucide-react";
import type { CategoryId } from "@store/lib/catalog";

const map = {
  "home-living": Sofa,
  "home-decor": Lamp,
  beauty: Sparkles,
  tech: Headphones,
  fashion: Gem,
  fitness: Dumbbell,
  kids: ToyBrick,
} satisfies Record<CategoryId, unknown>;

export function CategoryIcon({ id, size = 18 }: { id: CategoryId; size?: number }) {
  const Icon = map[id];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}
