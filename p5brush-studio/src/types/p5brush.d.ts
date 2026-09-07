/**
 * Minimal typings for the parts of the p5.brush 2.2.2 standalone build that
 * the studio uses. The package ships no types.
 */
declare module 'p5.brush/standalone' {
  export interface TipSurface {
    drawingContext: CanvasRenderingContext2D;
    width: number;
    height: number;
  }

  export interface BrushParams {
    type?: 'default' | 'spray' | 'marker' | 'custom' | 'image';
    weight: number;
    scatter: number;
    opacity: number;
    spacing: number;
    noise?: number;
    pressure?: unknown;
    rotate?: 'none' | 'natural' | 'random';
    markerTip?: boolean;
    tip?: (m: TipSurface) => void;
    [key: string]: unknown;
  }

  export class Plot {
    constructor(type: 'curve' | 'segments');
    length: number;
    addSegment(angle: number, length: number, pressure?: number, degrees?: boolean): void;
    endPlot(angle: number, pressure?: number, degrees?: boolean): void;
    draw(x: number, y: number, scale?: number): Plot;
  }

  export function load(target: HTMLCanvasElement | OffscreenCanvas): void;
  export function clear(...color: unknown[]): void;
  export function render(): void;
  export function push(): void;
  export function pop(): void;
  export function translate(x: number, y: number): void;
  export function rotate(angle: number): void;
  export function scale(x: number, y?: number): void;
  export function seed(s: number | string): void;
  export function noiseSeed(s: number | string): void;
  export function random(a?: number | unknown[], b?: number): number;
  export function add(name: string, params: BrushParams): void | Promise<void>;
  export function set(name: string, color: string, weight?: number): void;
  export function pick(name: string): void;
  export function stroke(...args: unknown[]): void;
  export function strokeWeight(w: number): void;
  export function noStroke(): void;
  export function noFill(): void;
  export function noHatch(): void;
  export function noField(): void;
  export function box(): string[];
  export function scaleBrushes(f: number): void;
  // Fills, washes, hatching and massing on polygons (shape records).
  export function fill(color: string, opacity?: number): void;
  export function fillBleed(strength: number, direction?: 'in' | 'out', angle?: number | null): void;
  export function fillTexture(texture?: number, border?: number, scatter?: boolean): void;
  export function wash(color: string, opacity?: number): void;
  export function noWash(): void;
  export function hatch(dist?: number, angle?: number, options?: { rand?: number | boolean; continuous?: boolean; gradient?: number | boolean }): void;
  export function hatchStyle(brush: string, color?: string, weight?: number): void;
  export function mass(brush: string, color: string, options?: { precision?: number; strength?: number; gradient?: number; outline?: boolean }): void;
  export function noMass(): void;
  export function polygon(points: Array<[number, number]>): unknown;
  export function beginShape(curvature?: number): void;
  export function vertex(x: number, y: number): void;
  export function endShape(close?: boolean): void;
}
