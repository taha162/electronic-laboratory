# مختبر الدوائر الإلكترونية الافتراضي · Virtual Electronic Circuits Laboratory

An interactive, photo-referenced 3D replica of the **University of Mosul – College of Engineering electronic circuits laboratory**: the KL-21001 Linear Circuit Lab trainer with its KL-23001/23002/23003 experiment modules, the FNIRSI tablet oscilloscope and a digital multimeter, on the same white bench in front of the beige vertical blinds.

All instrument readings come from a **real numerical circuit simulation** of what is wired on the bench — there are no pre-recorded waveforms.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run test:sim   # solver checks against textbook results
npx tsx scripts/exp-test.ts   # simulates every experiment step's reference wiring
```

## What you can do

* **Sit at the bench or walk around the room** – *Experiment* mode seats you in front of the trainer; *Explore* mode lets you walk (W A S D / arrows, Q/E up-down, Shift faster). Drag to look, wheel to lean in (zooms toward the cursor), right-drag to pan. Camera presets: seat, module, generator, supplies, scope, multimeter, room.
* **Wire circuits** – click a socket, then another socket. Neighbouring sockets on a module get a short-circuit clip, everything else a banana-plug patch cord in the selected colour. Click a cord to select it; Delete / double-click / right-click removes it.
* **Use the instruments** – click a scope probe, ground clip or multimeter pen to pick it up, then click a socket to clip it on. Turn knobs by dragging or with the wheel (Shift = fine). Power switch on the right side of the KL-21001.
* **FNIRSI oscilloscope** – the 3D screen is a touch screen: RUN/STOP, AUTO SET, T/V cursors, MEASURE, SAVE PIC (PNG), SAVE WAVE (CSV); CTRL (or clicking the screen) opens the full control panel (V/div, coupling AC/DC/GND, position, time/div, trigger source/edge/level/mode auto-normal-single). Measurements: Vpp, Vmax, Vmin, Vavg, Vrms, frequency, period.
* **Experiments** – Exp. 1–6 of the 2026-2027 manual (diode test & characteristics, clippers & clampers, rectifiers, BJT characteristics, CE amplifiers, CB / switch / cascade) plus RC/RLC and op-amp circuits. Each step has instructions in Arabic and English, a “show me” auto-wiring, an electrical **wiring checker**, results tables you can fill with live readings, and plots.
* **Custom circuits** – insert the universal breadboard module and place resistors, capacitors, inductors, diodes, Zeners, LEDs and transistors from the parts tray.
* **Save** – the bench, instrument settings and result tables persist in the browser; named saves can be exported/imported as JSON.

## Architecture

```
src/sim/            MNA circuit solver (pure TypeScript, runs in a Web Worker)
  solver.ts         Newton-Raphson + SPICE-style junction limiting, trapezoidal/BE companion
                    models, DC operating point with gmin/source stepping
  models.ts         1N4001/1N4148/1N34A/Zener/LED, 2N3904/C1815/2N2904/2N3906, uA741
  measure.ts        DSO-style measurements
src/lab/
  trainer.ts        KL-21001 panel layout (mm): jacks, knobs, meters, sources
  modules/          experiment boards as data (sockets, printed traces, parts)
  netlist.ts        bench → circuit (union-find of traces / cords / leads, island pruning)
  simController.ts  schedules simulations, derives meter readings
  experiments.ts    experiment steps, reference wiring, result tables
src/scope/          FNIRSI screen renderer, trigger/acquisition, AUTO SET
src/three/          React-Three-Fiber scene: room, trainer, module plate, scope, DMM,
                    cables, camera rig; procedural canvas textures for all artwork
src/ui/             floating UI (Arabic RTL / English)
```

Adding a module or experiment only needs data: describe the board in `src/lab/modules/` (socket coordinates, printed traces, parts with models) — the printed artwork, 3D sockets and netlist are generated from it — and add steps to `src/lab/experiments.ts`.
