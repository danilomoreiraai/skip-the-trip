import type { Bathroom } from "../domain/bathroom";

const categoryIcons: Record<Bathroom["category"], string> = {
  Female: "bathroom-female.png",
  Male: "bathroom-male.png",
  Accessible: "bathroom-accessible.png",
};

export function BathroomIcon({ category }: { category: Bathroom["category"] }) {
  return (
    <img
      className="bathroom-icon"
      src={`${import.meta.env.BASE_URL}assets/${categoryIcons[category]}`}
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
    />
  );
}
