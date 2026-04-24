# Circuit Courier

## One-line pitch

A fast browser arcade game where you pilot a growing courier chain through a collapsing neon grid, collect data packets, bank them at uplinks, and escape each sector before greed gets you trapped.

## Why this game fits the current project

The workspace already contains a Snake-style prototype with grid movement, food collection, scoring, and fail-on-collision rules. This concept keeps that readable core but adds a stronger decision loop:

- collecting gives immediate value but makes movement riskier
- banking creates safe scoring windows and route planning
- sector exits and upgrades create progression between runs

## Player fantasy

You are not just surviving. You are a daring courier making one more risky run through unstable digital districts, squeezing out a bigger haul before the grid collapses.

## Primary verbs

- steer
- collect
- bank
- dash
- escape

## Core loop

### Moment-to-moment loop

1. Enter a sector with a short chain, a quota, and one active uplink.
2. Collect data packets to increase carried value and grow your chain.
3. Decide whether to keep pushing for a higher haul or bank at the uplink.
4. Avoid walls, your own tail, and sector hazards while routing toward safe openings.
5. Use a limited dash to cross dangerous lanes or secure a last-second bank.
6. Meet the sector quota, reach the exit gate, and move to the next sector.

### Run loop

1. Start a run in Sector 1.
2. Clear sectors by meeting quota and exiting alive.
3. Choose one upgrade after each sector.
4. Survive until collision, timeout, or corruption overload ends the run.
5. Convert run score into meta progression such as unlocked upgrades, cosmetics, or harder districts.

## The key tension

The snake-like body is both your score engine and your biggest risk.

- more collected data means more value to bank
- more value means a longer body and tighter routes
- banking reduces carried risk and advances the quota
- waiting too long makes the board harder to navigate

That creates the main emotional rhythm: greed, panic, rescue, relief.

## Core systems

### 1. Carried vs banked value

- `carried` is what you currently hold from pickups
- `banked` is safe score after touching an uplink
- dying loses `carried` and ends the run

This adds a real decision that classic Snake does not have.

### 2. Sector hazards

Each sector introduces one modifier so runs stay readable but varied:

- firewall lanes that sweep across rows
- unstable cells that briefly deactivate safe routes
- sentry nodes that occupy tiles on a timer
- corruption fog that closes in if you linger

### 3. Dash ability

- short cooldown
- moves one extra tile instantly in your current direction
- mainly used to recover tempo, not as a full escape button

### 4. Exit quota

You cannot simply survive forever. To leave a sector, you must bank enough value to open the exit gate.

### 5. Upgrade draft

After each sector, pick one simple modifier:

- +1 dash charge
- slower hazard speed for 10 seconds after banking
- chance for double-value data packets
- temporary tail compression after using an uplink
- bonus score for exiting with high carried value

## Failure states

- collide with wall
- collide with your own body
- hit an active hazard
- run out the sector timer
- let corruption meter fill completely

## Progression plan

### Short-term progression inside a run

- higher sector quotas
- denser hazards
- faster board pacing
- stronger upgrade combinations

### Long-term progression across runs

- unlock new district themes
- unlock additional upgrades into the draft pool
- unlock challenge modifiers
- unlock visual ship skins and trail effects

## Target session shape

- first fun: under 10 seconds
- one sector: 30 to 60 seconds
- average run: 5 to 8 minutes
- strong replay loop: "one more run"

## Recommended implementation track

### Near-term

Use the current grid-based JavaScript logic as the design validation layer. It already supports the most important truth: movement, body growth, collision, and spawning on a discrete board.

### Production path

For a fuller version, move to a 2D Phaser structure with:

- simulation state separate from rendering
- one scene for gameplay
- DOM HUD for score, carried value, cooldowns, and upgrade picks
- manifest-based asset keys for audio, FX, and tile themes

## State model to plan around

- `snake`
- `direction`
- `pendingDirection`
- `food` or `dataPackets`
- `carriedValue`
- `bankedScore`
- `sector`
- `sectorQuota`
- `exitOpen`
- `hazards`
- `dashCharges`
- `cooldowns`
- `timer`
- `status`

## Input map

- `move-up`
- `move-down`
- `move-left`
- `move-right`
- `dash`
- `confirm`
- `pause`

## UI surface

Keep the playfield clean and push text-heavy information into a lightweight HUD:

- top bar: score, carried value, sector, timer
- side or bottom strip: dash charges and active upgrade
- modal overlay: pause, upgrade choice, run summary

## MVP scope

Build only the pieces needed to prove the loop:

1. Snake movement and collision
2. Data pickup and body growth
3. Uplink tile that banks carried value
4. Sector quota and exit gate
5. One hazard type
6. One dash ability
7. One upgrade choice between sectors

If that version feels good, then add more hazards, biomes, and meta progression.

## Success criteria

The concept is working if players:

- instantly understand movement and goals
- feel real tension around whether to bank now or stay greedy
- can describe different runs because hazards and upgrades changed their route choices
- want another run after losing
