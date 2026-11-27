# مختبر الدوائر الإلكترونية الافتراضي · Virtual Electronic Circuits Laboratory

An interactive, photo-referenced 2D replica of the **University of Mosul – College of Engineering electronic circuits laboratory** bench: the KL-21001 Linear Circuit Lab trainer with its KL-23001/23002/23003 experiment modules, the FNIRSI-1013D tablet oscilloscope and two Pro'sKit MT-1232 multimeters, seen from the front as one flat, zoomable drawing. The bench holds only what an experiment uses: the trainer with its module, the oscilloscope, the multimeters and the cords and probes.

The three instruments are modelled from the lab's own photographs:

* **KL-21001** – panel layout measured in millimetres from a perspective-rectified photo (homography of the panel's black border): KL-DVM-6005A digital meter with its two yellow range switches, four moving-coil meters (+20 V, 100 mA/1 A, 15 V~, 100 mA~/1 A~), function generator (GND / OUTPUT 50 Ω, 10 Hz–100 kHz in 4 ranges), speaker, 9-0-9 V AC, fixed ±5 V/±12 V with the GND bus, ±3–18 V adjustable supply, VR1–VR4 (VR3's knob is missing on this bench, so its bare knurled shaft is shown), coloured socket collars as fitted.
* **FNIRSI-1013D** – 184 × 124 × 25 mm body (white front frame, dark rear shell, edge-to-edge black glass), 7" 800 × 480 screen with the firmware layout of the photographed unit: 14 × 8 divisions, header bar, soft keys and measurement boxes.
* **Pro'sKit MT-1232** (two of them, numbered 1 and 2, so an experiment can read two currents at once) – 74 × 145 mm in its teal holster, 4000-count LCD with tall digits, SELECT / HOLD / backlight keys, rotary selector and 10A · COM · VΩmA inputs.

All instrument readings come from a **real numerical circuit simulation** of what is wired on the bench — there are no pre-recorded waveforms.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run test:sim   # solver checks against textbook results
npx tsx scripts/exp-test.ts   # simulates every experiment step's reference wiring
```

## The 2D bench

* Every printed face — the KL-21001 panel, the module boards, the meter scales, the instrument fronts — is drawn once with the canvas API and replayed into **SVG** (`src/draw/svgctx.ts`), so the print stays sharp at any zoom and costs no GPU. There is no 3D engine to download: the page loads in about a second.
* Drag to move around, pinch or wheel to zoom, **double-tap** the bench to zoom to that spot (again to zoom out). The view chips (Whole bench, Meters, Board, Generator, Supplies, VR1–VR4, Scope, Multimeters) frame a part of the bench in portrait or landscape.
* On phones the interface shrinks to one bar at the top (rarely used buttons under ⋯), a line of live readings, and the view chips with the bench controls at the bottom.

## Variable resistors

The KL-23001, KL-23002 and KL-23003 boards are laid out from photographs of the real K&H modules: every socket, symbol, label and dashed block border sits where it is on the board (src/lab/modules, mapped through the corner screws in photo.ts), with the DIP-switch cap, relay K1, push button S1 and the LEDs standing on top. The variable resistors are the KL-21001's VR1 (1KΩ), VR2 (10KΩ), VR3 (100KΩ) and VR4 (1MΩ): a board prints the VR symbol with its A / B / C sockets and you patch the trainer's VR into them with cords — e.g. Exp. 1 uses VR2 in block a of the KL-23001. The only on-board trimmer is R6 of the KL-23002 voltage multiplier.

## What you can do

* **Move around the bench** – drag to pan, wheel / pinch to zoom, double-tap a spot to zoom to it. Views: Whole bench, Meters, Board, Generator, Supplies, VR1–VR4, Scope, Multimeters.
* **Wire circuits** – tap a socket, then another socket. Neighbouring sockets on a module get a short-circuit clip, everything else a banana-plug patch cord in the selected colour. Tap a cord to select it; its red ✕ (or Delete) removes it.
* **Use the instruments** – tap a scope probe, ground clip or multimeter pen to pick it up, then tap a socket to clip it on (a scope's ground clip hangs from its probe). Turn knobs by dragging up/down or with the wheel, or tap one for a large control with the exact value. Each multimeter has its own function dial. Power switch on the right side of the KL-21001.
* **FNIRSI oscilloscope** – the screen is a touch screen: RUN/STOP, AUTO SET, T/V cursors, MEASURE, SAVE PIC (PNG), SAVE WAVE (CSV); CTRL (or clicking the screen) opens the full control panel (V/div, coupling AC/DC/GND, position, time/div, trigger source/edge/level/mode auto-normal-single). Measurements: Vpp, Vmax, Vmin, Vavg, Vrms, frequency, period.
* **Experiments** – Exp. 1–6 of the 2026-2027 manual (diode test & characteristics, clippers & clampers, rectifiers, BJT characteristics, CE amplifiers, CB / switch / cascade) plus RC / RL integrator and differentiator circuits on block d of the KL-23002. Each step has instructions in Arabic and English, a “show me” auto-wiring, an electrical **wiring checker**, results tables you can fill with live readings, and plots.
* **Custom circuits** – insert the universal breadboard module and place resistors, capacitors, inductors, diodes, Zeners, LEDs and transistors from the parts tray.
* **Save** – the bench, instrument settings and result tables persist in the browser; named saves can be exported/imported as JSON.
* **Real consequences** – supplies fold back into current limit on a short (the DC meter collapses to 0 V); a part dissipating above its rating smokes and, if left, burns out (open circuit, scorch mark) until you press *Replace*.
* **Hear it** – wire a signal to the trainer's SPEAKER sockets and you hear the simulated voltage (clipping, rectification… all audible). Plugs, clips, knobs, switches and the scope have synthesised foley.
* **Beyond reality** – *X-ray* shows the live voltage on every connected socket; *Guide me* puts a pulsing ring and arrow on the exact sockets of the next connection with a ghost cord; Ctrl+Z / Ctrl+Y undo/redo the wiring.

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
src/draw/           printed faces as canvas-API drawings (panel, boards, meter scales, instrument
                    fronts, 7-segment digits) and svgctx.ts, which records them as SVG
src/bench2d/        the 2D bench: layout in mm, pan / pinch / double-tap viewport, trainer
                    sockets / knobs / meters, module board, scope, two multimeters, cords, guide
src/audio/          Web Audio foley, ambience and the simulated loudspeaker
src/ui/             floating UI (Arabic RTL / English)
```

Adding a module or experiment only needs data: describe the board in `src/lab/modules/` (socket coordinates, printed traces, parts with models) — the printed artwork, sockets and netlist are generated from it — and add steps to `src/lab/experiments.ts`.
