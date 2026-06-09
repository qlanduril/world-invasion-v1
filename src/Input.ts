import { Engine } from './Engine';
import * as PIXI from 'pixi.js';

export class Input {
  public static keys: { [key: string]: boolean } = {};
  public static mouseX: number = 0;
  public static mouseY: number = 0;
  public static mouseDown: boolean = false;

  public static init() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Make the stage interactive to get mouse positions
    Engine.app.stage.eventMode = 'static';
    Engine.app.stage.hitArea = new PIXI.Rectangle(0, 0, 10000, 10000); // large hit area or just resize it
    
    Engine.app.stage.on('pointermove', (e) => {
      // Get position relative to worldContainer so it respects camera
      const pos = e.getLocalPosition(Engine.worldContainer);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
    });

    Engine.app.stage.on('pointerdown', (e) => {
      this.mouseDown = true;
      const pos = e.getLocalPosition(Engine.worldContainer);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
    });

    Engine.app.stage.on('pointerup', () => {
      this.mouseDown = false;
    });
    Engine.app.stage.on('pointerupoutside', () => {
      this.mouseDown = false;
    });
  }
}
