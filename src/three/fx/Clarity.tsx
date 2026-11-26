"use client";
import { Uniform } from "three";
import { Effect, EffectAttribute } from "postprocessing";
import { wrapEffect } from "@react-three/postprocessing";

/**
 * Final "clarity" pass, applied after tone mapping and anti-aliasing:
 *  - contrast-adaptive sharpening (AMD FidelityFX CAS, 5 taps) restores the
 *    crispness lost to anti-aliasing and display scaling without ringing;
 *  - clarity: midtone local contrast from a wider ring of samples;
 *  - dehaze: pulls the veiled black point down and adds a gentle S-curve.
 * Works in a perceptual (gamma 2.2) space; input and output are linear.
 */
const fragment = /* glsl */ `
uniform float sharpness;
uniform float clarity;
uniform float dehaze;

vec3 toP(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }
vec3 toL(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 t = texelSize;
  vec3 e = toP(inputColor.rgb);
  vec3 a = toP(texture2D(inputBuffer, uv + vec2(-t.x, 0.0)).rgb);
  vec3 b = toP(texture2D(inputBuffer, uv + vec2(t.x, 0.0)).rgb);
  vec3 c = toP(texture2D(inputBuffer, uv + vec2(0.0, -t.y)).rgb);
  vec3 d = toP(texture2D(inputBuffer, uv + vec2(0.0, t.y)).rgb);

  vec3 mn = min(e, min(min(a, b), min(c, d)));
  vec3 mx = max(e, max(max(a, b), max(c, d)));
  vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
  vec3 w = amp * (-1.0 / mix(8.0, 5.0, sharpness));
  vec3 s = clamp(((a + b + c + d) * w + e) / (1.0 + 4.0 * w), 0.0, 1.0);

  vec2 r = t * 4.0;
  float ring = 0.25 * (
    luma(toP(texture2D(inputBuffer, uv + vec2(-r.x, 0.0)).rgb)) +
    luma(toP(texture2D(inputBuffer, uv + vec2(r.x, 0.0)).rgb)) +
    luma(toP(texture2D(inputBuffer, uv + vec2(0.0, -r.y)).rgb)) +
    luma(toP(texture2D(inputBuffer, uv + vec2(0.0, r.y)).rgb)));
  float l = luma(s);
  float mid = clamp(1.0 - abs(l * 2.0 - 1.0), 0.0, 1.0);
  s = clamp(s + (l - ring) * clarity * mid, 0.0, 1.0);

  float bp = 0.035 * dehaze;
  s = clamp((s - bp) / (1.0 - bp), 0.0, 1.0);
  s = mix(s, s * s * (3.0 - 2.0 * s), 0.28 * dehaze);

  outputColor = vec4(toL(s), inputColor.a);
}
`;

export class ClarityEffect extends Effect {
  constructor({ sharpness = 0.6, clarity = 0.3, dehaze = 0.6 }: { sharpness?: number; clarity?: number; dehaze?: number } = {}) {
    super("ClarityEffect", fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["sharpness", new Uniform(sharpness)],
        ["clarity", new Uniform(clarity)],
        ["dehaze", new Uniform(dehaze)],
      ]),
    });
  }
}

export const Clarity = wrapEffect(ClarityEffect);
