# مختبر الدوائر الإلكترونية الافتراضي · Virtual Electronic Circuits Laboratory

An interactive, photo-referenced 3D replica of the **University of Mosul – College of Engineering electronic circuits laboratory**: the KL-21001 Linear Circuit Lab trainer with its KL-23001/23002/23003 experiment modules, the FNIRSI-1013D tablet oscilloscope and the Pro'sKit MT-1232 multimeter, on the same white bench in front of the beige vertical blinds.

The three instruments are modelled from the lab's own photographs:

* **KL-21001** – panel layout measured in millimetres from a perspective-rectified photo (homography of the panel's black border): KL-DVM-6005A digital meter with its two yellow range switches, four moving-coil meters (+20 V, 100 mA/1 A, 15 V~, 100 mA~/1 A~), function generator (GND / OUTPUT 50 Ω, 10 Hz–100 kHz in 4 ranges), speaker, 9-0-9 V AC, fixed ±5 V/±12 V with the GND bus, ±3–18 V adjustable supply, VR1–VR4 (VR3's knob is missing on this bench, so its bare knurled shaft is shown), coloured socket collars as fitted.
* **FNIRSI-1013D** – 184 × 124 × 25 mm body (white front frame, dark rear shell, edge-to-edge black glass), 7" 800 × 480 screen with the firmware layout of the photographed unit: 14 × 8 divisions, header bar, soft keys and measurement boxes.
* **Pro'sKit MT-1232** – 74 × 145 × 36 mm in its teal holster, 4000-count LCD with tall digits, SELECT / HOLD / backlight keys, rotary selector and 10A · COM · VΩmA inputs.

All instrument readings come from a **real numerical circuit simulation** of what is wired on the bench — there are no pre-recorded waveforms.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run test:sim   # solver checks against textbook results
npx tsx scripts/exp-test.ts   # simulates every experiment step's reference wiring
```

## Phones and tablets

* Phones and tablets start in the **light renderer** automatically (no area lights, no post-processing, shadows refreshed a few times a second); the ◐ button switches quality at any time.
* Each **view** (Seat, Meters, Module, Generator, Supplies, VR1–VR4, Scope, Multimeter) fits its part of the bench to the screen in portrait or landscape, at a steeper angle on a portrait phone so the panel print faces you.
* **Double-tap** anywhere on the bench to zoom straight to that spot; double-tap again to zoom back out. Pinch to zoom, two fingers to pan.
* The interface shrinks to one bar at the top (rarely used buttons under ⋯), a line of live readings, and the view chips with the bench controls at the bottom.

## What you can do

* **Sit at the bench or walk around the room** – *Experiment* mode seats you in front of the trainer; *Explore* mode lets you walk (W A S D / arrows, Q/E up-down, Shift faster). Drag to look, wheel to lean in (zooms toward the cursor), right-drag to pan. Camera presets: seat, module, generator, supplies, scope, multimeter, room.
* **Wire circuits** – click a socket, then another socket. Neighbouring sockets on a module get a short-circuit clip, everything else a banana-plug patch cord in the selected colour. Click a cord to select it; Delete / double-click / right-click removes it.
* **Use the instruments** – click a scope probe, ground clip or multimeter pen to pick it up, then click a socket to clip it on. Turn knobs by dragging or with the wheel (Shift = fine). Power switch on the right side of the KL-21001.
* **FNIRSI oscilloscope** – the 3D screen is a touch screen: RUN/STOP, AUTO SET, T/V cursors, MEASURE, SAVE PIC (PNG), SAVE WAVE (CSV); CTRL (or clicking the screen) opens the full control panel (V/div, coupling AC/DC/GND, position, time/div, trigger source/edge/level/mode auto-normal-single). Measurements: Vpp, Vmax, Vmin, Vavg, Vrms, frequency, period.
* **Experiments** – Exp. 1–6 of the 2026-2027 manual (diode test & characteristics, clippers & clampers, rectifiers, BJT characteristics, CE amplifiers, CB / switch / cascade) plus RC/RLC and op-amp circuits. Each step has instructions in Arabic and English, a “show me” auto-wiring, an electrical **wiring checker**, results tables you can fill with live readings, and plots.
* **Custom circuits** – insert the universal breadboard module and place resistors, capacitors, inductors, diodes, Zeners, LEDs and transistors from the parts tray.
* **Save** – the bench, instrument settings and result tables persist in the browser; named saves can be exported/imported as JSON.
* **Real consequences** – supplies fold back into current limit on a short (the DC meter collapses to 0 V); a part dissipating above its rating smokes and, if left, burns out (open circuit, scorch mark) until you press *Replace*.
* **Hear it** – wire a signal to the trainer's SPEAKER sockets and you hear the simulated voltage (clipping, rectification… all audible). Plugs, clips, knobs, switches and the scope have synthesised foley; the room has its fluorescent-ballast and transformer hum.
* **Beyond reality** – *X-ray* shows the live voltage of every connected node and colours cords by potential; *Guide me* puts a pulsing ring and arrow on the exact sockets of the next connection with a ghost cord; Ctrl+Z / Ctrl+Y undo/redo the wiring.
* **Photo mode** – hides the UI and captures a PNG. The whole scene stays in sharp focus (no depth-of-field blur, grain or haze); a final clarity pass (contrast-adaptive sharpening + dehaze) keeps the panel print crisp.

## Architecture

```
src/sim/            MNA circuit solver (pure TypeScript, runs in a Web Worker)
  solver.ts         Newton-Raphson + SPICE-style junction limiting, trapezoidal/BE companion
                    models, DC operating point with gmin/source stepping, two-stage op-amp
                    macromodel (GBW 1 MHz, slew 0.5 V/µs), per-node and per-part power statistics
  models.ts         1N4001/1N4148/1N34A/Zener/LED, 2N3904/C1815/2N2904/2N3906, uA741
  measure.ts        DSO-style measurements
src/lab/
  trainer.ts        KL-21001 panel layout (mm): jacks, knobs, meters, sources
  modules/          experiment boards as data (sockets, printed traces, parts)
  netlist.ts        bench → circuit (union-find of traces / cords / leads), partitioning into
                    independent sub-circuits so only what you wired is solved
  simController.ts  schedules simulations, derives meter readings
  experiments.ts    experiment steps, reference wiring, result tables
src/scope/          FNIRSI screen renderer, trigger/acquisition, AUTO SET
src/three/          React-Three-Fiber scene: room, trainer, module plate, scope, DMM,
                    cables, camera rig; procedural canvas textures and PBR maps (fBm normal /
                    roughness) for all artwork; AgX tone mapping, N8AO, soft VSM shadows
src/audio/          Web Audio foley, ambience and the simulated loudspeaker
src/ui/             floating UI (Arabic RTL / English)
```

Adding a module or experiment only needs data: describe the board in `src/lab/modules/` (socket coordinates, printed traces, parts with models) — the printed artwork, 3D sockets and netlist are generated from it — and add steps to `src/lab/experiments.ts`.
