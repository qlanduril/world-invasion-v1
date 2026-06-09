import { Engine } from './Engine';
import { ECS } from './ECS';
import { HealthComponent } from './Components';
import * as PIXI from 'pixi.js';

export class UI {
  private static scoreText: PIXI.Text;
  private static destructionMeterText: PIXI.Text;
  public static score = 0;

  public static init() {
    const style = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 4 },
      dropShadow: { color: 0x000000, blur: 2, angle: Math.PI / 6, distance: 2 }
    });

    this.scoreText = new PIXI.Text({ text: 'Score: 0', style });
    this.scoreText.x = 20;
    this.scoreText.y = 20;

    this.destructionMeterText = new PIXI.Text({ text: 'Destruction: 0%', style });
    this.destructionMeterText.x = 20;
    this.destructionMeterText.y = 60;

    Engine.uiLayer.addChild(this.scoreText);
    Engine.uiLayer.addChild(this.destructionMeterText);
  }

  public static update() {
    this.scoreText.text = `Score: ${Math.floor(this.score)}`;

    let totalBuildings = 0;
    let destroyedBuildings = 0;

    for (const entity of ECS.entities) {
      const health = HealthComponent.get(entity);
      if (health) {
        totalBuildings++;
        if (health.currentHP <= 0) {
          destroyedBuildings++;
        }
      }
    }

    const percentage = totalBuildings === 0 ? 0 : Math.floor((destroyedBuildings / totalBuildings) * 100);
    this.destructionMeterText.text = `Destruction: ${percentage}%`;
  }
}
