import { useEffect, useState } from "react";
import { mediaFor } from "../media/mediaMap";

type Mode = "video" | "image" | "none";

export function SceneMedia({ scene }: { scene: string }) {
  const media = mediaFor(scene);
  const [mode, setMode] = useState<Mode>(media.video ? "video" : media.image ? "image" : "none");

  useEffect(() => {
    const m = mediaFor(scene);
    setMode(m.video ? "video" : m.image ? "image" : "none");
  }, [scene]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-navy" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,#1a2b5e_0%,#0b1530_55%,#060c1f_100%)]" />
      {mode === "video" && media.video && (
        <video
          key={media.video}
          className="absolute inset-0 h-full w-full object-cover"
          src={media.video}
          poster={media.image}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setMode(media.image ? "image" : "none")}
        />
      )}
      {mode === "image" && media.image && (
        <img
          key={media.image}
          className="scene-pan absolute inset-0 h-full w-full object-cover"
          src={media.image}
          alt=""
          onError={() => setMode("none")}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-navy-deep via-navy-deep/85 to-transparent" />
    </div>
  );
}
