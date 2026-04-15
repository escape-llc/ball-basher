# Ball Basher

A Babylon.js game where you control balls to bash them into targets and score points.

## How to Run

1. Open `index.html` in a web browser that supports WebGL.
2. Use arrow keys or WASD to apply force to the controllable balls.
3. The goal is to collide balls with cubes to score points based on multipliers.

## Features

- Physics-based gameplay with Babylon.js and Cannon.js
- Controllable balls with different physical properties
- Dynamic cubes that change states (inert, hole, multipliers, power-ups)
- Increasing difficulty over rounds
- Scoring system with visual feedback

## Controls

- Arrow Keys or WASD: Apply force to balls
- The force vector is applied to all controllable balls

## Game Mechanics

- Rounds last 30 seconds, with increasing force multiplier and gravity
- Extra balls are used when a ball exits the play area
- Cubes spawn different effects: score multipliers, passive balls, gravity adjustments, extra time, extra balls
- Game ends when no scoring objects remain in play