import * as PIXI from 'pixi.js';

export class Engine {
  public static app: PIXI.Application;
  
  // Container layers
  public static backgroundLayer: PIXI.Container;
  public static cityLayer: PIXI.Container;
  public static effectsLayer: PIXI.Container;
  public static playerLayer: PIXI.Container;
  public static uiLayer: PIXI.Container;

  // The main container that holds the world and can be moved by the camera
  public static worldContainer: PIXI.Container;

  // Constants for isometric tile width/height
  public static readonly TILE_WIDTH = 64;

  // Screen shake properties
  public static shakeIntensity = 0;
  public static shakeDuration = 0;

  public static triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  public static async init(canvasElement: HTMLCanvasElement) {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: canvasElement,
      resizeTo: window,
      backgroundColor: 0x1a1a2e,
      antialias: true,
    });

    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);

    this.backgroundLayer = new PIXI.Container();
    this.cityLayer = new PIXI.Container();
    this.effectsLayer = new PIXI.Container();
    this.playerLayer = new PIXI.Container();
    
    // UI layer stays on stage so it's not affected by camera
    this.uiLayer = new PIXI.Container();

    // Enable sorting for the layers that need Y-sorting (Z-sorting based on depth)
    this.cityLayer.sortableChildren = true;
    this.playerLayer.sortableChildren = true;

    this.worldContainer.addChild(this.backgroundLayer);
    this.worldContainer.addChild(this.cityLayer);
    this.worldContainer.addChild(this.effectsLayer);
    this.worldContainer.addChild(this.playerLayer);
    
    this.app.stage.addChild(this.uiLayer);
  }

  // 30 degree isometric projection
  public static toScreenX(worldX: number, worldY: number): number {
    // 45-degree rotation matches the tiling sprite's Math.PI/4 rotation
    return (worldX - worldY) * Math.cos(Math.PI / 4) * this.TILE_WIDTH;
  }

  public static toScreenY(worldX: number, worldY: number): number {
    // 45-degree rotation and 0.5 scale matches the tiling sprite's Math.PI/4 rotation and scale.y = 0.5
    return (worldX + worldY) * Math.sin(Math.PI / 4) * 0.5 * this.TILE_WIDTH;
  }
}
