// Projectiles for EMBERFALL KEEP.
// One file, one job: the things that fly across the courtyard — the
// ballista's heavy bolts (friendly) and the spitter's globs of dark
// (hostile). A projectile is a plain object: { x, y, vx, vy, damage,
// friendly, target, life }.
//
// A friendly bolt flies straight and dies on the first shadow it touches.
// A hostile glob flies straight and dies on the first thing it touches
// that it can hurt: the Keeper, or the lighthouse core. Nothing here
// decides damage numbers; the caller (a trap, a spitter) sets the damage
// when it fires, and the hit resolution lives in the step function below.
// Keeping flight and impact in one place means the two projectile kinds
// can never drift apart in behaviour.

export function makeProjectiles() {
  return [];
}

// A ballista bolt: fast, straight, aimed at the target the ballista chose
// when it fired. If the target dies mid-flight, the bolt keeps flying and
// hits whatever it meets first.
export function fireBolt(projectiles, x, y, angle, damage, target) {
  projectiles.push({
    x, y,
    vx: Math.cos(angle) * 620,
    vy: Math.sin(angle) * 620,
    damage,
    friendly: true,
    target,
    life: 1.2,
  });
}

// A spitter glob: slower, arcing in spirit if not in physics, aimed at
// where the Keeper was when the spitter spat.
export function fireGlob(projectiles, x, y, angle, damage) {
  projectiles.push({
    x, y,
    vx: Math.cos(angle) * 260,
    vy: Math.sin(angle) * 260,
    damage,
    friendly: false,
    target: null,
    life: 2.5,
  });
}

// Advance every projectile one step and resolve its hits. The callbacks
// are the game's own damage functions, passed in so this module never has
// to import the whole game: onEnemyHit(enemy, damage), onKeeperHit(damage)
// and onCoreHit(damage). Returns the projectiles still flying.
export function stepProjectiles(projectiles, dt, enemies, keeper, core, hits) {
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.friendly) {
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + 6) {
          hits.onEnemyHit(e, p.damage, p.x, p.y);
          p.life = 0;
          break;
        }
      }
    } else {
      if (keeper.alive && Math.hypot(keeper.x - p.x, keeper.y - p.y) < 16 + 6) {
        hits.onKeeperHit(p.damage);
        p.life = 0;
      } else if (Math.hypot(core.x - p.x, core.y - p.y) < core.radius) {
        hits.onCoreHit(p.damage);
        p.life = 0;
      }
    }
  }
  return projectiles.filter(
    (p) => p.life > 0 && p.x > -20 && p.x < 1280 + 20 && p.y > -20 && p.y < 800 + 20,
  );
}
