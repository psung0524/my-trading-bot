import type { InstagramBody } from "@/lib/schemas/content";
import { CardFrame } from "@/server/render/cardnews/card-frame";

export function InstagramPreview({ body, brandName, scale = 0.25 }: { body: InstagramBody; brandName: string; scale?: number }) {
  const w = body.size.width * scale;
  const h = body.size.height * scale;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {body.cards.map((card, i) => (
          <div key={card.id || i} className="overflow-hidden rounded-md border" style={{ width: w, height: h }}>
            <div style={{ width: body.size.width, height: body.size.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <CardFrame card={card} index={i} total={body.cards.length} template={body.template} colors={body.colors ?? { primary: "#0F766E", secondary: "#F0FDFA", accent: "#F59E0B" }} brandName={brandName} size={body.size} />
            </div>
          </div>
        ))}
      </div>
      <div className="text-sm">
        <p className="whitespace-pre-wrap">{body.caption}</p>
        <p className="mt-1 text-primary">{body.hashtags.join(" ")}</p>
      </div>
    </div>
  );
}
