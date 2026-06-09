import type { Entity } from './ECS';
import * as PIXI from 'pixi.js';

export interface Position {
  worldX: number;
  worldY: number;
  worldZ: number; // altitude
}

export interface Render {
  sprite: PIXI.Container | PIXI.Graphics;
  anchorX: number;
  anchorY: number;
  texturePrefix?: string;
}

export interface Health {
  currentHP: number;
  maxHP: number;
  state: number; // 0=pristine, 1=light, 2=heavy, 3=rubble
}

export interface Collision {
  width: number;
  length: number;
  height: number;
  active: boolean;
}

export interface Target {
  isHighValue: boolean;
}

export interface Weapon {
  currentSelected: number;
  heatLevel: number;
  fireRate: number;
}



export interface PlayerTag {}

// Flat data maps for the ECS
export const PositionComponent = new Map<Entity, Position>();
export const RenderComponent = new Map<Entity, Render>();
export const HealthComponent = new Map<Entity, Health>();
export const CollisionComponent = new Map<Entity, Collision>();
export const WeaponComponent = new Map<Entity, Weapon>();
export const PlayerComponent = new Map<Entity, PlayerTag>();
export const TargetComponent = new Map<Entity, Target>();

