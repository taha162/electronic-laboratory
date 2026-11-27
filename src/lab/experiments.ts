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
  /** function of the second multimeter */
  dmm2Mode?: DmmMode;
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
      en: "Test diodes with the multimeter, then plot the V-I characteristic of the Si diode CR1 and the Zener CR3 on KL-23001 block a.",
      ar: "فحص الدايودات بجهاز الملتيميتر ثم رسم منحني الخواص (V-I) لدايود السيليكون CR1 ودايود الزينر CR3 على block a في KL-23001.",
    },
    steps: [
      {
        title: { en: "3.1 Diode test mode (forward)", ar: "3.1 وضع فحص الدايود (انحياز أمامي)" },
        text: {
          en: "Set the multimeter dial to ▶| (diode test). Put the red lead on the anode of CR1 (upper socket) and the black (COM) lead on its cathode (lower socket). Record the reading as Multimeter value 1.",
          ar: "اضبط مفتاح الملتيميتر على ▶| (فحص الدايود). ضع الطرف الأحمر على أنود CR1 (المقبس العلوي) والأسود (COM) على الكاثود (المقبس السفلي). سجّل القراءة كقيمة 1.",
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
          en: "+12V of the KL-21001 to the +12V supply socket of the module, and a clip from block a's +12V socket to R1. Patch the KL-21001 VR2 (10KΩ) into A, B, C of block a. Multimeter on mA (DC) in series from the OUT row to the CR1 anode; clip the CR1 cathode down to the bar below it and the bar to the GND rail. DC VOLTAGE meter of the KL-21001 across CR1. Turn VR2 so VF takes the values of Table 1.2 and record IF.",
          ar: "وصّل +12V من جهاز KL-21001 إلى مقبس +12V في صف التغذية للبورد، وضع مشبكاً من مقبس +12V في block a إلى R1. اربط VR2 (10KΩ) من جهاز KL-21001 بالمقابس A و B و C في block a. الملتيميتر على mA (DC) على التوالي من صف OUT إلى أنود CR1؛ اربط كاثود CR1 بمشبك إلى القضيب الذي تحته، والقضيب إلى خط الأرضي. وصّل مقياس الفولتية الرقمي للجهاز على طرفي CR1. دوّر VR2 حتى تصبح VF بقيم الجدول 1.2 وسجّل IF.",
        },
        dmmMode: "dca",
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["m:a.v12", "m:a.r1", "red", "clip"],
          ["tr:vr2.a", "m:a.A", "white"],
          ["tr:vr2.b", "m:a.B", "white"],
          ["tr:vr2.c", "m:a.C", "white"],
          ["m:a.d1k", "m:a.m2", "black", "clip"],
          ["m:a.m2", "m:a.g1", "black", "clip"],
          ["tr:dvm.v", "m:a.d1a", "yellow"],
          ["tr:dvm.com", "m:a.tp3", "black"],
        ],
        leads: { "dmm.v": "m:a.o1", "dmm.com": "m:a.d1a" },
        knobs: { vr2: 0.85 },
      },
      {
        title: { en: "3.2 Reverse bias (CR1)", ar: "3.2 الانحياز العكسي (CR1)" },
        text: {
          en: "Turn the supply off and re-locate the clips: the current now enters the CR1 cathode (multimeter on μA from the OUT row to the cathode) and the anode returns to GND through the socket beside it, the bar and the rail. Adjust VR2 for the reverse voltages of Table 1.3 and record IR.",
          ar: "أطفئ المصدر وأعد ترتيب المشابك: التيار يدخل الآن من كاثود CR1 (الملتيميتر على μA من صف OUT إلى الكاثود) ويعود الأنود إلى الأرضي عبر المقبس المجاور له والقضيب والخط. اضبط VR2 للحصول على فولتيات الجدول 1.3 وسجّل IR.",
        },
        dmmMode: "dca",
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["m:a.v12", "m:a.r1", "red", "clip"],
          ["tr:vr2.a", "m:a.A", "white"],
          ["tr:vr2.b", "m:a.B", "white"],
          ["tr:vr2.c", "m:a.C", "white"],
          ["m:a.k30", "m:a.m1", "black", "clip"],
          ["m:a.m2", "m:a.g1", "black", "clip"],
          ["tr:dvm.v", "m:a.d1k", "yellow"],
          ["tr:dvm.com", "m:a.tp3", "black"],
        ],
        leads: { "dmm.v": "m:a.o1", "dmm.com": "m:a.d1k" },
        knobs: { vr2: 0.6 },
      },
      {
        title: { en: "3.3 Zener diode (CR3) characteristic", ar: "3.3 منحني دايود الزينر (CR3)" },
        text: {
          en: "For voltages above 10 V feed R1 from the ADJUST POWER V+ output (near 18 V) instead of +12V. CR3 is reverse biased: multimeter (mA) from the OUT row to its cathode, anode clipped down to the bar and the bar to GND. Sweep VR2 to the values of Table 1.4 — VZ stays ≈ 10 V while IZ rises.",
          ar: "للحصول على فولتيات فوق 10V غذِّ R1 من مخرج ADJUST POWER V+ (قرب 18V) بدلاً من +12V. يكون CR3 بانحياز عكسي: الملتيميتر (mA) من صف OUT إلى الكاثود، والأنود بمشبك إلى القضيب ثم القضيب إلى الأرضي. غيّر VR2 حسب الجدول 1.4 — تبقى VZ ≈ 10V بينما يزداد IZ.",
        },
        dmmMode: "dca",
        wires: [
          ["tr:adj.vp", "m:a.r1", "red"],
          ["tr:vr2.a", "m:a.A", "white"],
          ["tr:vr2.b", "m:a.B", "white"],
          ["tr:vr2.c", "m:a.C", "white"],
          ["m:a.d3a", "m:a.m5", "black", "clip"],
          ["m:a.m5", "m:a.g4", "black", "clip"],
          ["tr:dvm.v", "m:a.d3k", "yellow"],
          ["tr:dvm.com", "m:a.tp3", "black"],
        ],
        leads: { "dmm.v": "m:a.o4", "dmm.com": "m:a.d3k" },
        knobs: { "adj.v": 1, vr2: 0.1 },
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
      en: "Series clipper (block b), parallel clipper (block c) and clampers (block d) of KL-23001 on the oscilloscope, with a 10 Vp-p, 1 kHz input.",
      ar: "القاطع المتوالي (block b) والقاطع المتوازي (block c) ودوائر المسك (block d) في KL-23001 على راسم الإشارة، بإشارة دخل 10Vp-p و 1kHz.",
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
          en: "Block b, Fig. 2.15 (a): the signal into TP2, CR9 (1N4148) to the output with a clip, and R3 (10K) clipped down to the GND rail. CH1 on TP2 (input), CH2 on TP3 (output). Draw both.",
          ar: "Block b، الشكل 2.15 (a): الإشارة إلى TP2، ومشبك من CR9 (1N4148) إلى الخرج، ومشبك من R3 (10K) إلى خط الأرضي. CH1 على TP2 (الدخل) و CH2 على TP3 (الخرج). ارسم الإشارتين.",
        },
        wires: [
          ["tr:fg.out", "m:b.tp2", "green"],
          ["m:b.k", "m:b.o", "red", "clip"],
          ["m:b.r3", "m:b.g1", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:b.tp2", "osc.ch2": "m:b.tp3" },
        knobs: { "fg.func": 0, "fg.amp": fg(10), ...F1K },
        expect: { en: "Negative half-cycles removed; peak ≈ 5 − 0.7 V.", ar: "تُحذف الأنصاف السالبة؛ القمة ≈ 5 − 0.7 فولت." },
      },
      {
        title: { en: "2.6.1 Series clipper (b) — reversed diode", ar: "2.6.1 القاطع المتوالي (b) — دايود معكوس" },
        text: {
          en: "Fig. 2.15 (b): turn off, move the generator from TP2 to TP1 and move the clip so the TP2 side of CR9 feeds the output. Observe TP3 again.",
          ar: "الشكل 2.15 (b): أطفئ الأجهزة، انقل المولد من TP2 إلى TP1 وانقل المشبك بحيث يغذي طرفُ TP2 للدايود CR9 الخرجَ. شاهد TP3 مجدداً.",
        },
        wires: [
          ["tr:fg.out", "m:b.tp1", "green"],
          ["m:b.a2", "m:b.o2", "red", "clip"],
          ["m:b.r3", "m:b.g1", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:b.tp1", "osc.ch2": "m:b.tp3" },
        expect: { en: "Positive half-cycles removed.", ar: "تُحذف الأنصاف الموجبة." },
      },
      {
        title: { en: "2.6.2 Parallel clipper with 3 V bias", ar: "2.6.2 القاطع المتوازي مع انحياز 3V" },
        text: {
          en: "Block c: signal to TP1 → R4 (10K) → TP2. Clip the output to the CR12 anode; its cathode goes to the ADJUST POWER V+ (3 V). Observe TP2.",
          ar: "Block c: الإشارة إلى TP1 ← R4 (10K) ← TP2. اربط الخرج بأنود CR12 بمشبك، ووصّل كاثوده بـ ADJUST POWER V+ (3V). شاهد TP2.",
        },
        wires: [
          ["tr:fg.out", "m:c.tp1", "green"],
          ["m:c.o1", "m:c.d12a", "red", "clip"],
          ["m:c.d12k2", "tr:adj.vp", "yellow"],
        ],
        leads: { "osc.ch1": "m:c.tp1", "osc.ch2": "m:c.tp2" },
        knobs: { "adj.v": 0 },
        expect: { en: "Output limited to ≈ 3 + 0.6 = 3.6 V.", ar: "الخرج محدد عند ≈ 3.6 فولت." },
      },
      {
        title: { en: "2.6.3 Clamper (a)", ar: "2.6.3 دائرة المسك (a)" },
        text: {
          en: "Block d, Fig. 2.19 (a): square wave Vp = 5 V, 1 kHz into IN. Clip the output (top centre socket) to the CR14 cathode, and the CR14 anode down to the GND rail. Plot the output.",
          ar: "Block d، الشكل 2.19 (a): موجة مربعة Vp=5V و 1kHz إلى IN. اربط الخرج (المقبس العلوي الأوسط) بكاثود CR14 بمشبك، وأنود CR14 إلى خط الأرضي. ارسم الخرج.",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "green"],
          ["m:d.63", "m:d.64", "red", "clip"],
          ["m:d.79", "m:d.g2", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:d.in", "osc.ch2": "m:d.out" },
        knobs: { "fg.func": 2, "fg.amp": fg(10), ...F1K },
        scope: { ch: [{ vdiv: 5, coupling: "DC" }, { vdiv: 5, coupling: "DC" }] },
        expect: { en: "Same 10 Vp-p shape shifted up: min ≈ −0.6 V, max ≈ +9.4 V.", ar: "نفس الشكل مزاح للأعلى: القاع ≈ −0.6 والقمة ≈ +9.4 فولت." },
      },
      {
        title: { en: "2.6.3 Clamper (b)", ar: "2.6.3 دائرة المسك (b)" },
        text: {
          en: "Fig. 2.19 (b): use CR13 instead — clip the output to the CR13 anode and the CR13 cathode down to the GND rail.",
          ar: "الشكل 2.19 (b): استخدم CR13 — اربط الخرج بأنود CR13 بمشبك، وكاثود CR13 إلى خط الأرضي.",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "green"],
          ["m:d.62", "m:d.63", "red", "clip"],
          ["m:d.77", "m:d.g1", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:d.in", "osc.ch2": "m:d.out" },
        knobs: { "fg.func": 2 },
        expect: { en: "Shifted down: max ≈ +0.6 V.", ar: "مزاح للأسفل: القمة ≈ +0.6 فولت." },
      },
      {
        title: { en: "Biased clamper (V+ = 3 V)", ar: "ماسك منحاز (V+ = 3V)" },
        text: {
          en: "As in (b) but return the CR13 cathode to the V+ bar (fed from the module's V+ socket by the ADJUST POWER V+, 3 V).",
          ar: "كما في (b) لكن أرجع كاثود CR13 إلى قضيب V+ (المغذّى من مقبس V+ في البورد بواسطة ADJUST POWER V+ عند 3V).",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "green"],
          ["tr:adj.vp", "m:p.vp", "yellow"],
          ["m:d.62", "m:d.63", "red", "clip"],
          ["m:d.77", "m:d.66", "blue", "clip"],
        ],
        leads: { "osc.ch1": "m:d.in", "osc.ch2": "m:d.out" },
        knobs: { "fg.func": 2, "adj.v": 0 },
        expect: { en: "Shifted down to a +3.6 V ceiling.", ar: "مزاح للأسفل حتى سقف +3.6 فولت." },
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
    module: "kl23002",
    title: { en: "Rectifiers", ar: "دوائر التقويم" },
    objective: {
      en: "Half-wave, centre-tapped full-wave and bridge rectifiers with and without a filter capacitor (KL-23002 block c, 9 V AC of the KL-21001).",
      ar: "مقوم نصف موجة، موجة كاملة بنقطة وسطية، والمقوم القنطري مع وبدون متسعة ترشيح (block c في KL-23002، 9V AC من جهاز KL-21001).",
    },
    steps: [
      {
        title: { en: "Half-wave rectifier, no capacitor (Fig. 3.5)", ar: "مقوم نصف موجة بدون متسعة (الشكل 3.5)" },
        text: {
          en: "9 V AC to TP1, the AC 0 V to the GND socket under it. Clips: GND to the bottom bar (TP4) and R7 (1K) to the bar. Measure VDC and VAC of OUT (TP3) with the multimeter (Table 3.1) and watch the waveform.",
          ar: "9V AC إلى TP1، و 0V للمصدر المتناوب إلى مقبس GND تحته. المشابك: GND إلى القضيب السفلي (TP4) و R7 (1K) إلى القضيب. قس VDC و VAC للخرج OUT (TP3) بالملتيميتر (الجدول 3.1) وشاهد الموجة.",
        },
        wires: [
          ["tr:ac.a", "m:c.tp1", "red"],
          ["tr:ac.ct", "m:c.ct", "white"],
          ["m:c.s3", "m:c.u3", "black", "clip"],
          ["m:c.r7", "m:c.u4", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:c.tp3", "osc.ch1g": "m:c.tp4", "osc.ch2": null, "dmm.v": "m:c.tp3", "dmm.com": "m:c.tp4" },
        dmmMode: "dcv",
        scope: { tdiv: 5e-3, ch: [{ vdiv: 5, coupling: "DC" }, {}] },
        expect: { en: "VDC ≈ 0.318·Vm ≈ 3.8 V; one hump per 20 ms.", ar: "VDC ≈ 0.318·Vm ≈ 3.8 فولت؛ نبضة واحدة كل 20ms." },
      },
      {
        title: { en: "Half-wave with 220 μF, VR4 min/max (Fig. 3.6)", ar: "نصف موجة مع 220μF، VR4 أدنى/أعلى (الشكل 3.6)" },
        text: {
          en: "Clip C6 (220 μF) to the bar instead of R7, and load with R8 (200Ω) + VR4: patch the KL-21001 VR4 (1MΩ) A–B into the VR4 sockets and clip R8 to the bar. Record with VR4 at minimum, then at maximum.",
          ar: "اربط C6 (220μF) بالقضيب بدلاً من R7، واجعل الحمل R8 (200Ω) + VR4: اربط VR4 (1MΩ) من جهاز KL-21001 بطرفيها A–B بمقابس VR4 ثم اربط R8 بالقضيب. سجّل عند VR4 أدنى ثم أعلى قيمة.",
        },
        wires: [
          ["tr:ac.a", "m:c.tp1", "red"],
          ["tr:ac.ct", "m:c.ct", "white"],
          ["m:c.s3", "m:c.u3", "black", "clip"],
          ["m:c.c6", "m:c.u7", "black", "clip"],
          ["tr:vr4.a", "m:c.vrB", "blue"],
          ["tr:vr4.b", "m:c.vrA", "blue"],
          ["m:c.r8", "m:c.u5", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:c.tp3", "osc.ch1g": "m:c.tp4", "dmm.v": "m:c.tp3", "dmm.com": "m:c.tp4" },
        knobs: { vr4: 0 },
        dmmMode: "dcv",
        expect: { en: "Larger load resistance → smaller ripple.", ar: "كلما زادت مقاومة الحمل قلّ التموج." },
      },
      {
        title: { en: "Full-wave, centre tapped (Fig. 3.7)", ar: "موجة كاملة بنقطة وسطية (الشكل 3.7)" },
        text: {
          en: "+9 V AC to TP1, −9 V AC to TP2 and the 0 V to the GND socket between them. Clips: GND to the bar and R7 to the bar. Measure OUT (Table 3.2).",
          ar: "+9V AC إلى TP1 و −9V AC إلى TP2 والـ 0V إلى مقبس GND بينهما. المشابك: GND إلى القضيب و R7 إلى القضيب. قس الخرج (الجدول 3.2).",
        },
        wires: [
          ["tr:ac.a", "m:c.tp1", "red"],
          ["tr:ac.b", "m:c.tp2", "yellow"],
          ["tr:ac.ct", "m:c.ct", "white"],
          ["m:c.s3", "m:c.u3", "black", "clip"],
          ["m:c.r7", "m:c.u4", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:c.tp3", "osc.ch1g": "m:c.tp4", "dmm.v": "m:c.tp3", "dmm.com": "m:c.tp4" },
        dmmMode: "dcv",
        expect: { en: "Two humps per 20 ms (100 Hz); VDC ≈ 0.636·Vm.", ar: "نبضتان كل 20ms (100Hz)؛ VDC ≈ 0.636·Vm." },
      },
      {
        title: { en: "Full-wave with 220 μF (Fig. 3.8)", ar: "موجة كاملة مع 220μF (الشكل 3.8)" },
        text: {
          en: "Turn off, then clip C6 and R8 to the bar (R7 out) with the KL-21001 VR4 patched in. Record VR4 at minimum and at maximum.",
          ar: "أطفئ، ثم اربط C6 و R8 بالقضيب (بدون R7) مع ربط VR4 من جهاز KL-21001. سجّل عند VR4 أدنى ثم أعلى قيمة.",
        },
        wires: [
          ["tr:ac.a", "m:c.tp1", "red"],
          ["tr:ac.b", "m:c.tp2", "yellow"],
          ["tr:ac.ct", "m:c.ct", "white"],
          ["m:c.s3", "m:c.u3", "black", "clip"],
          ["m:c.c6", "m:c.u7", "black", "clip"],
          ["tr:vr4.a", "m:c.vrB", "blue"],
          ["tr:vr4.b", "m:c.vrA", "blue"],
          ["m:c.r8", "m:c.u5", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:c.tp3", "osc.ch1g": "m:c.tp4", "dmm.v": "m:c.tp3", "dmm.com": "m:c.tp4" },
        knobs: { vr4: 0 },
        dmmMode: "dcv",
      },
      {
        title: { en: "Bridge rectifier (Fig. 3.9)", ar: "المقوم القنطري (الشكل 3.9)" },
        text: {
          en: "18 V AC across TP1–TP2 (no centre tap, the GND socket stays free). Clips: the bridge's negative corner (second socket) to the bar and R7 to the bar. Measure OUT against TP4 (Table 3.3).",
          ar: "18V AC بين TP1 و TP2 (بدون نقطة وسطية، ومقبس GND يبقى حراً). المشابك: الطرف السالب للقنطرة (المقبس الثاني) إلى القضيب و R7 إلى القضيب. قس الخرج بالنسبة لـ TP4 (الجدول 3.3).",
        },
        wires: [
          ["tr:ac.a", "m:c.tp1", "red"],
          ["tr:ac.b", "m:c.tp2", "yellow"],
          ["m:c.s2", "m:c.u2", "black", "clip"],
          ["m:c.r7", "m:c.u4", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:c.tp3", "osc.ch1g": "m:c.tp4", "dmm.v": "m:c.tp3", "dmm.com": "m:c.tp4" },
        dmmMode: "dcv",
      },
      {
        title: { en: "Bridge with 100 μF (Fig. 3.10)", ar: "القنطري مع 100μF (الشكل 3.10)" },
        text: {
          en: "Turn off, clip C7 (100 μF) and R8 to the bar (R7 out) with VR4 patched in; record VR4 at minimum and maximum.",
          ar: "أطفئ، واربط C7 (100μF) و R8 بالقضيب (بدون R7) مع ربط VR4؛ سجّل عند VR4 أدنى ثم أعلى قيمة.",
        },
        wires: [
          ["tr:ac.a", "m:c.tp1", "red"],
          ["tr:ac.b", "m:c.tp2", "yellow"],
          ["m:c.s2", "m:c.u2", "black", "clip"],
          ["m:c.c7", "m:c.u8", "black", "clip"],
          ["tr:vr4.a", "m:c.vrB", "blue"],
          ["tr:vr4.b", "m:c.vrA", "blue"],
          ["m:c.r8", "m:c.u5", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:c.tp3", "osc.ch1g": "m:c.tp4", "dmm.v": "m:c.tp3", "dmm.com": "m:c.tp4" },
        knobs: { vr4: 0 },
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
      en: "Measure IB, IC, IE and β of the NPN transistor Q2 (KL-23002 block a) and plot the output characteristic IC–VCE.",
      ar: "قياس IB و IC و IE و β للترانزستور NPN (Q2) في block a من KL-23002 ورسم منحني الخرج IC–VCE.",
    },
    steps: [
      {
        title: { en: "Measure IB, IC, IE (NPN Q2, Fig. 4.3)", ar: "قياس IB و IC و IE (NPN Q2، الشكل 4.3)" },
        text: {
          en: "+12V of the KL-21001 to the module's +12V supply socket. Patch the KL-21001 VR2 (10KΩ) into A, B, C of block a and clip B to the socket beside it. Multimeter 1 (μA) from there to R1 (IB); the DC CURRENT METER of the main unit from R3 (1K) to the Q2 collector (IC); multimeter 2 (mA) from the Q2 emitter to the GND rail (IE). DC VOLTAGE (digital) across C–E. Adjust VR2 for IB = 10 … 50 μA (Table 1).",
          ar: "وصّل +12V من جهاز KL-21001 إلى مقبس +12V في صف التغذية للبورد. اربط VR2 (10KΩ) من جهاز KL-21001 بالمقابس A و B و C في block a، واربط B بمشبك مع المقبس المجاور. الملتيميتر 1 (μA) من هناك إلى R1 (IB)، ومقياس التيار المستمر للجهاز من R3 (1K) إلى جامع Q2 (IC)، والملتيميتر 2 (mA) من باعث Q2 إلى خط الأرضي (IE). الفولتميتر الرقمي بين C و E. اضبط VR2 ليكون IB = 10 … 50 μA (الجدول 1).",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["tr:vr2.a", "m:a.vr2A", "white"],
          ["tr:vr2.b", "m:a.vr2B", "white"],
          ["tr:vr2.c", "m:a.vr2C", "white"],
          ["m:a.vr2B", "m:a.s7", "yellow", "clip"],
          ["tr:m2.p", "m:a.r3", "red"],
          ["tr:m2.n", "m:a.q2c", "black"],
          ["tr:dvm.v", "m:a.q2c", "yellow"],
          ["tr:dvm.com", "m:a.q2e", "black"],
        ],
        leads: { "dmm.v": "m:a.s7", "dmm.com": "m:a.r1", "dmm2.v": "m:a.q2e", "dmm2.com": "m:a.s6" },
        dmmMode: "dca",
        dmm2Mode: "dca",
        knobs: { vr2: 0.87 },
      },
      {
        title: { en: "Output characteristic IC–VCE (Fig. 4.5)", ar: "منحني الخرج IC–VCE (الشكل 4.5)" },
        text: {
          en: "Feed the collector from VR1 instead of R3: patch the KL-21001 VR1 (1KΩ) into A, B, C on the right (R4 100Ω from +12V), and put the DC CURRENT METER between the socket under VR1's B and the collector link. Keep IB fixed with VR2; vary VR1 so VCE = 0.1 … 6 V and record IC (Tables 3.a–3.f). Repeat for each IB.",
          ar: "غذِّ الجامع من VR1 بدلاً من R3: اربط VR1 (1KΩ) من جهاز KL-21001 بالمقابس A و B و C في اليمين (R4 100Ω من +12V)، وضع مقياس التيار المستمر بين المقبس تحت B الخاص بـ VR1 ووصلة الجامع. ثبّت IB بواسطة VR2؛ غيّر VR1 ليكون VCE = 0.1 … 6V وسجّل IC (الجداول 3.a–3.f). كرر لكل قيمة IB.",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["tr:vr2.a", "m:a.vr2A", "white"],
          ["tr:vr2.b", "m:a.vr2B", "white"],
          ["tr:vr2.c", "m:a.vr2C", "white"],
          ["m:a.vr2B", "m:a.s7", "yellow", "clip"],
          ["tr:vr1.a", "m:a.vr1A", "white"],
          ["tr:vr1.b", "m:a.vr1B", "white"],
          ["tr:vr1.c", "m:a.vr1C", "white"],
          ["tr:m2.p", "m:a.s3", "red"],
          ["tr:m2.n", "m:a.s2", "black"],
          ["tr:dvm.v", "m:a.q2c", "yellow"],
          ["tr:dvm.com", "m:a.q2e", "black"],
        ],
        leads: { "dmm.v": "m:a.s7", "dmm.com": "m:a.r1", "dmm2.v": "m:a.q2e", "dmm2.com": "m:a.s6" },
        dmmMode: "dca",
        dmm2Mode: "dca",
        knobs: { vr2: 0.87, vr1: 0.5 },
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
      en: "KL-23003 block a: set the Q-point (VCE = ½VCC), draw the DC load line and measure AC gain and phase of the CE amplifier.",
      ar: "block a في KL-23003: ضبط نقطة التشغيل (VCE = ½VCC) ورسم خط الحمل وقياس الكسب والطور للمكبر باعث مشترك.",
    },
    steps: [
      {
        title: { en: "A — Fixed bias (Fig. 5.3), DC", ar: "أ — الانحياز الثابت (الشكل 5.3)، التيار المستمر" },
        text: {
          en: "+12V of the KL-21001 to the module's +12V supply socket (it feeds TP4). Base: clip R1 (47K) down to the node and the node to VR4's A, and patch the KL-21001 VR4 (1MΩ) A–B into VR4. Multimeter 1 (μA) from TP2 to the Q1 base (IB). Collector: clip R5 (3.3K) into the collector bar and put multimeter 2 (mA) from the bar to the collector (IC); the DC VOLTAGE meter of the KL-21001 across C–E. Clip the emitter line straight to the GND bar. Turn VR4 for IB = 0 (cut-off) and for saturation, then set VCE ≈ ½VCC and record VBE, IB, IC (Table 1).",
          ar: "وصّل +12V من جهاز KL-21001 إلى مقبس +12V في صف التغذية للبورد (يغذي TP4). القاعدة: اربط R1 (47K) بمشبك إلى العقدة، والعقدة إلى A الخاص بـ VR4، واربط VR4 (1MΩ) من جهاز KL-21001 بطرفيها A–B مكان VR4. الملتيميتر 1 (μA) من TP2 إلى قاعدة Q1 (IB). الجامع: اربط R5 (3.3K) بمشبك إلى قضيب الجامع، وضع الملتيميتر 2 (mA) من القضيب إلى الجامع (IC)، ومقياس الفولتية الرقمي للجهاز بين C و E. اربط خط الباعث مباشرة بقضيب الأرضي. دوّر VR4 حتى IB = 0 (القطع) ثم حتى الإشباع، ثم اضبط VCE ≈ ½VCC وسجّل VBE و IB و IC (الجدول 1).",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["m:a.r1", "m:a.n1", "red", "clip"],
          ["m:a.n1", "m:a.vr4A", "red", "clip"],
          ["tr:vr4.a", "m:a.vr4A", "yellow"],
          ["tr:vr4.b", "m:a.B", "yellow"],
          ["tr:dvm.v", "m:a.qc", "yellow"],
          ["tr:dvm.com", "m:a.tp3", "black"],
          ["m:a.r5", "m:a.k2", "red", "clip"],
          ["m:a.r8l", "m:a.g4", "black", "clip"],
        ],
        leads: { "dmm.v": "m:a.tp2", "dmm.com": "m:a.qb", "dmm2.v": "m:a.k5", "dmm2.com": "m:a.qc", "osc.ch1": null, "osc.ch2": null },
        dmmMode: "dca",
        dmm2Mode: "dca",
        knobs: { vr4: 0.97 },
      },
      {
        title: { en: "A — Fixed bias, AC gain", ar: "أ — الانحياز الثابت، الكسب" },
        text: {
          en: "Keep the fixed-bias circuit. Signal generator to TP1 (IN, 1 kHz sine), CH1 on TP1 and CH2 on TP5 (OUT, AC). Raise the amplitude to the largest undistorted output and record Vi, Vo, Av and the phase.",
          ar: "أبقِ دائرة الانحياز الثابت. مولّد الإشارة إلى TP1 (IN، جيبية 1kHz)، و CH1 على TP1 و CH2 على TP5 (OUT، AC). زد السعة حتى أكبر خرج بلا تشوه وسجّل Vi و Vo و Av والطور.",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["m:a.r1", "m:a.n1", "red", "clip"],
          ["m:a.n1", "m:a.vr4A", "red", "clip"],
          ["tr:vr4.a", "m:a.vr4A", "yellow"],
          ["tr:vr4.b", "m:a.B", "yellow"],
          ["tr:dvm.v", "m:a.qc", "yellow"],
          ["tr:dvm.com", "m:a.tp3", "black"],
          ["m:a.r5", "m:a.k2", "red", "clip"],
          ["m:a.r8l", "m:a.g4", "black", "clip"],
          ["tr:fg.out", "m:a.tp1", "green"],
        ],
        leads: { "osc.ch1": "m:a.tp1", "osc.ch2": "m:a.tp5", "dmm.v": "m:a.tp2", "dmm.com": "m:a.qb", "dmm2.v": "m:a.k5", "dmm2.com": "m:a.qc" },
        dmmMode: "dca",
        dmm2Mode: "dca",
        knobs: { "fg.func": 0, "fg.amp": fg(0.02), ...F1K, vr4: 0.97 },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 0.01, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
      },
      {
        title: { en: "B — Emitter self-bias (Fig. 5.4)", ar: "ب — انحياز الباعث الذاتي (الشكل 5.4)" },
        text: {
          en: "Same base circuit (R1 47K + VR4) and the same two multimeters (IB, IC). Collector: clip R6 (2.2K) into the collector bar. Emitter: patch the KL-21001 VR1 (1KΩ) A–B into VR1 (emitter to the left socket) and clip that socket to the GND bar. With VR1 at minimum set VC = ½VCC with VR4 and record; then VR1 at maximum and repeat. Finally apply the signal and compare the gain.",
          ar: "نفس دائرة القاعدة (R1 47K + VR4) ونفس الملتيميترين (IB و IC). الجامع: اربط R6 (2.2K) بمشبك إلى قضيب الجامع. الباعث: اربط VR1 (1KΩ) من جهاز KL-21001 بطرفيها A–B مكان VR1 (من الباعث إلى المقبس الأيسر) واربط ذلك المقبس بقضيب الأرضي. مع VR1 على الأدنى اضبط VC = ½VCC بواسطة VR4 وسجّل؛ ثم VR1 على الأعلى وكرر. أخيراً أدخل الإشارة وقارن الكسب.",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["m:a.r1", "m:a.n1", "red", "clip"],
          ["m:a.n1", "m:a.vr4A", "red", "clip"],
          ["tr:vr4.a", "m:a.vr4A", "yellow"],
          ["tr:vr4.b", "m:a.B", "yellow"],
          ["tr:dvm.v", "m:a.qc", "yellow"],
          ["tr:dvm.com", "m:a.tp3", "black"],
          ["m:a.r6", "m:a.k1", "red", "clip"],
          ["tr:vr1.a", "m:a.v1A", "blue"],
          ["tr:vr1.b", "m:a.v1B", "blue"],
          ["m:a.v1l", "m:a.g1", "black", "clip"],
          ["tr:fg.out", "m:a.tp1", "green"],
        ],
        leads: { "osc.ch1": "m:a.tp1", "osc.ch2": "m:a.tp5", "dmm.v": "m:a.tp2", "dmm.com": "m:a.qb", "dmm2.v": "m:a.k5", "dmm2.com": "m:a.qc" },
        dmmMode: "dca",
        dmm2Mode: "dca",
        knobs: { vr4: 0.7, vr1: 0, "fg.func": 0, "fg.amp": fg(0.02), ...F1K },
        scope: { ch: [{ vdiv: 0.01, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
      },
      {
        title: { en: "C — Voltage-divider bias (Fig. 5.5)", ar: "ج — انحياز مقسم الجهد (الشكل 5.5)" },
        text: {
          en: "Base: R1 47K from +12V to the node as before, VR4 at minimum, and clip the node's left socket down to VR2: patch the KL-21001 VR2 (10KΩ) A–B into VR2 (with R2 1K to GND). Collector: clip R4 (4.7K) into the collector bar (multimeters 1 and 2 stay on IB and IC). Emitter: clip R7 (1K) and C2 (22µ bypass) to the GND bar. Adjust VR2 for VCE = ½VCC, then apply the signal and record; remove the C2 clip and repeat (Tables 5–7).",
          ar: "القاعدة: R1 47K من +12V إلى العقدة كما سبق، و VR4 على الأدنى، واربط المقبس الأيسر للعقدة بمشبك إلى VR2: اربط VR2 (10KΩ) من جهاز KL-21001 بطرفيها A–B مكان VR2 (مع R2 1K إلى الأرضي). الجامع: اربط R4 (4.7K) بمشبك إلى قضيب الجامع (الملتيميتر 1 و 2 يبقيان على IB و IC). الباعث: اربط R7 (1K) و C2 (22µ تمرير) بقضيب الأرضي. اضبط VR2 ليكون VCE = ½VCC، ثم أدخل الإشارة وسجّل؛ انزع مشبك C2 وكرر (الجداول 5–7).",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["m:a.r1", "m:a.n1", "red", "clip"],
          ["m:a.n1", "m:a.vr4A", "red", "clip"],
          ["tr:vr4.a", "m:a.vr4A", "yellow"],
          ["tr:vr4.b", "m:a.B", "yellow"],
          ["m:a.n1l", "m:a.v2t", "red", "clip"],
          ["tr:vr2.a", "m:a.v2A", "white"],
          ["tr:vr2.b", "m:a.v2B", "white"],
          ["tr:dvm.v", "m:a.qc", "yellow"],
          ["tr:dvm.com", "m:a.tp3", "black"],
          ["m:a.r4", "m:a.k3", "red", "clip"],
          ["m:a.r7l", "m:a.g3", "black", "clip"],
          ["m:a.c2l", "m:a.g2", "black", "clip"],
          ["tr:fg.out", "m:a.tp1", "green"],
        ],
        leads: { "osc.ch1": "m:a.tp1", "osc.ch2": "m:a.tp5", "dmm.v": "m:a.tp2", "dmm.com": "m:a.qb", "dmm2.v": "m:a.k5", "dmm2.com": "m:a.qc" },
        dmmMode: "dca",
        dmm2Mode: "dca",
        knobs: { vr4: 0, vr2: 0.75, "fg.func": 0, "fg.amp": fg(0.02), ...F1K },
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
      en: "KL-23003: common-base amplifier (block b), transistor in saturation / cut-off (block c), and a two-stage RC-coupled cascade (block a → block c).",
      ar: "KL-23003: مكبر القاعدة المشتركة (block b)، الترانزستور في حالتي التشبع والقطع (block c)، ومكبر من مرحلتين مقترن بالمتسعات (block a ← block c).",
    },
    steps: [
      {
        title: { en: "1. Common base (Fig. 6.1)", ar: "1. القاعدة المشتركة (الشكل 6.1)" },
        text: {
          en: "Block b. +12V of the KL-21001 to the module's +12V supply socket. Base bias: R11 (22K) from +12V and the KL-21001 VR2 (10KΩ) patched into A, B, C; C4 (100µ) holds the base at AC ground. Multimeter 2 (mA) from the socket above the collector (R12 3.3K, TP5) to the collector (IC); multimeter 1 (mA) from TP3 (Va) to the emitter (IE); the DC VOLTAGE meter of the KL-21001 on the collector. No signal: adjust VR2 so VC = VCB ≈ ½VCC. Then the signal to TP1 (1 kHz), CH1 on TP1, CH2 on TP5; measure Va, Vb and the gain (Table 1).",
          ar: "Block b. وصّل +12V من جهاز KL-21001 إلى مقبس +12V في صف التغذية للبورد. انحياز القاعدة: R11 (22K) من +12V، و VR2 (10KΩ) من جهاز KL-21001 مربوطة بالمقابس A و B و C؛ و C4 (100µ) تثبّت القاعدة على أرضي متناوب. الملتيميتر 2 (mA) من المقبس فوق الجامع (R12 3.3K، TP5) إلى الجامع (IC)؛ والملتيميتر 1 (mA) من TP3 (Va) إلى الباعث (IE)؛ ومقياس الفولتية الرقمي للجهاز على الجامع. بدون إشارة اضبط VR2 ليكون VC = VCB ≈ ½VCC. ثم الإشارة إلى TP1 (1kHz)، و CH1 على TP1 و CH2 على TP5؛ قس Va و Vb والكسب (الجدول 1).",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["tr:vr2.a", "m:b.v2A", "white"],
          ["tr:vr2.b", "m:b.v2B", "white"],
          ["tr:vr2.c", "m:b.v2C", "white"],
          ["tr:dvm.v", "m:b.qc", "yellow"],
          ["tr:dvm.com", "tr:ps.gnd", "black"],
          ["tr:fg.out", "m:b.tp1", "green"],
        ],
        leads: { "osc.ch1": "m:b.tp1", "osc.ch2": "m:b.tp5", "dmm.v": "m:b.qe", "dmm.com": "m:b.tp3", "dmm2.v": "m:b.ct", "dmm2.com": "m:b.qc" },
        dmmMode: "dca",
        dmm2Mode: "dca",
        knobs: { vr2: 0.66, "fg.func": 0, "fg.amp": fg(0.2), ...F1K },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 0.1, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
      },
      {
        title: { en: "2. Transistor as a switch (Fig. 6.2)", ar: "2. الترانزستور كمفتاح (الشكل 6.2)" },
        text: {
          en: "Block c. +12V to the supply socket (Vcc through R17 2.2K and the IC ammeter to the Q3 collector). +5V of the KL-21001 to the +5V socket: through R15 (22K) and multimeter 1 (μA) to the base (IB); multimeter 2 (mA) from R17 to the collector (IC). Clip the emitter to the GND rail and put the DC VOLTAGE meter of the KL-21001 across C–E. Read VBE, IB, IC and VCE (saturation); then remove the 5 V and read them again (cut-off) — Table 2.",
          ar: "Block c. وصّل +12V إلى مقبس التغذية (المصدر عبر R17 2.2K وأميتر IC إلى جامع Q3). وصّل +5V من جهاز KL-21001 إلى مقبس +5V: عبر R15 (22K) والملتيميتر 1 (μA) إلى القاعدة (IB)، والملتيميتر 2 (mA) من R17 إلى الجامع (IC). اربط الباعث بخط الأرضي وضع مقياس الفولتية الرقمي للجهاز بين C و E. اقرأ VBE و IB و IC و VCE (الإشباع)؛ ثم افصل 5V واقرأها مجدداً (القطع) — الجدول 2.",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["tr:ps.p5", "m:c.p5", "yellow"],
          ["m:c.e1", "m:c.g1", "black", "clip"],
          ["tr:dvm.v", "m:c.c1", "yellow"],
          ["tr:dvm.com", "m:c.e1", "black"],
        ],
        leads: { "dmm.v": "m:c.r15", "dmm.com": "m:c.bb", "dmm2.v": "m:c.r17", "dmm2.com": "m:c.c1", "osc.ch1": null, "osc.ch2": null },
        dmmMode: "dca",
        dmm2Mode: "dca",
      },
      {
        title: { en: "3. Cascade (two stages)", ar: "3. المكبر المتتالي (مرحلتان)" },
        text: {
          en: "Stage 1 = block a (Q1, fixed bias with VR4, R5 collector, R7 with C2 bypass); stage 2 = block c (Q3: the KL-21001 VR3 patched into block c's A, B, C with R13 and R14 to the base, R17 collector, R16 emitter). Wire TP5 of block a to IN of block c (C5 couples the stages). With no signal adjust VR4 then VR3 so VC1 and VC2 ≈ ½VCC. Then a few mV at 1 kHz to TP1, CH1 on TP1 and CH2 on the Q3 collector (AC); measure Vb1, Vc1, Vb2 and Vout.",
          ar: "المرحلة 1 = block a (Q1، انحياز ثابت بـ VR4، الجامع R5، و R7 مع متسعة التمرير C2)؛ المرحلة 2 = block c (Q3: اربط VR3 من جهاز KL-21001 بالمقابس A و B و C في block c مع R13 و R14 إلى القاعدة، والجامع R17، والباعث R16). وصّل TP5 في block a إلى IN في block c (المتسعة C5 تربط المرحلتين). بدون إشارة اضبط VR4 ثم VR3 ليكون VC1 و VC2 ≈ ½VCC. ثم أدخل بضعة mV بتردد 1kHz إلى TP1، و CH1 على TP1 و CH2 على جامع Q3 (AC)؛ قس Vb1 و Vc1 و Vb2 و Vout.",
        },
        wires: [
          ["tr:ps.p12", "m:p.v12", "red"],
          ["m:a.r1", "m:a.n1", "red", "clip"],
          ["m:a.n1", "m:a.vr4A", "red", "clip"],
          ["tr:vr4.a", "m:a.vr4A", "yellow"],
          ["tr:vr4.b", "m:a.B", "yellow"],
          ["m:a.tp2", "m:a.qb", "red", "clip"],
          ["m:a.r5", "m:a.k2", "red", "clip"],
          ["m:a.k5", "m:a.qc", "red", "clip"],
          ["m:a.r7l", "m:a.g3", "black", "clip"],
          ["m:a.c2l", "m:a.g2", "black", "clip"],
          ["m:a.tp5", "m:c.in", "green"],
          ["tr:vr3.a", "m:c.v2A", "blue"],
          ["tr:vr3.b", "m:c.v2B", "blue"],
          ["tr:vr3.c", "m:c.v2C", "blue"],
          ["m:c.r14", "m:c.qb", "red", "clip"],
          ["m:c.r17", "m:c.c1", "red", "clip"],
          ["tr:fg.out", "m:a.tp1", "green"],
        ],
        leads: { "osc.ch1": "m:a.tp1", "osc.ch2": "m:c.c1", "dmm.v": "m:a.qc", "dmm.com": "tr:ps.gnd", "dmm2.v": null, "dmm2.com": null },
        dmmMode: "dcv",
        knobs: { "fg.func": 0, "fg.amp": fg(0.004), ...F1K, vr4: 0.75, vr3: 0.36 },
        scope: { ch: [{ vdiv: 0.01, coupling: "AC", probe: 1 }, { vdiv: 1, coupling: "AC" }] },
      },
    ],
    tables: [
      { id: "t61", title: { en: "Table 1 (C.B.)", ar: "الجدول 1 (قاعدة مشتركة)" }, cols: ["VIN p-p", "Ve p-p", "VOUT p-p", "Ai", "Av", "Zi"], rows: ["CB"] },
      { id: "t62", title: { en: "Table 2 (switch)", ar: "الجدول 2 (مفتاح)" }, cols: ["VBE", "IB", "IC", "VCE"], rows: ["Saturation", "Cut-off"] },
      { id: "t63", title: { en: "Table 3 (cascade)", ar: "الجدول 3 (متتالي)" }, cols: ["Vin", "Vb1", "Vc1", "Vb2", "Vout"], rows: ["Stage 1", "Stage 2", "Overall"] },
    ],
  },
  /* ============================ RC / RL (KL-23002 block d) ============================ */
  {
    id: "rc",
    no: "A",
    module: "kl23002",
    title: { en: "RC and RL Circuits — Integrator and Differentiator", ar: "دوائر RC و RL — المكامل والمفاضل" },
    objective: {
      en: "KL-23002 block d: pick a series element from the left column and a shunt element from the right row with clips; watch a 1 kHz square wave integrated and differentiated, and the RC low-pass response.",
      ar: "block d في KL-23002: اختر عنصراً متوالياً من العمود الأيسر وعنصراً على التوازي من الصف الأيمن بالمشابك؛ وشاهد موجة مربعة 1kHz بعد التكامل والتفاضل، واستجابة مرشح RC للترددات المنخفضة.",
    },
    steps: [
      {
        title: { en: "RC integrator: R11 → C10", ar: "المكامل RC: R11 ← C10" },
        text: {
          en: "Square wave 5 Vp-p, 1 kHz into IN. Clip R11 (100K) to the middle bar and C10 (0.01µ) down to the GND rail: τ = RC = 1 ms, twice the half period. CH1 on TP1, CH2 on TP2: the output is a small triangle wave.",
          ar: "موجة مربعة 5Vp-p و 1kHz إلى IN. اربط R11 (100K) بالقضيب الأوسط و C10 (0.01µ) إلى خط الأرضي: τ = RC = 1ms أي ضعف نصف الدورة. CH1 على TP1 و CH2 على TP2: الخرج موجة مثلثية صغيرة.",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "green"],
          ["m:d.s5", "m:d.k5", "red", "clip"],
          ["m:d.b10", "m:d.r1", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:d.tp1", "osc.ch2": "m:d.tp2" },
        knobs: { "fg.func": 2, "fg.amp": fg(5), ...F1K },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 2, coupling: "DC" }, { vdiv: 0.5, coupling: "AC" }] },
      },
      {
        title: { en: "RC differentiator: C9 → VR3", ar: "المفاضل RC: C9 ← VR3" },
        text: {
          en: "Clip C9 (0.01µ) to the bar instead; for the shunt resistor patch the KL-21001 VR3 (100KΩ) A–B into the VR3 at the right and clip it to the rail. With VR3 ≈ 10K (τ = 0.1 ms) the output is a train of spikes at every edge.",
          ar: "اربط C9 (0.01µ) بالقضيب بدلاً من ذلك؛ ولمقاومة التوازي اربط VR3 (100KΩ) من جهاز KL-21001 بطرفيها A–B بـ VR3 في اليمين واربطها بالخط. عند VR3 ≈ 10K (τ = 0.1ms) يكون الخرج نبضات حادة عند كل حافة.",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "green"],
          ["m:d.s3", "m:d.k3", "red", "clip"],
          ["tr:vr3.a", "m:d.v3bA", "blue"],
          ["tr:vr3.b", "m:d.bv3", "blue"],
          ["m:d.bv3", "m:d.r6", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:d.tp1", "osc.ch2": "m:d.tp2" },
        knobs: { "fg.func": 2, "fg.amp": fg(5), ...F1K, vr3: 0.1 },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 2, coupling: "DC" }, { vdiv: 2, coupling: "DC" }] },
      },
      {
        title: { en: "RL circuit: VR1 + R9 → L2", ar: "دائرة RL: VR1 + R9 ← L2" },
        text: {
          en: "Patch the KL-21001 VR1 (1KΩ) A–B between TP1 and B, clip R9 (1K) to the bar and L2 (100mH) down to the rail. τ = L/R ≈ 0.1 ms: the voltage across L spikes at each edge and decays. Turn VR1 and watch τ change.",
          ar: "اربط VR1 (1KΩ) من جهاز KL-21001 بطرفيها A–B بين TP1 و B، واربط R9 (1K) بالقضيب و L2 (100mH) إلى الخط. τ = L/R ≈ 0.1ms: الجهد على الملف يقفز عند كل حافة ثم يضمحل. دوّر VR1 وشاهد تغيّر τ.",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "green"],
          ["tr:vr1.a", "m:d.tp1", "white"],
          ["tr:vr1.b", "m:d.v1B", "white"],
          ["m:d.s2", "m:d.k2", "red", "clip"],
          ["m:d.bL2", "m:d.r5", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:d.tp1", "osc.ch2": "m:d.tp2" },
        knobs: { "fg.func": 2, "fg.amp": fg(5), ...F1K, vr1: 0 },
        scope: { tdiv: 500e-6, ch: [{ vdiv: 2, coupling: "DC" }, { vdiv: 2, coupling: "DC" }] },
      },
      {
        title: { en: "RC low-pass: R10 → C10 (sine)", ar: "مرشح RC للترددات المنخفضة: R10 ← C10 (جيبية)" },
        text: {
          en: "Sine wave into IN; clip R10 (10K) to the bar and C10 (0.01µ) to the rail. Near f = 1/(2πRC) ≈ 1.6 kHz the output is 0.707 of the input with −45°. Sweep the frequency and fill the table.",
          ar: "موجة جيبية إلى IN؛ اربط R10 (10K) بالقضيب و C10 (0.01µ) بالخط. قرب f = 1/(2πRC) ≈ 1.6kHz يكون الخرج 0.707 من الدخل بفرق طور −45°. غيّر التردد واملأ الجدول.",
        },
        wires: [
          ["tr:fg.out", "m:d.in", "green"],
          ["m:d.s4", "m:d.k4", "red", "clip"],
          ["m:d.b10", "m:d.r1", "black", "clip"],
        ],
        leads: { "osc.ch1": "m:d.tp1", "osc.ch2": "m:d.tp2" },
        knobs: { "fg.func": 0, "fg.amp": fg(4), "fg.range": 2, "fg.freq": (1.59 - 1) / 9 },
        scope: { tdiv: 200e-6, ch: [{ vdiv: 1, coupling: "AC" }, { vdiv: 1, coupling: "AC" }] },
      },
    ],
    tables: [{ id: "trc", title: { en: "Frequency response (R10, C10)", ar: "الاستجابة الترددية (R10، C10)" }, cols: ["f (Hz)", "Vin p-p", "Vout p-p", "phase"], rows: ["200", "500", "1k", "1.6k", "2k", "5k", "10k"] }],
  },
];

export const EXPERIMENT_BY_ID = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]));
