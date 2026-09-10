import type { Chapter } from "../content/schema";

export function Bag({ chapter, bag, justPicked }: { chapter: Chapter; bag: string[]; justPicked: string | null }) {
  const slots = chapter.items.length;
  return (
    <div className="flex items-center justify-center gap-3" aria-label="Nell's bag">
      {Array.from({ length: slots }).map((_, i) => {
        const id = bag[i];
        const item = id ? chapter.items.find((it) => it.id === id) : undefined;
        return (
          <div
            key={i}
            className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/15 bg-white/8 text-4xl md:h-20 md:w-20 md:text-5xl"
          >
            {item && (
              <span className={justPicked === id ? "item-settle" : ""} title={item.label}>
                {item.emoji}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
