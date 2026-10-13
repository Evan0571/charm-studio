import { useEffect, useMemo } from 'react';
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three';

function hash(x: number, y: number, z: number) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const smooth = (value: number) => value * value * (3 - 2 * value);
  const sx = smooth(x - ix), sy = smooth(y - iy), sz = smooth(z - iz);
  let value = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
    value += hash(ix + a, iy + b, iz + c) * (a ? sx : 1 - sx) * (b ? sy : 1 - sy) * (c ? sz : 1 - sz);
  }
  return value;
}

/** Sample in object space so the longitude seam and both poles remain continuous. */
export function beadSurfaceSample(shape: string, x: number, y: number, z: number) {
  if (shape === 'wood') {
    const warp = (noise(x * 2, y * 3, z * 2) - .5) * .19;
    const distance = Math.hypot(x + .27 + warp, z - .14 + warp * .4);
    const rings = distance * 39 + .36 * Math.sin(y * 7 + z * 4);
    const latewood = Math.pow(.5 + .5 * Math.sin(rings), 11);
    const fibers = noise(x * 82, y * 5, z * 82);
    const pores = Math.pow(Math.max(0, (fibers - .50) / .50), 4);
    return { tone: .76 - latewood * .31 + (fibers - .5) * .16 - pores * .16, relief: latewood * .27 + pores * .55, roughness: .68 + latewood * .13 + pores * .09 };
  }
  const cloud = noise(x * 2.5 + 3, y * 2.5, z * 2.5) * .68 + noise(x * 8, y * 8 + 7, z * 8) * .32;
  const grain = noise(x * 66, y * 66, z * 66);
  if (shape === 'jade') return { tone: .61 + cloud * .36, relief: grain * .12, roughness: .67 + cloud * .19 };
  return { tone: .94 + cloud * .06, relief: grain * .14, roughness: .72 + grain * .17 };
}

function textureFrom(bytes: Uint8Array, width: number, height: number, color = false) {
  const texture = new DataTexture(bytes, width, height, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  if (color) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createBeadTextures(shape: string) {
  const width = shape === 'wood' ? 512 : 256, height = width / 2;
  const albedo = new Uint8Array(width * height * 4), bump = new Uint8Array(albedo.length), rough = new Uint8Array(albedo.length);
  const low = new Color(shape === 'wood' ? '#986941' : shape === 'jade' ? '#7a9870' : '#f3ebdf').convertLinearToSRGB();
  const high = new Color(shape === 'wood' ? '#d4aa76' : shape === 'jade' ? '#c3d0ad' : '#fffaf2').convertLinearToSRGB();
  for (let v = 0; v < height; v++) for (let u = 0; u < width; u++) {
    const longitude = u / (width - 1) * Math.PI * 2, latitude = v / (height - 1) * Math.PI;
    const sample = beadSurfaceSample(shape, -Math.cos(longitude) * Math.sin(latitude), -Math.cos(latitude), Math.sin(longitude) * Math.sin(latitude));
    const offset = (v * width + u) * 4;
    for (let channel = 0; channel < 3; channel++) {
      const component = channel === 0 ? 'r' : channel === 1 ? 'g' : 'b';
      albedo[offset + channel] = Math.round(255 * (low[component] + (high[component] - low[component]) * sample.tone));
      bump[offset + channel] = Math.round(255 * sample.relief);
      rough[offset + channel] = Math.round(255 * sample.roughness);
    }
    albedo[offset + 3] = bump[offset + 3] = rough[offset + 3] = 255;
  }
  return { map: textureFrom(albedo, width, height, true), bumpMap: textureFrom(bump, width, height), roughnessMap: textureFrom(rough, width, height) };
}

function OrganicBeadMaterial({ shape }: { shape: string }) {
  const textures = useMemo(() => createBeadTextures(shape), [shape]);
  useEffect(() => () => Object.values(textures).forEach(texture => texture.dispose()), [textures]);
  if (shape === 'wood') return <meshPhysicalMaterial {...textures} color="white" roughness={.83} bumpScale={.0015} clearcoat={.17} clearcoatRoughness={.44} envMapIntensity={.8}/>;
  if (shape === 'jade') return <meshPhysicalMaterial {...textures} color="white" roughness={.33} bumpScale={.00065} transmission={.3} thickness={.50} attenuationColor="#a0b684" attenuationDistance={.30} ior={1.49} clearcoat={.58} clearcoatRoughness={.22} envMapIntensity={1.1}/>;
  return <meshPhysicalMaterial {...textures} color="white" roughness={.31} bumpScale={.0004} ior={1.52} clearcoat={.74} clearcoatRoughness={.17} iridescence={.18} iridescenceIOR={1.32} iridescenceThicknessRange={[220, 420]} sheen={.4} sheenColor="#fff0df" sheenRoughness={.37} envMapIntensity={1.15}/>;
}

export function BeadMaterial({ shape }: { shape: string }) {
  if (shape === 'clear' || shape === 'amethyst') {
    const purple = shape === 'amethyst';
    return <meshPhysicalMaterial color={purple ? '#f5edff' : '#ffffff'} metalness={0} roughness={purple ? .055 : .04} transmission={.97} thickness={.49} ior={1.51} attenuationColor={purple ? '#885ab9' : '#d3e5de'} attenuationDistance={purple ? .38 : 2.4} clearcoat={.14} clearcoatRoughness={.09} envMapIntensity={1.3} dispersion={.025}/>;
  }
  return <OrganicBeadMaterial shape={shape}/>;
}
