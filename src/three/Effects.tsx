"use client";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping, Vignette, BrightnessContrast, HueSaturation } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import { useBench } from "@/store/bench";
import { Clarity } from "./fx/Clarity";

/**
 * Sharp, clear image: no depth-of-field blur, no film grain, no haze. Everything
 * is in focus; ambient occlusion and the key light's shadows give the depth, and
 * a final clarity pass (adaptive sharpening + dehaze) keeps the print crisp.
 */
export default function Effects() {
  const quality = useBench((s) => s.quality);
  const dpr = useThree((s) => s.viewport.dpr);
  if (quality !== "high") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      {/* full-resolution AO unless the canvas is already supersampled */}
      <N8AO aoRadius={0.07} distanceFalloff={0.5} intensity={2.9} halfRes={dpr >= 1.5} quality="medium" color="#241f18" />
      <Bloom mipmapBlur intensity={0.4} luminanceThreshold={2.6} luminanceSmoothing={0.4} radius={0.55} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <HueSaturation saturation={0.19} />
      <BrightnessContrast brightness={0.0} contrast={0.12} />
      <Vignette offset={0.38} darkness={0.26} blendFunction={BlendFunction.NORMAL} />
      <SMAA />
      <Clarity sharpness={0.75} clarity={0.45} dehaze={0.85} />
    </EffectComposer>
  );
}
