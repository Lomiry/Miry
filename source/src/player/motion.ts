export const playerMotion = {
  chrome: { in: 240, out: 280 },
  popover: { in: 160, out: 120 },
  menu: { in: 160, out: 120 },
};
export const playerMotionStyle = {
  "--player-chrome-in": `${playerMotion.chrome.in}ms`,
  "--player-chrome-out": `${playerMotion.chrome.out}ms`,
  "--player-popover-in": `${playerMotion.popover.in}ms`,
  "--player-popover-out": `${playerMotion.popover.out}ms`,
  "--player-menu-in": `${playerMotion.menu.in}ms`,
  "--player-menu-out": `${playerMotion.menu.out}ms`,
};
