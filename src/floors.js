export const FLOOR_CONFIGS = [
  {
    id: 'F1',
    name: 'F1: Ruins',
    depth: 1,
    spawn: { x: 2, y: 6 },
    enemy: { x: 14, y: 6, hp: 30, speed: 2.2, aggroRange: 7.5, attackRange: 1.2, attackDamage: 8, attackCooldown: 1.4 },
    traps: [
      { x: 8, y: 4, damage: 15 },
      { x: 12, y: 8, damage: 15 },
    ],
    treasures: [
      { x: 6, y: 9, gold: 20 },
    ],
    exit: { x: 18, y: 6 },
    nextOptions: [
      { id: 'F2A', label: '戦闘' },
      { id: 'F2B', label: '宝箱' },
    ],
  },
  {
    id: 'F2A',
    name: 'F2A: Battle',
    depth: 2,
    spawn: { x: 2, y: 3 },
    enemy: { x: 15, y: 8, hp: 45, speed: 2.6, aggroRange: 8.5, attackRange: 1.3, attackDamage: 10, attackCooldown: 1.2 },
    traps: [
      { x: 7, y: 3, damage: 18 },
      { x: 10, y: 6, damage: 18 },
      { x: 13, y: 9, damage: 18 },
    ],
    treasures: [
      { x: 5, y: 10, gold: 25 },
    ],
    exit: { x: 18, y: 9 },
  },
  {
    id: 'F2B',
    name: 'F2B: Treasure',
    depth: 2,
    spawn: { x: 2, y: 8 },
    enemy: { x: 14, y: 4, hp: 38, speed: 2.4, aggroRange: 8.0, attackRange: 1.3, attackDamage: 9, attackCooldown: 1.3 },
    traps: [
      { x: 9, y: 7, damage: 16 },
    ],
    treasures: [
      { x: 6, y: 6, gold: 35 },
      { x: 11, y: 9, gold: 25 },
    ],
    exit: { x: 18, y: 4 },
  },
];

export const FLOOR_INDEX = new Map(FLOOR_CONFIGS.map((config, index) => [config.id, index]));

export const TOTAL_DEPTH = Math.max(...FLOOR_CONFIGS.map((config) => config.depth));

export function getFloorConfig(index) {
  return FLOOR_CONFIGS[index] || null;
}

export function getFloorIndex(id) {
  return FLOOR_INDEX.get(id);
}
