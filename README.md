# Alien Invasion (alinv)

An interactive, high-fidelity isometric city destruction simulator built with **TypeScript**, **PixiJS (v8)**, and an **Entity Component System (ECS)**. 

Control an alien UFO, target city infrastructure, fire high-intensity lasers, and watch buildings crumble in real-time with dynamic physics-based particles, fire, smoke, and camera shake.

---

## 📸 Gameplay Screenshot

![Alien Invasion Gameplay](src/assets/screenshot.png)
*(To show your gameplay screenshot here, take a screenshot of the game, save it as `screenshot.png` inside the `src/assets/` folder, and commit it!)*

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### Installation
1. Clone this repository (ensure you track the project root):
   ```bash
   git clone <your-repository-url>
   cd alinv
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
Start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to play.

### Building for Production
To build the optimized production assets:
```bash
npm run build
```
The output will be generated in the `dist/` directory.

---

## 🎮 How to Play & Controls

| Action | Control |
|---|---|
| **Move UFO** | `W` `A` `S` `D` or Arrow Keys |
| **Fire Laser** | Hold **Left Mouse Click** |
| **Aim** | Move the cursor |

---

## 🏗️ Technical Architecture

This game utilizes a pure **Entity Component System (ECS)** architecture, decoupling logic and physics states from the rendering loop:

- **ECS Kernel (`src/ECS.ts`)**: Manages entities, registers logic systems, and coordinates execution ticks.
- **Component Maps (`src/Components.ts`)**: Flat, efficient database storing entity properties (Position, Health, Collision, Weapon, Render, Target).
- **Player Control System (`src/Systems/PlayerControlSystem.ts`)**: Handles movement constraints, weapon heat/cooldown, and raycast hit detection against building AABB volumes.
- **Destruction System (`src/Systems/DestructionSystem.ts`)**: Maps building health levels down to 15 distinct sprite damage stages. Triggers explosion sequences, launches debris bursts, shakes the camera, and spawns fire/smoke triggers at peak opacity.
- **Particle System (`src/Systems/ParticleSystem.ts`)**: Coordinates high-performance graphics object pools for ambient smoke, embers, and gravity-affected debris chunks.
- **Render System (`src/Systems/RenderSystem.ts`)**: Calculates 2.5D screen coordinates and applies dynamic Y-sorting depth overrides to handle tall buildings correctly.

---

## 📁 File Structure

```
alinv/
├── src/
│   ├── assets/              # Spritesheets, sound, and level maps
│   ├── Systems/             # ECS Logic (Destruction, Particles, Player Control, Render)
│   ├── Assets.ts            # Asset loader and optimal anchor calculator
│   ├── Components.ts        # ECS Component data structures
│   ├── ECS.ts               # ECS Engine base
│   ├── Engine.ts            # PixiJS application initialization and projection formulas
│   ├── Input.ts             # Keyboard and mouse pointer handlers
│   ├── UI.ts                # Score and destruction HUD overlay
│   └── main.ts              # Entry point and procedural grid generator
├── index.html
├── package.json
└── tsconfig.json
```
