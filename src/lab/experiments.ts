/**
 * University of Mosul — Electronic Circuits Laboratory experiments (2026-2027).
 * Each step carries reference wiring so the bench can be auto-wired or checked.
 */
import type { LeadId, WireColor } from "./types";
import type { DmmMode, ScopeSettings } from "@/store/bench";

export type L10n = { en: string; ar: string };

export interface StepDef {
  title: L10n;
  text: L10n;
  /** [jackA, jackB, color?, kind?] */
  wires?: [string, string, WireColor?, ("wire" | "clip")?][];
  leads?: Partial<Record<LeadId, string | null>>;
  knobs?: Record<string, number>;
  dmmMode?: DmmMode;
  scope?: Partial<Pick<ScopeSettings, "tdiv">> & { ch?: [Partial<ScopeSettings["ch"][0]>, Partial<ScopeSettings["ch"][1]>] };
  /** what to observe */
  expect?: L10n;
}

export interface TableDef {
  id: string;
  title: L10n;
  cols: string[];
  rows: string[];
}

export interface ExperimentDef {
  id: string;
  no: string;
  module: string;
  title: L10n;
  objective: L10n;
  steps: StepDef[];
  tables: TableDef[];
  questions?: L10n[];
}

const fg = (vpp: number) => Math.sqrt(vpp / 20); // amplitude dial for a given Vpp (open circuit)
// frequency dial for 1 kHz on the 1k range
const F1K = { "fg.range": 2, "fg.freq": 0 };

export const EXPERIMENTS: ExperimentDef[] = [
  /* ============================ EXP 1 ============================ */
  {
    id: "ex1",
    no: "1",
    module: "kl23001",
    title: { en: "Diode Test and Characteristics", ar: "فحص الدايود وخواصه" },
    objective: {
      en: "Test diodes with the multimeter, then plot the V-I characteristic of Si, Ge and Zener diodes (block a).",
      ar: "فحص الدايودات بجهاز الملتيميتر ثم رسم منحني الخواص (V-I) لدايود السيليكون والجرمانيوم والزينر (block a).",
    },
    steps: [
      {
        title: { en: "3.1 Diode test mode (forward)", ar: "3.1 وضع فحص الدايود (انحياز أمامي)" },
        text: {
          en: "Set the multimeter dial to ▶| (diode test). Put the red lead on the anode of CR1 and the black (COM) lead on the cathode. Record the reading as Multimeter value 1.",
          ar: "اضبط مفتاح الملتيميتر على ▶| (فحص الدايود). ضع الطرف الأحمر على أنود CR1 والأسود (COM) على الكاثود. سجّل القراءة كقيمة 1.",
        },
        dmmMode: "diode",
        leads: { "dmm.v": "m:a.d1a", "dmm.com": "m:a.d1k" },
        expect: { en: "≈ 0.5 – 0.8 V for silicon.", ar: "حوالي 0.5 – 0.8 فولت للسيليكون." },
      },
      {
        title: { en: "3.1 Diode test mode (reverse)", ar: "3.1 وضع فحص الدايود (انحياز عكسي)" },
        text: {
          en: "Reverse the test leads and record Multimeter value 2. Repeat for CR2 (Ge) and CR3 (Zener) and fill Table 1.1.",
          ar: "اعكس أطراف الفحص وسجّل القيمة 2. كرر لـ CR2 (جرمانيوم) و CR3 (زينر) واملأ الجدول 1.1.",
        },
        dmmMode: "diode",
        leads: { "dmm.v": "m:a.d1k", "dmm.com": "m:a.d1a" },
        expect: { en: "OL — the good diode blocks in reverse.", ar: "OL — الدايود السليم لا يمرر بالاتجاه العكسي." },
      },
      {
        title: { en: "3.2 Forward V-I curve (Si, CR1)", ar: "3.2 منحني الانحياز الأمامي (CR1)" },
        text: {
          en: "Connect +12V to IN. Multimeter on mA (DC) in series: red to OUT, black to CR1 anode. Clip CR1 cathode to GND. DC VOLTAGE meter of the KL-21001 across the diode. Turn the VR1 trimmer on the module so VF takes the values of Table 1.2 and record IF.",
          ar: "وصّل +12V إلى IN. الملتيميتر على mA (DC) على التوالي: الأحمر إلى OUT والأسود إلى أنود CR1. اربط كاثود CR1 بالأرضي. وصّل مقياس الفولتية الرقمي للجهاز على طرفي الدايود. دوّر المقاومة المتغيرة VR1 على اللوحة حتى تصبح VF بقيم الجدول 1.2 وسجّل IF.",
        },
        dmmMode: "dca",
        wires: [
          ["tr:ps.p12", "m:a.in", "red"],
          ["m:a.d1k", "m:a.g1", "black", "clip"],
          ["tr:dvm.v", "m:a.d1a", "yellow"],
          ["tr:dvm.com", "m:a.g1", "black"],
        ],
        leads: { "dmm.v": "m:a.p", "dmm.com": "m:a.d1a" },
        knobs: { "m.vr1": 0.15 },
      },
      {
        title: { en: "3.2 Reverse bias (CR1)", ar: "3.2 الانحياز العكسي (CR1)" },
        text: {
          en: "Turn the supply off, swap the diode: current now enters the cathode and the anode is clipped to GND. Adjust VR1 for the reverse voltages of Table 1.3 and record IR (μA range).",
          ar: "أطفئ المصدر واعكس الدايود: التيار يدخل من الكاثود والأنود مربوط بالأرضي. اضبط VR1 للحصول على فولتيات الجدول 1.3 وسجّل IR.",
        },
        dmmMode: "dca",
        wires: [
          ["tr:ps.p12", "m:a.in", "red"],
          ["m:a.d1a", "m:a.g1", "black"],
          ["tr:dvm.v", "m:a.d1k", "yellow"],
          ["tr:dvm.com", "m:a.g1", "black"],
        ],
        leads: { "dmm.v": "m:a.p", "dmm.com": "m:a.d1k" },
        knobs: { "m.vr1": 0.4 },
      },
      {
        title: { en: "3.3 Zener diode (CR3) characteristic", ar: "3.3 منحني دايود الزينر (CR3)" },
        text: {
          en: "Use the ADJUST POWER V+ output (set near 18 V) on IN. Reverse-bias CR3 (current into its cathode) and sweep VR1 to the values of Table 1.4. Notice VZ stays ≈ 10 V while IZ rises.",
          ar: "استخدم مخرج ADJUST POWER V+ (اضبطه قرب 18V) على IN. اجعل CR3 بانحياز عكسي (التيار يدخل من الكاثود) وغيّر VR1 حسب الجدول 1.4. لاحظ أن VZ تبقى ≈ 10V بينما IZ يزداد.",
        },
        dmmMode: "dca",
        wires: [
          ["tr:adj.vp", "m:a.in", "red"],
          ["m:a.d3a", "m:a.g3", "black", "clip"],
          ["tr:dvm.v", "m:a.d3k", "yellow"],
          ["tr:dvm.com", "m:a.g3", "black"],
        ],
        leads: { "dmm.v": "m:a.p", "dmm.com": "m:a.d3k" },
        knobs: { "adj.v": 1, "m.vr1": 0.9 },
      },
    ],
    tables: [
      { id: "t11", title: { en: "Table 1.1", ar: "الجدول 1.1" }, cols: ["Value 1", "Value 2", "Validity", "Type"], rows: ["CR1", "CR2", "CR3", "LED"] },
      {
        id: "t12",
        title: { en: "Table 1.2 — forward (Si)", ar: "الجدول 1.2 — أمامي" },
        cols: ["VF (V)", "IF (mA)"],
        rows: ["0.1", "0.2", "0.3", "0.4", "0.5", "0.55", "0.6", "0.65", "0.7"],
      },
      { id: "t13", title: { en: "Table 1.3 — reverse", ar: "الجدول 1.3 — عكسي" }, cols: ["VR (V)", "IR (μA)"], rows: ["1", "2", "3", "4", "5"] },
      {
        id: "t14",
        title: { en: "Table 1.4 — Zener", ar: "الجدول 1.4 — زينر" },
        cols: ["Vr (V)", "Ir (mA)"],
        rows: ["3", "5", "7", "10", "11", "11.5", "12", "13", "14"],
      },
    ],
    questions: [
      { en: "Why is the forward drop of a silicon diode ≈ 0.7 V? Compare with your measurement.", ar: "لماذا يكون هبوط الجهد الأمامي لدايود السيليكون ≈ 0.7 فولت؟ قارن مع قياسك." },
      { en: "What happens when the reverse voltage exceeds breakdown?", ar: "ماذا يحدث عندما يتجاوز الجهد العكسي جهد الانهيار؟" },
    ],
  },
  /* ============================ EXP 2 ============================ */
  {
    id: "ex2",
    no: "2",
    module: "kl23001",
    title: { en: "Clipping and Clamping Circuits", ar: "دوائر القطع والمسك (Clipper & Clamper)" },
    objective: {
      en: "Observe series and parallel clippers (block b) and clampers (block d) on the oscilloscope with a 10 Vp-p, 1 kHz input.",
      ar: "مشاهدة دوائر القطع المتوالية والمتوازية (block b) ودوائر المسك (block d) على راسم الإشارة بإشارة دخل 10Vp-p و 1kHz.",
    },
    steps: [
      {
        title: { en: "Adjust the function generator", ar: "ضبط مولد الدوال" },
        text: {
          en: "Connect the generator OUTPUT to CH1 and adjust a 10 Vp-p (= 3.54 Vrms), 1 kHz sine wave. Read VPP and Freq on the FNIRSI screen.",
          ar: "وصّل مخرج المولد إلى CH1 واضبط موجة جيبية 10Vp-p (= 3.54Vrms) بتردد 1kHz. اقرأ VPP و Freq على شاشة FNIRSI.",
        },
        leads: { "osc.ch1": "tr:fg.out", "osc.ch2": null },
        knobs: { "fg.func": 0, "fg.amp": fg(10), ...F1K },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 5, coupling: "DC" }, { vdiv: 5, coupling: "DC" }] },
      },
      {
        title: { en: "2.6.1 Series clipper (a)", ar: "2.6.1 القاطع المتوالي (a)" },
        text: {
          en: "Apply the signal to TP1. Clip CR6 → TP3 and the 10K load R6 to TP3. CH1 on TP1 (input), CH2 on TP3 (output). Draw both.",
          ar: "طبّق الإشارة على TP1. اربط CR6 إلى TP3 ومقاومة الحمل 10K إلى TP3. CH1 على TP1 (الدخل) و CH2 على TP3 (الخرج). ارسم الإشارتين.",
        },
        wires: [
          ["tr:fg.out", "m:b.tp1", "red"],
          ["m:b.j1", "m:b.o1", "red", "clip"],
          ["m:b.j4", "m:b.o1", "red", "clip"],
        ],
        leads: { "osc.ch1": "m:b.tp1", "osc.ch2": "m:b.o3" },
        expect: { en: "Negative half-cycles removed; peak ≈ 5 − 0.7 V.", ar: "تُحذف الأنصاف السالبة؛ القمة ≈ 5 − 0.7 فولت." },
      },
      {
        title: { en: "2.6.1 Series clipper (b) — reversed diode", ar: "2.6.1 القاطع المتوالي (b) — دايود معكوس" },
        text: {
          en: "Turn off, use CR7 (reversed) instead of CR6 and observe TP3 again.",
          ar: "أطفئ الأجهزة واستخدم CR7 (المعكوس) بدل CR6 ثم شاهد TP3.",
        },
        wires: [
          ["tr:fg.out", "m:b.tp1", "red"],
          ["m:b.j2", "m:b.o2", "red", "clip"],
          ["m:b.j4", "m:b.o1", "red", "clip"],
        ],
        leads: { "osc.ch1": "m:b.tp1", "osc.ch2": "m:b.o3" },
        expect: { en: "Positive half-cycles removed.", ar: "تُحذف الأنصاف الموجبة." },
      },
      {
        title: { en: "2.6.2 Parallel clipper with 3 V bias", ar: "2.6.2 القاطع المتوازي مع انحياز 3V" },
        text: {
          en: "Signal to TP2 → R3 (1K) → TP3. CR8 from TP3 to the ADJUST POWER V+ (set to 3 V, knob at min). Observe the output.",
          ar: "الإشارة إلى TP2 ← R3 (1K) ← TP3. الدايود CR8 من TP3 إلى ADJUST POWER V+ (اضبطه على 3V). شاهد الخرج.",
        },
        wires: [
          ["tr:fg.out", "m:b.tp2", "red"],
          ["m:b.j3", "m:b.o3", "red", "clip"],
          ["m:b.o2", "m:b.j5", "blue"],
          ["m:b.j6", "tr:adj.vp", "yellow"],
        ],
        leads: { "osc.ch1": "m:b.tp2", "osc.ch2": "m:b.o1" },
        knobs: { "adj.v": 0 },
        expect: { en: "Output limited to ≈ 3 + 0.6 = 3.6 V.", ar: "الخرج محدد عند ≈ 3.6 فولت." },
      },
      {
        title: { en: "2.6.3 Clamper (a)", ar: "2.6.3 دائرة المسك (a)" },
        text: {
          en: "Block d. Apply a square wave Vp = 5 V, 1 kHz to IN. Connect CR13 between OUT and GND (anode on OUT). Plot the output.",
          ar: "Block d. طبّق موجة مربعة Vp=5V و 1kHz على IN. وصّل CR13 بين OUT والأرضي (الأنود على OUT). ارسم الخرج.",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "red"],
          ["m:d.b13", "m:d.13a", "red", "clip"],
          ["m:d.13k", "m:d.g2", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:d.in", "osc.ch2": "m:d.out" },
        knobs: { "fg.func": 2, "fg.amp": fg(10), ...F1K },
        scope: { ch: [{ vdiv: 5, coupling: "DC" }, { vdiv: 5, coupling: "DC" }] },
        expect: { en: "Same 10 Vp-p shape shifted down: max ≈ +0.6 V, min ≈ −9.4 V.", ar: "نفس الشكل مزاح للأسفل: القمة ≈ +0.6 والقاع ≈ −9.4 فولت." },
      },
      {
        title: { en: "2.6.3 Clamper (b)", ar: "2.6.3 دائرة المسك (b)" },
        text: { en: "Rearrange with CR14 (cathode on OUT).", ar: "أعد الترتيب باستخدام CR14 (الكاثود على OUT)." },
        wires: [
          ["tr:fg.out", "m:d.in", "red"],
          ["m:d.b14", "m:d.14k", "red", "clip"],
          ["m:d.14a", "m:d.g3", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:d.in", "osc.ch2": "m:d.out" },
        knobs: { "fg.func": 2 },
        expect: { en: "Shifted up: min ≈ −0.6 V.", ar: "مزاح للأعلى: القاع ≈ −0.6 فولت." },
      },
      {
        title: { en: "Biased clamper (E = −3 V)", ar: "ماسك منحاز (E = −3V)" },
        text: {
          en: "As in (a) but return CR13 to the V− output (−3 V) instead of GND.",
          ar: "كما في (a) لكن أرجع CR13 إلى المخرج V− (−3V) بدلاً من الأرضي.",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "red"],
          ["m:d.b13", "m:d.13a", "red", "clip"],
          ["m:d.13k", "tr:adj.vm", "blue"],
        ],
        leads: { "osc.ch1": "m:d.in", "osc.ch2": "m:d.out" },
        knobs: { "fg.func": 2, "adj.v": 0 },
      },
    ],
    tables: [
      {
        id: "t2",
        title: { en: "Waveform record", ar: "سجل الإشارات" },
        cols: ["Vin p-p", "Vout max", "Vout min", "Notes"],
        rows: ["Series (a)", "Series (b)", "Parallel 3V", "Clamper (a)", "Clamper (b)", "Biased clamper"],
      },
    ],
  },
  /* ============================ EXP 3 ============================ */
  {
    id: "ex3",
    no: "3",
    module: "kl23001",
    title: { en: "Rectifiers", ar: "دوائر التقويم" },
    objective: {
      en: "Half-wave, centre-tapped full-wave and bridge rectifiers with and without a filter capacitor (block c, 9 V AC).",
      ar: "مقوم نصف موجة، موجة كاملة بنقطة وسطية، والمقوم القنطري مع وبدون متسعة ترشيح (block c، 9V AC).",
    },
    steps: [
      {
        title: { en: "Half-wave rectifier, no capacitor", ar: "مقوم نصف موجة بدون متسعة" },
        text: {
          en: "9 V AC to CR5, 0 V to TP4. Clip CR5 to OUT and R7 (1K) to OUT, R7 return to TP4. Scope ground on TP4. Measure VDC/VAC with the multimeter (Table 3.1).",
          ar: "9V AC إلى CR5 و 0V إلى TP4. اربط CR5 إلى OUT و R7 (1K) إلى OUT وطرف R7 الآخر إلى TP4. أرضي الراسم على TP4. قس VDC/VAC بالملتيميتر (الجدول 3.1).",
        },
        wires: [
          ["tr:ac.a", "m:c.d5a", "red"],
          ["tr:ac.ct", "m:c.r1", "white"],
          ["m:c.d5k", "m:c.o1", "red", "clip"],
          ["m:c.r7a", "m:c.o1", "red", "clip"],
          ["m:c.r7b", "m:c.r3", "black"],
        ],
        leads: { "osc.ch1": "m:c.o2", "osc.ch1g": "m:c.r2", "osc.ch2": null, "dmm.v": "m:c.o4", "dmm.com": "m:c.r2" },
        dmmMode: "dcv",
        scope: { tdiv: 5e-3, ch: [{ vdiv: 5, coupling: "DC" }, {}] },
        expect: { en: "VDC ≈ 0.318·Vm ≈ 3.8 V; one hump per 20 ms.", ar: "VDC ≈ 0.318·Vm ≈ 3.8 فولت؛ نبضة واحدة كل 20ms." },
      },
      {
        title: { en: "Half-wave with 220 μF, VR4 min/max", ar: "نصف موجة مع 220μF، VR4 أدنى/أعلى" },
        text: {
          en: "Add C7 (220 μF) across OUT. Route the load through VR4 (1 MΩ on the main unit). Record with VR4 at minimum, then at maximum.",
          ar: "أضف C7 (220μF) على OUT. مرّر الحمل خلال VR4 (1MΩ على الجهاز الرئيسي). سجّل عند VR4 أدنى ثم أعلى قيمة.",
        },
        wires: [
          ["tr:ac.a", "m:c.d5a", "red"],
          ["tr:ac.ct", "m:c.r1", "white"],
          ["m:c.d5k", "m:c.o1", "red", "clip"],
          ["m:c.r7a", "m:c.o1", "red", "clip"],
          ["m:c.c7p", "m:c.o3", "red", "clip"],
          ["m:c.c7n", "m:c.r3", "black", "clip"],
          ["m:c.r7b", "tr:vr4.a", "blue"],
          ["tr:vr4.b", "m:c.r2", "black"],
        ],
        leads: { "osc.ch1": "m:c.o2", "osc.ch1g": "m:c.r2", "dmm.v": "m:c.o4", "dmm.com": "m:c.r2" },
        knobs: { vr4: 0 },
        dmmMode: "dcv",
        expect: { en: "Larger RL → smaller ripple.", ar: "كلما زاد RL قلّ التموج." },
      },
      {
        title: { en: "Full-wave (centre-tapped)", ar: "موجة كاملة (نقطة وسطية)" },
        text: {
          en: "+9 V AC to TP1, −9 V AC to TP2 and the 0 V (centre tap) to TP4. Clip the bridge top (CR15/CR16) to OUT. Load R7 as before.",
          ar: "+9V AC إلى TP1 و −9V AC إلى TP2 والنقطة الوسطية 0V إلى TP4. اربط قمة القنطرة (CR15/CR16) إلى OUT والحمل R7 كما سبق.",
        },
        wires: [
          ["tr:ac.a", "m:c.tp1", "red"],
          ["tr:ac.b", "m:c.tp2", "yellow"],
          ["tr:ac.ct", "m:c.r1", "white"],
          ["m:c.bt2", "m:c.o2", "red", "clip"],
          ["m:c.r7a", "m:c.o1", "red", "clip"],
          ["m:c.r7b", "m:c.r3", "black"],
        ],
        leads: { "osc.ch1": "m:c.o4", "osc.ch1g": "m:c.r2", "dmm.v": "m:c.o3", "dmm.com": "m:c.r2" },
        dmmMode: "dcv",
        expect: { en: "Two humps per 20 ms (100 Hz); VDC ≈ 0.636·Vm.", ar: "نبضتان كل 20ms (100Hz)؛ VDC ≈ 0.636·Vm." },
      },
      {
        title: { en: "Bridge rectifier", ar: "المقوم القنطري" },
        text: {
          en: "18 V AC across TP1–TP2 (no centre tap). Bridge top to OUT, bridge bottom to TP4. Then add C8 (100 μF) and repeat with VR4.",
          ar: "18V AC بين TP1 و TP2 (بدون نقطة وسطية). قمة القنطرة إلى OUT وأسفلها إلى TP4. ثم أضف C8 (100μF) وكرر مع VR4.",
        },
        wires: [
          ["tr:ac.a", "m:c.tp1", "red"],
          ["tr:ac.b", "m:c.tp2", "yellow"],
          ["m:c.bt2", "m:c.o2", "red", "clip"],
          ["m:c.bb2", "m:c.r1", "black", "clip"],
          ["m:c.r7a", "m:c.o1", "red", "clip"],
          ["m:c.r7b", "m:c.r3", "black"],
        ],
        leads: { "osc.ch1": "m:c.o4", "osc.ch1g": "m:c.r2", "dmm.v": "m:c.o3", "dmm.com": "m:c.r2" },
        dmmMode: "dcv",
      },
    ],
    tables: [
      {
        id: "t31",
        title: { en: "Tables 3.1–3.3", ar: "الجداول 3.1–3.3" },
        cols: ["VDC (avg)", "VAC (ripple)"],
        rows: ["Vin", "HW no C", "HW C VR4 min", "HW C VR4 max", "FW no C", "FW C min", "FW C max", "Bridge no C", "Bridge C min", "Bridge C max"],
      },
    ],
    questions: [
      { en: "Why does the half-wave output contain more ripple than the full-wave?", ar: "لماذا يحتوي خرج نصف الموجة على تموج أكبر من الموجة الكاملة؟" },
    ],
  },
  /* ============================ EXP 4 ============================ */
  {
    id: "ex4",
    no: "4",
    module: "kl23002",
    title: { en: "BJT Characteristics", ar: "خواص الترانزستور ثنائي القطبية BJT" },
    objective: {
      en: "Measure IB, IC, IE and β of an NPN transistor and plot the output characteristic IC–VCE.",
      ar: "قياس IB و IC و IE و β لترانزستور NPN ورسم منحني الخرج IC–VCE.",
    },
    steps: [
      {
        title: { en: "Measure IB, IC, IE (NPN, block a)", ar: "قياس IB و IC و IE (NPN، block a)" },
        text: {
          en: "VBB: +12 V → VR2 (10K) divider → VBB jack. VCC: +12 V → VR1 (1K) → VCC jack. Multimeter (μA/mA) between B gap for IB; the DC CURRENT METER of the main unit in the C gap for IC; clip the E gap. DC VOLTAGE (digital) across C–E. Adjust VR2 for IB = 10, 20, 30, 40 μA.",
          ar: "VBB: +12V ← مقسم VR2 (10K) ← مقبس VBB. VCC: +12V ← VR1 (1K) ← مقبس VCC. الملتيميتر في فجوة القاعدة لقياس IB، ومقياس التيار المستمر للجهاز في فجوة الجامع لقياس IC، واربط فجوة الباعث. الفولتميتر الرقمي بين C و E. اضبط VR2 ليكون IB = 10، 20، 30، 40 μA.",
        },
        wires: [
          ["tr:ps.p12", "tr:vr2.a", "red"],
          ["tr:vr2.c", "tr:ps.gnd", "black"],
          ["tr:vr2.b", "m:a.vbb", "yellow"],
          ["tr:ps.p12", "tr:vr1.a", "red"],
          ["tr:vr1.b", "m:a.vcc", "red"],
          ["tr:m2.p", "m:a.c1", "red"],
          ["tr:m2.n", "m:a.c2", "black"],
          ["m:a.e1", "m:a.e2", "black", "clip"],
          ["tr:dvm.v", "m:a.c2", "yellow"],
          ["tr:dvm.com", "m:a.e1", "black"],
        ],
        leads: { "dmm.v": "m:a.b1", "dmm.com": "m:a.b2" },
        dmmMode: "dca",
        knobs: { vr2: 0.9, vr1: 0 },
      },
      {
        title: { en: "Output characteristic IC–VCE", ar: "منحني الخرج IC–VCE" },
        text: {
          en: "Keep IB fixed with VR2; vary VR1 so VCE = 0.1 … 6 V and record IC (Tables 3.a–3.f). Repeat for each IB.",
          ar: "ثبّت IB بواسطة VR2؛ غيّر VR1 ليكون VCE = 0.1 … 6V وسجّل IC (الجداول 3.a–3.f). كرر لكل قيمة IB.",
        },
      },
    ],
    tables: [
      {
        id: "t41",
        title: { en: "Table 1 (NPN)", ar: "الجدول 1 (NPN)" },
        cols: ["IB (μA)", "IC (mA)", "VCE", "VBE", "IE", "β=IC/IB"],
        rows: ["cut-off", "10", "20", "30", "40", "saturation"],
      },
      {
        id: "t42",
        title: { en: "Output curve IC (mA)", ar: "منحني الخرج IC (mA)" },
        cols: ["0.1", "0.2", "0.3", "0.5", "0.7", "1", "3", "5", "6"],
        rows: ["IB=0", "IB=10μA", "IB=20μA", "IB=30μA", "IB=40μA", "IB=50μA"],
      },
    ],
    questions: [{ en: "Why is IB far smaller than IC?", ar: "لماذا يكون IB أصغر بكثير من IC؟" }],
  },
  /* ============================ EXP 5 ============================ */
  {
    id: "ex5",
    no: "5",
    module: "kl23003",
    title: { en: "Transistor Amplifier — C.E. (fixed, emitter, divider bias)", ar: "مكبر الترانزستور — باعث مشترك (انحياز ثابت، باعث، مقسم جهد)" },
    objective: {
      en: "Set the Q-point (VCE = ½VCC), draw the DC load line and measure AC gain and phase of the CE amplifier.",
      ar: "ضبط نقطة التشغيل (VCE = ½VCC) ورسم خط الحمل وقياس الكسب والطور للمكبر باعث مشترك.",
    },
    steps: [
      {
        title: { en: "A — Fixed bias, DC", ar: "أ — انحياز ثابت، تيار مستمر" },
        text: {
          en: "+12 V to VCC. R1 (100K) → VR4 (1MΩ) → base. Emitter straight to GND. Adjust VR4 until VCE = 6 V (multimeter C–E).",
          ar: "+12V إلى VCC. R1 (100K) ← VR4 (1MΩ) ← القاعدة. الباعث مباشرة إلى الأرضي. اضبط VR4 حتى يصبح VCE = 6V.",
        },
        wires: [
          ["tr:ps.p12", "m:a.vcc", "red"],
          ["m:a.r1", "tr:vr4.a", "yellow"],
          ["tr:vr4.b", "m:a.bB", "yellow"],
          ["m:a.e", "m:a.g2", "black"],
        ],
        leads: { "dmm.v": "m:a.c", "dmm.com": "m:a.e", "osc.ch1": null, "osc.ch2": null },
        dmmMode: "dcv",
        knobs: { vr4: 0.66 },
      },
      {
        title: { en: "A — Fixed bias, AC gain", ar: "أ — انحياز ثابت، الكسب" },
        text: {
          en: "Generator (1 kHz sine, small amplitude) to Vi. CH1 (AC) on Vi, CH2 on Vo. Increase amplitude to the maximum undistorted output; record Av and phase (≈180°).",
          ar: "المولد (1kHz جيبية بسعة صغيرة) إلى Vi. CH1 على Vi و CH2 على Vo. زد السعة حتى أكبر خرج غير مشوه؛ سجّل Av والطور (≈180°).",
        },
        wires: [
          ["tr:ps.p12", "m:a.vcc", "red"],
          ["m:a.r1", "tr:vr4.a", "yellow"],
          ["tr:vr4.b", "m:a.bB", "yellow"],
          ["m:a.e", "m:a.g2", "black"],
          ["tr:fg.out", "m:a.in", "green"],
        ],
        leads: { "osc.ch1": "m:a.in", "osc.ch2": "m:a.out", "dmm.v": "m:a.c", "dmm.com": "m:a.e" },
        knobs: { "fg.func": 0, "fg.amp": fg(0.02), ...F1K, vr4: 0.66 },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 0.01, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
      },
      {
        title: { en: "B — Emitter (self) bias", ar: "ب — انحياز الباعث" },
        text: {
          en: "Emitter through RE (470 Ω) + VR1 (1K) to GND. Readjust VR4 for VC = ½VCC. Then add C2 (22 μF) bypass and compare gains.",
          ar: "الباعث خلال RE (470Ω) + VR1 (1K) إلى الأرضي. أعد ضبط VR4 ليصبح VC = ½VCC. ثم أضف متسعة التمرير C2 (22μF) وقارن الكسب.",
        },
        wires: [
          ["tr:ps.p12", "m:a.vcc", "red"],
          ["m:a.r1", "tr:vr4.a", "yellow"],
          ["tr:vr4.b", "m:a.bB", "yellow"],
          ["m:a.re", "tr:vr1.a", "blue"],
          ["tr:vr1.b", "m:a.g2", "black"],
          ["tr:fg.out", "m:a.in", "green"],
        ],
        leads: { "osc.ch1": "m:a.in", "osc.ch2": "m:a.out", "dmm.v": "m:a.c", "dmm.com": "tr:ps.gnd" },
        knobs: { vr4: 0.45, vr1: 0, "fg.amp": fg(0.4) },
        scope: { ch: [{ vdiv: 0.2, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
      },
      {
        title: { en: "C — Voltage-divider bias", ar: "ج — انحياز مقسم الجهد" },
        text: {
          en: "R2 (39K) → VR2 (10K) → base, R3 (8.2K) base to GND, RE to GND with C2 bypass. Adjust VR2 for VC = ½VCC, then measure the AC gain with and without C2.",
          ar: "R2 (39K) ← VR2 (10K) ← القاعدة، R3 (8.2K) من القاعدة للأرضي، RE إلى الأرضي مع متسعة C2. اضبط VR2 ليصبح VC = ½VCC ثم قس الكسب مع وبدون C2.",
        },
        wires: [
          ["tr:ps.p12", "m:a.vcc", "red"],
          ["m:a.r2", "tr:vr2.a", "yellow"],
          ["tr:vr2.b", "m:a.bA", "yellow"],
          ["m:a.bA", "m:a.r3", "red", "clip"],
          ["m:a.re", "m:a.g2", "black", "clip"],
          ["m:a.e", "m:a.cb", "red", "clip"],
          ["tr:fg.out", "m:a.in", "green"],
        ],
        leads: { "osc.ch1": "m:a.in", "osc.ch2": "m:a.out", "dmm.v": "m:a.c", "dmm.com": "tr:ps.gnd" },
        knobs: { vr2: 0.3, "fg.amp": fg(0.02) },
        scope: { ch: [{ vdiv: 0.01, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
      },
    ],
    tables: [
      { id: "t51", title: { en: "DC (Q-point)", ar: "نقطة التشغيل" }, cols: ["IC", "IB", "β", "VCE", "VBE"], rows: ["Fixed", "Emitter min", "Emitter max", "Divider"] },
      { id: "t52", title: { en: "AC", ar: "الإشارة المتناوبة" }, cols: ["Vi p-p", "Vo p-p", "Av", "Phase"], rows: ["Fixed", "Emitter", "Divider + C2", "Divider no C2"] },
    ],
  },
  /* ============================ EXP 6 ============================ */
  {
    id: "ex6",
    no: "6",
    module: "kl23003",
    title: { en: "C.B. Amplifier, Transistor Switch, Cascade", ar: "مكبر قاعدة مشتركة، الترانزستور كمفتاح، المكبر المتتالي" },
    objective: {
      en: "Common-base amplifier, transistor in saturation / cut-off, and a two-stage RC-coupled cascade.",
      ar: "مكبر القاعدة المشتركة، الترانزستور في حالتي التشبع والقطع، ومكبر من مرحلتين مقترن بالمتسعات.",
    },
    steps: [
      {
        title: { en: "1. Common base", ar: "1. القاعدة المشتركة" },
        text: {
          en: "+12 V to VCC (block b). R1 → VR2 → base, R2 and CB (47 μF) on the base. Adjust VR2 so VC = ½VCC. Signal to Va; measure Va, Vb (Ie = (Va−Vb)/Rab), Vo.",
          ar: "+12V إلى VCC (block b). R1 ← VR2 ← القاعدة، و R2 و CB (47μF) على القاعدة. اضبط VR2 ليصبح VC = ½VCC. الإشارة إلى Va؛ قس Va و Vb و Vo.",
        },
        wires: [
          ["tr:ps.p12", "m:b.vcc", "red"],
          ["m:b.r1", "tr:vr2.a", "yellow"],
          ["tr:vr2.b", "m:b.bA", "yellow"],
          ["m:b.bA", "m:b.r3", "red", "clip"],
          ["m:b.bB", "m:b.cb", "red", "clip"],
          ["tr:fg.out", "m:b.va", "green"],
        ],
        leads: { "osc.ch1": "m:b.va", "osc.ch2": "m:b.out", "dmm.v": "m:b.c", "dmm.com": "tr:ps.gnd" },
        dmmMode: "dcv",
        knobs: { vr2: 0.4, "fg.func": 0, "fg.amp": fg(0.2), ...F1K },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 0.1, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
        expect: { en: "Output in phase with input; Ai ≈ 1.", ar: "الخرج بنفس طور الدخل؛ Ai ≈ 1." },
      },
      {
        title: { en: "2. Transistor as a switch", ar: "2. الترانزستور كمفتاح" },
        text: {
          en: "Block c. +12 V to VCC. Feed +5 V to Vin → LED on (saturation, VCE ≈ 0.1 V). Remove it → cut-off, VCE ≈ 12 V.",
          ar: "Block c. +12V إلى VCC. طبّق +5V على Vin ← يضيء الثنائي (تشبع، VCE ≈ 0.1V). أزله ← قطع، VCE ≈ 12V.",
        },
        wires: [
          ["tr:ps.p12", "m:c.vcc", "red"],
          ["tr:ps.p5", "m:c.in", "yellow"],
        ],
        leads: { "dmm.v": "m:c.c", "dmm.com": "m:c.gnd", "osc.ch1": null, "osc.ch2": null },
        dmmMode: "dcv",
      },
      {
        title: { en: "3. Cascade (two stages)", ar: "3. المكبر المتتالي (مرحلتان)" },
        text: {
          en: "Block d. +12 V to VCC. Adjust the two 1M trimmers so VC1 and VC2 ≈ 6 V. Signal to Vs (100:1 attenuator gives Vi). Measure Vb1, Vc1, Vb2, Vout; then remove C3 and repeat.",
          ar: "Block d. +12V إلى VCC. اضبط المقاومتين المتغيرتين ليكون VC1 و VC2 ≈ 6V. الإشارة إلى Vs (المخفف 100:1 يعطي Vi). قس Vb1 و Vc1 و Vb2 و Vout؛ ثم افصل C3 وكرر.",
        },
        wires: [
          ["tr:ps.p12", "m:d.vcc", "red"],
          ["tr:fg.out", "m:d.vs", "green"],
          ["m:d.e1", "m:d.e1b", "red", "clip"],
          ["m:d.e2", "m:d.e2b", "red", "clip"],
        ],
        leads: { "osc.ch1": "m:d.vi", "osc.ch2": "m:d.out", "dmm.v": "m:d.c1", "dmm.com": "tr:ps.gnd" },
        knobs: { "fg.amp": fg(0.2), "m.vr5": 0.62, "m.vr6": 0.62 },
        scope: { ch: [{ vdiv: 0.01, coupling: "AC", probe: 1 }, { vdiv: 2, coupling: "AC" }] },
      },
    ],
    tables: [
      { id: "t61", title: { en: "Table 1 (C.B.)", ar: "الجدول 1 (قاعدة مشتركة)" }, cols: ["VIN p-p", "Ve p-p", "VOUT p-p", "Ai", "Av", "Zi"], rows: ["CB"] },
      { id: "t62", title: { en: "Table 2 (switch)", ar: "الجدول 2 (مفتاح)" }, cols: ["VBE", "IB", "IC", "VCE"], rows: ["Saturation", "Cut-off"] },
      { id: "t63", title: { en: "Table 3 (cascade)", ar: "الجدول 3 (متتالي)" }, cols: ["Vin", "Vb1", "Vc1", "Vb2", "Vout"], rows: ["C3 connected", "C3 disconnected"] },
    ],
  },
  /* ============================ RLC ============================ */
  {
    id: "rlc",
    no: "A",
    module: "kl25001",
    title: { en: "Series RC / RLC Circuits", ar: "دوائر RC و RLC المتوالية" },
    objective: {
      en: "Observe phase shift in RC and resonance in a series RLC circuit (L = 10 mH, C = 0.1 μF → f0 ≈ 5.03 kHz).",
      ar: "مشاهدة فرق الطور في دائرة RC والرنين في دائرة RLC المتوالية (f0 ≈ 5.03kHz).",
    },
    steps: [
      {
        title: { en: "Series RLC — sweep through resonance", ar: "RLC متوالية — المسح عبر الرنين" },
        text: {
          en: "Generator to L1 directly (skip R1), L1 → C1 → R2 (100 Ω) → GND. CH1 on the input, CH2 across R2 (∝ current). Sweep the frequency around 5 kHz: VR2 peaks and the phase difference becomes zero at f0.",
          ar: "المولد إلى L1 مباشرة، L1 ← C1 ← R2 (100Ω) ← الأرضي. CH1 على الدخل و CH2 على R2. غيّر التردد حول 5kHz: تبلغ VR2 قيمتها العظمى ويصبح فرق الطور صفراً عند f0.",
        },
        wires: [
          ["tr:fg.out", "m:c.b", "green"],
          ["m:c.c", "m:c.d", "red", "clip"],
          ["m:c.e", "m:c.f", "red", "clip"],
          ["m:c.h", "m:c.g5", "black"],
        ],
        leads: { "osc.ch1": "m:c.b", "osc.ch2": "m:c.f" },
        knobs: { "fg.func": 0, "fg.amp": fg(4), "fg.range": 2, "fg.freq": (5.03 - 1) / 9 },
        scope: { tdiv: 100e-6, ch: [{ vdiv: 1, coupling: "AC" }, { vdiv: 0.5, coupling: "AC" }] },
      },
      {
        title: { en: "RC low-pass", ar: "مرشح RC تمرير منخفض" },
        text: {
          en: "R1 (1K) → C1 → GND (cord from C1 to GND). Output across C1. At f = 1/(2πRC) ≈ 1.59 kHz the output is 0.707 of the input with −45° shift.",
          ar: "R1 (1K) ← C1 ← الأرضي. الخرج على C1. عند f ≈ 1.59kHz يكون الخرج 0.707 من الدخل مع فرق طور −45°.",
        },
        wires: [
          ["tr:fg.out", "m:c.in", "green"],
          ["m:c.a", "m:c.d", "red"],
          ["m:c.e", "m:c.g3", "black"],
        ],
        leads: { "osc.ch1": "m:c.in", "osc.ch2": "m:c.d" },
        knobs: { "fg.range": 2, "fg.freq": (1.59 - 1) / 9 },
        scope: { tdiv: 200e-6, ch: [{ vdiv: 1, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
      },
    ],
    tables: [{ id: "trlc", title: { en: "Frequency response", ar: "الاستجابة الترددية" }, cols: ["f (Hz)", "Vin p-p", "VR p-p", "phase"], rows: ["2k", "3k", "4k", "5k", "6k", "8k", "10k"] }],
  },
  /* ============================ OP-AMP ============================ */
  {
    id: "opamp",
    no: "B",
    module: "kl25001",
    title: { en: "Operational Amplifier Circuits", ar: "دوائر المضخم العملياتي" },
    objective: {
      en: "Inverting amplifier (Av = −Rf/R1 = −10), integrator and differentiator with the uA741.",
      ar: "المضخم العاكس (Av = −Rf/R1 = −10)، المكامل والمفاضل باستخدام uA741.",
    },
    steps: [
      {
        title: { en: "Inverting amplifier", ar: "المضخم العاكس" },
        text: {
          en: "Ground +IN, signal 1 Vp-p 1 kHz to Vi. CH1 on Vi, CH2 on Vo: 10 Vp-p, 180° out of phase. Increase the input until the output clips at the ±10.5 V rails.",
          ar: "اربط +IN بالأرضي، وطبّق إشارة 1Vp-p و 1kHz على Vi. CH1 على Vi و CH2 على Vo: 10Vp-p بفرق طور 180°. زد الدخل حتى يتشبع الخرج عند ±10.5V.",
        },
        wires: [
          ["tr:fg.out", "m:a.vi", "green"],
          ["m:a.inp", "m:a.g1", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:a.vi", "osc.ch2": "m:a.out" },
        knobs: { "fg.func": 0, "fg.amp": fg(1), ...F1K },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 0.5, coupling: "DC" }, { vdiv: 5, coupling: "DC" }] },
      },
      {
        title: { en: "Integrator", ar: "المكامل" },
        text: {
          en: "Square wave to the integrator input (block b, upper). The output is a triangle wave.",
          ar: "موجة مربعة إلى دخل المكامل (block b، الأعلى). الخرج موجة مثلثية.",
        },
        wires: [["tr:fg.out", "m:b.vi", "green"]],
        leads: { "osc.ch1": "m:b.vi", "osc.ch2": "m:b.out" },
        knobs: { "fg.func": 2, "fg.amp": fg(2), ...F1K },
        scope: { ch: [{ vdiv: 1, coupling: "DC" }, { vdiv: 0.5, coupling: "DC" }] },
      },
      {
        title: { en: "Differentiator", ar: "المفاضل" },
        text: { en: "Triangle wave to the differentiator input: the output is a square wave.", ar: "موجة مثلثية إلى دخل المفاضل: الخرج موجة مربعة." },
        wires: [["tr:fg.out", "m:b.vi2", "green"]],
        leads: { "osc.ch1": "m:b.vi2", "osc.ch2": "m:b.out2" },
        knobs: { "fg.func": 1, "fg.amp": fg(2), ...F1K },
        scope: { ch: [{ vdiv: 1, coupling: "DC" }, { vdiv: 5, coupling: "DC" }] },
      },
    ],
    tables: [{ id: "toa", title: { en: "Results", ar: "النتائج" }, cols: ["Vin p-p", "Vout p-p", "Av", "Phase"], rows: ["Inverting", "Integrator", "Differentiator"] }],
  },
];

export const EXPERIMENT_BY_ID = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]));
