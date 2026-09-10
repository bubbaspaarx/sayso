# Scene media — prompts and workflow

Nine scenes, one looping background each. These sit BEHIND large text under a
dark gradient, so the job is mood, not narrative. Subtle motion only. Nothing
that competes with the words.

## Where to generate

Stills first, then animate the still. Text-to-video straight from a prompt
drifts too much between scenes; a still locks the look.

**Stills** — any current image model. Generate the first scene, pick the one
you like, then use it as a style reference for the other eight so the world is
consistent. Keep the reference image in `media/ref/`.

**Image-to-video** — as of Sept 2026 the useful options for gentle ambient
motion from a still are Kling 3.0 and Luma Ray3 (both do believable subtle
motion from a reference image); Runway Gen-4.5 has the best control surface
(motion brush lets you animate *only* the lantern flame or *only* the water).
Runway's Standard plan (~$12/mo) now surfaces Kling and Veo inside its own
dashboard, so one subscription covers experimentation. Kling's free daily
credits are fine for iterating before you pay for anything.

Whatever you use: **no faces in the loop.** Face drift is the most common
artefact and a 7-year-old will notice Nell's face going wrong. Nell is
back-to-camera, silhouetted, or absent. Grandma Fen is never shown.

## Global style prefix (prepend to every prompt)

> Children's picture-book illustration, painterly gouache texture, soft edges,
> deep navy night palette with warm amber accents, gentle rim light, cosy
> English garden at night, storybook, no text, no watermark.

## Motion suffix (append to every image-to-video prompt)

> Very subtle ambient motion only. Slow, gentle, looping. Static camera. No
> people moving. 8 seconds.

## Scenes

| scene id | still prompt | motion prompt |
|---|---|---|
| `bedroom-dark` | A child's bedroom at night seen from the pillow, window with curtains half open, beyond the window a dark garden and at the very bottom a small dark greenhouse with no light in it. Moonlight only. | Curtain barely stirs. Moonlight flickers faintly through leaves outside. |
| `grandma-room` | An old woman's bedroom at night, a big wooden bed with a patchwork quilt, a bedside lamp just switched on casting warm amber light, books stacked everywhere, a cat asleep at the foot of the bed. No people. | Lamp glow pulses very slightly as if just warming up. Cat's side rises and falls. |
| `kitchen-night` | A cottage kitchen at night lit by a single bulb, wooden table with a small torch on it, a key hanging on a hook by the window, and an old brass-and-glass lantern by the back door, glass slightly fogged. | Bulb sways almost imperceptibly. Fog on the lantern glass drifts. |
| `hall-night` | A narrow cottage hallway at night, a big armchair with a red wool blanket thrown over it, a pair of small wellington boots by the front door, coats on pegs, faint light from the kitchen behind. | Coat hem sways as if a draught passed. Light from the kitchen flickers softly. |
| `garden-fork` | View from a back doorstep at night: a garden path splitting in two, left path curving toward a moonlit pond, right path toward a dark wooden shed. Cold breath in the air. Stars. | Grass sways. Mist drifts low across both paths. Stars twinkle. |
| `shed-jackdaws` | A dark wooden garden shed at night, five jackdaws on the roof with wings half-spread and eyes catching the moonlight, feathers scattered in the air. Dramatic but not scary. | Feathers drift down. Wings twitch. One jackdaw's eye blinks. |
| `pond-night` | A small garden pond at night, perfectly still water reflecting a full moon, reeds at the edge, a frog on a lily pad, in the far distance a greenhouse with no light. | Single ripple spreads slowly from the frog. Reeds sway. |
| `greenhouse-dark` | Inside a Victorian glass greenhouse at night, all shadows and moonlit panes, and in the centre on a wooden bench a single small plant in a clay pot with its leaves drooping, grey and dull. Sad and quiet. | Dust motes drift in moonlight. Nothing else moves. |
| `greenhouse-glow` | The same greenhouse interior, now lit by a warm brass lantern on the bench and, at the centre, a small plant whose leaves glow soft electric blue from within, light spilling across the glass panes, a red blanket tucked around the pot. Wonder. | Blue glow breathes gently, brightening and dimming on a slow cycle. Lantern flame flickers. Tiny motes of blue light rise from the leaves. |

The two greenhouse scenes are the emotional payoff. Spend most of your credits
there. Generate `greenhouse-dark` first, then make `greenhouse-glow` from the
same still with an edit pass so the room is identical and only the light
changes — that continuity is what makes the ending land.

## Making it loop

Models don't reliably produce seamless loops. Take the 8s clip and cross-fade
its tail into its head:

```bash
ffmpeg -i in.mp4 -filter_complex \
  "[0:v]split[a][b];[a]trim=0:7,setpts=PTS-STARTPTS[a1];[b]trim=7:8,setpts=PTS-STARTPTS[b1];[a1][b1]xfade=transition=fade:duration=1:offset=6[v]" \
  -map "[v]" -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart -crf 26 loop.mp4
```

Then `-vf "scale=1280:-2"` if the file is over ~3MB. Muted, `playsinline`,
`loop`, `autoplay` on the `<video>` tag.

## What to do if the video looks bad

Use the still with a slow CSS pan (`transform: scale(1.08)` over 20s, ease,
alternate). It is 90% as good and costs nothing. Don't let the media block the
test — the thesis is the reading, not the pictures.
