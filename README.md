# Touch Onomatopoeia — さわって おぼえる

A touch-based web app that teaches English speakers Japanese **texture onomatopoeia** (擬態語).
Each word is its own physics toy: you learn the word by feeling what it describes.

| Word | What you do |
| --- | --- |
| ふわふわ fuwa-fuwa | Lift cotton puffs and let go. They drift down slowly. Tap one to squish it. |
| つるつる tsuru-tsuru | Fling things across a wooden floor and onto ice. On the ice they glide and keep going. |
| もちもち mochi-mochi | Pinch a mochi and pull. It stretches a long way, then slowly comes back. |
| ぷるぷる puru-puru | Poke a pudding or shake its plate. It jiggles. |
| どろどろ doro-doro | Stir thick mud and pour it. It piles up and oozes. |
| しゃばしゃば shaba-shaba | Stir watery curry. It splashes and spreads flat right away. |
| ねちょねちょ necho-necho | Touch slime and pull away. It stretches into sticky strings and sticks to the walls. |
| ざらざら zara-zara | Rub sandpaper. A zoomed cross-section shows your finger catching on the bumps. |
| さらさら sara-sara | Scoop up dry sand and let it slip through your fingers. |
| ぷちぷち puchi-puchi | Pop bubble wrap. |

Each scene also includes:
- the meaning in English and a note on nuance (pleasant or unpleasant)
- an example sentence. Tap it, or tap the word, to hear it read aloud in Japanese (browser speech synthesis).
- sound effects synthesized with the Web Audio API, plus vibration on Android
- the onomatopoeia popping up as text (ぷちっ, もちっ, つるーっ …) wherever things happen

## Run it

It is plain HTML/JS/Canvas. There is no build step and nothing to install.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

You can also open `index.html` directly, or publish the repo with GitHub Pages
(Settings → Pages → Deploy from branch). Link to a single word with a hash, for example `index.html#mochimochi`.

## How it works

- `js/fluid.js`: a particle fluid (Clavet et al. 2005, double-density relaxation) with viscosity,
  velocity smoothing, viscoelastic springs and sticky walls. The same engine drives どろどろ, しゃばしゃば
  and ねちょねちょ; only the parameters differ. A metaball renderer draws the particles as a shaded liquid.
- `js/softbody.js`: a position-based soft body (edge lengths, area preservation and shape matching).
  With weak shape matching, plastic edges and heavy damping it behaves like もちもち. With stiff shape
  matching and light damping it behaves like ぷるぷる.
- `js/scenes/*.js`: one file per scene. To add a word, call `SCENES.push({...})` with a `create(w, h)` that
  returns an object with `update(dt)`, `draw(ctx)` and pointer handlers `down/move/up`.
- `js/audio.js`: synthesized sound (noise bursts, tones, continuous loops), Japanese speech and vibration.
