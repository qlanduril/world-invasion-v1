import * as PIXI from 'pixi.js';

import blast00 from './assets/blast/frame_0.png';
import blast01 from './assets/blast/frame_1.png';
import blast02 from './assets/blast/frame_2.png';
import blast03 from './assets/blast/frame_3.png';
import blast04 from './assets/blast/frame_4.png';
import blast05 from './assets/blast/frame_5.png';
import blast06 from './assets/blast/frame_6.png';
import blast07 from './assets/blast/frame_7.png';
import blast08 from './assets/blast/frame_8.png';
import blast09 from './assets/blast/frame_9.png';
import blast10 from './assets/blast/frame_10.png';

import blast360_00 from './assets/blast360/frame_0.png';
import blast360_01 from './assets/blast360/frame_1.png';
import blast360_02 from './assets/blast360/frame_2.png';
import blast360_03 from './assets/blast360/frame_3.png';
import blast360_04 from './assets/blast360/frame_4.png';
import blast360_05 from './assets/blast360/frame_5.png';
import blast360_06 from './assets/blast360/frame_6.png';

import fire00 from './assets/fire/frame_0.png';
import fire01 from './assets/fire/frame_1.png';
import fire02 from './assets/fire/frame_2.png';
import fire03 from './assets/fire/frame_3.png';
import fire04 from './assets/fire/frame_4.png';
import fire05 from './assets/fire/frame_5.png';
import fire06 from './assets/fire/frame_6.png';
import fire07 from './assets/fire/frame_7.png';
import fire08 from './assets/fire/frame_8.png';

import school00 from './assets/building/school/00_pristine.png';
import school01 from './assets/building/school/01_damaged_1.png';
import school02 from './assets/building/school/02_damaged_2.png';
import school03 from './assets/building/school/03_damaged_3.png';
import school04 from './assets/building/school/04_damaged_4.png';
import school05 from './assets/building/school/05_damaged_5.png';
import school06 from './assets/building/school/06_damaged_6.png';
import school07 from './assets/building/school/07_damaged_7.png';
import school08 from './assets/building/school/08_damaged_8.png';
import school09 from './assets/building/school/09_damaged_9.png';
import school10 from './assets/building/school/10_damaged_10.png';
import school11 from './assets/building/school/11_damaged_11.png';
import school12 from './assets/building/school/12_damaged_12.png';
import school13 from './assets/building/school/13_damaged_13.png';
import school14 from './assets/building/school/14_rubble.png';

import hospital00 from './assets/hospital/frame_0.png';
import hospital01 from './assets/hospital/frame_1.png';
import hospital02 from './assets/hospital/frame_2.png';
import hospital03 from './assets/hospital/frame_3.png';
import hospital04 from './assets/hospital/frame_4.png';
import hospital05 from './assets/hospital/frame_5.png';
import hospital06 from './assets/hospital/frame_6.png';
import hospital07 from './assets/hospital/frame_7.png';
import hospital08 from './assets/hospital/frame_8.png';
import hospital09 from './assets/hospital/frame_9.png';
import hospital10 from './assets/hospital/frame_10.png';
import hospital11 from './assets/hospital/frame_11.png';
import hospital12 from './assets/hospital/frame_12.png';
import hospital13 from './assets/hospital/frame_13.png';
import hospital14 from './assets/hospital/frame_14.png';
import hospital15 from './assets/hospital/frame_15.png';
import hospital16 from './assets/hospital/frame_16.png';
import hospital17 from './assets/hospital/frame_17.png';
import hospital18 from './assets/hospital/frame_18.png';
import hospital19 from './assets/hospital/frame_19.png';

import ground from './assets/ground.png';
import cityBackground from './assets/city_background.png';
import cityBackgroundTopdown from './assets/city_background_topdown.png';
import cityBackgroundTopdownRed from './assets/city_background_topdown_red.png';

const blastPaths = [
  blast00, blast01, blast02, blast03, blast04,
  blast05, blast06, blast07, blast08, blast09, blast10
];

const blast360Paths = [
  blast360_00, blast360_01, blast360_02, blast360_03,
  blast360_04, blast360_05, blast360_06
];

const firePaths = [
  fire00, fire01, fire02, fire03, fire04,
  fire05, fire06, fire07, fire08
];

const schoolPaths = [
  school00, school01, school02, school03, school04,
  school05, school06, school07, school08, school09,
  school10, school11, school12, school13, school14
];

const hospitalHorizontalPaths = [
  hospital00, hospital01, hospital02, hospital03, hospital04,
  hospital05, hospital06, hospital07, hospital08, hospital09
];

const hospitalVerticalPaths = [
  hospital10, hospital11, hospital12, hospital13, hospital14,
  hospital15, hospital16, hospital17, hospital18, hospital19
];

export class Assets {
  public static textures: Record<string, PIXI.Texture> = {};
  public static explosionFrames: PIXI.Texture[] = [];
  public static explosion360Frames: PIXI.Texture[] = [];
  public static fireFrames: PIXI.Texture[] = [];

  public static async initAssets() {
    this.textures['ground'] = await PIXI.Assets.load(ground);
    this.textures['city_background'] = await PIXI.Assets.load(cityBackground);
    this.textures['city_background_topdown'] = await PIXI.Assets.load(cityBackgroundTopdown);
    this.textures['city_background_topdown_red'] = await PIXI.Assets.load(cityBackgroundTopdownRed);
    await this.loadIndividualFrames('3', schoolPaths);
    await this.loadIndividualFrames('1_horizontal', hospitalHorizontalPaths);
    await this.loadIndividualFrames('1_vertical', hospitalVerticalPaths);
    await this.loadExplosionFrames(blastPaths);
    await this.loadExplosion360Frames(blast360Paths);
    await this.loadFireFrames(firePaths);
  }

  private static async loadIndividualFrames(id: string, paths: string[]) {
    for (let i = 0; i < paths.length; i++) {
      const texture = await PIXI.Assets.load(paths[i]);
      await this.setOptimalAnchor(texture);
      this.textures[`building_${id}_stage_${i}`] = texture;
    }
  }

  private static async setOptimalAnchor(texture: PIXI.Texture) {
    const resource = texture.source?.resource;
    if (!resource) {
      if (texture.defaultAnchor) {
        texture.defaultAnchor.x = 0.5;
        texture.defaultAnchor.y = 1.0;
      }
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const width = resource.naturalWidth || resource.width || (resource as any).videoWidth || texture.width;
      const height = resource.naturalHeight || resource.height || (resource as any).videoHeight || texture.height;
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(resource as any, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        
        let ymin = height;
        let ymax = 0;
        let xmin = width;
        let xmax = 0;
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 10) { // Threshold for non-transparency
              if (y < ymin) ymin = y;
              if (y > ymax) ymax = y;
              if (x < xmin) xmin = x;
              if (x > xmax) xmax = x;
            }
          }
        }
        
        if (ymax > 0 && xmax > 0) {
          const centerX = (xmin + xmax) / 2;
          const optimalX = centerX / width;
          const optimalY = ymax / height;
          if (texture.defaultAnchor) {
            texture.defaultAnchor.x = optimalX;
            texture.defaultAnchor.y = optimalY;
          }
        } else {
          if (texture.defaultAnchor) {
            texture.defaultAnchor.x = 0.5;
            texture.defaultAnchor.y = 1.0;
          }
        }
      } else {
        if (texture.defaultAnchor) {
          texture.defaultAnchor.x = 0.5;
          texture.defaultAnchor.y = 1.0;
        }
      }
    } catch (e) {
      console.warn("Could not compute optimal anchor, using fallback:", e);
      if (texture.defaultAnchor) {
        texture.defaultAnchor.x = 0.5;
        texture.defaultAnchor.y = 1.0;
      }
    }
  }

  private static async loadExplosionFrames(paths: string[]) {
    for (let i = 0; i < paths.length; i++) {
      const texture = await PIXI.Assets.load(paths[i]);
      if (texture.defaultAnchor) {
        texture.defaultAnchor.set(0.5, 0.5);
      }
      this.explosionFrames.push(texture);
    }
  }

  private static async loadExplosion360Frames(paths: string[]) {
    for (let i = 0; i < paths.length; i++) {
      const texture = await PIXI.Assets.load(paths[i]);
      if (texture.defaultAnchor) {
        texture.defaultAnchor.set(0.5, 0.5);
      }
      this.explosion360Frames.push(texture);
    }
  }

  private static async loadFireFrames(paths: string[]) {
    for (let i = 0; i < paths.length; i++) {
      const texture = await PIXI.Assets.load(paths[i]);
      if (texture.defaultAnchor) {
        texture.defaultAnchor.set(0.5, 1.0); // bottom anchor for ground placement
      }
      this.fireFrames.push(texture);
    }
  }
}
