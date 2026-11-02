// Hearthwood service worker: makes the village installable and playable offline.
//
// - Install: saves every file of the site plus the libraries and fonts it loads from CDNs.
// - Our own files: network first, so an online visit always gets the latest version; the saved
//   copy is refreshed each time and used when offline (or when the network is very slow).
// - CDN files: their URLs carry exact versions, so the saved copy is used directly.
//
// The VERSION and FILES lists below are written by tools/build_sw.py. Run it after adding,
// removing or changing files:  python3 tools/build_sw.py

// <generated>
const VERSION = '93847ea432df';
const FILES = [
"index.html",
"manifest.webmanifest",
"src/audio.js",
"src/backup.js",
"src/book3d.js",
"src/character.js",
"src/db.js",
"src/dialogue.js",
"src/environment.js",
"src/epub.js",
"src/experience.js",
"src/fishing.js",
"src/halloween.js",
"src/life.js",
"src/main.js",
"src/nook.js",
"src/npcs.js",
"src/pdf.js",
"src/perf.js",
"src/pomodoro.js",
"src/portfolio.js",
"src/profile.js",
"src/pwa.js",
"src/reader.js",
"src/scenery.js",
"src/signs.js",
"src/style.css",
"src/toon.js",
"src/ui.js",
"src/weather.js",
"src/world.js",
"assets/audio/fire.mp3",
"assets/audio/rain.mp3",
"assets/icon.svg",
"assets/icons/apple-touch-icon.png",
"assets/icons/icon-192.png",
"assets/icons/icon-512.png",
"assets/icons/maskable-512.png",
"assets/kaykit/Barbarian.glb",
"assets/kaykit/Knight.glb",
"assets/kaykit/Mage.glb",
"assets/kaykit/Ranger.glb",
"assets/kaykit/Rogue.glb",
"assets/kaykit/Rogue_Hooded.glb",
"assets/kaykit/mage_texture.png",
"assets/kaykit/rig-general.glb",
"assets/kaykit/rig-movement.glb",
"assets/kaykit/spellbook_closed.bin",
"assets/kaykit/spellbook_closed.gltf",
"assets/kaykit/spellbook_open.bin",
"assets/kaykit/spellbook_open.gltf",
"assets/nature/bed.glb",
"assets/nature/bed_floor.glb",
"assets/nature/bridge_center_stone.glb",
"assets/nature/bridge_center_stoneRound.glb",
"assets/nature/bridge_center_wood.glb",
"assets/nature/bridge_center_woodRound.glb",
"assets/nature/bridge_side_stone.glb",
"assets/nature/bridge_side_stoneRound.glb",
"assets/nature/bridge_side_wood.glb",
"assets/nature/bridge_side_woodRound.glb",
"assets/nature/bridge_stone.glb",
"assets/nature/bridge_stoneNarrow.glb",
"assets/nature/bridge_stoneRound.glb",
"assets/nature/bridge_stoneRoundNarrow.glb",
"assets/nature/bridge_wood.glb",
"assets/nature/bridge_woodNarrow.glb",
"assets/nature/bridge_woodRound.glb",
"assets/nature/bridge_woodRoundNarrow.glb",
"assets/nature/cactus_short.glb",
"assets/nature/cactus_tall.glb",
"assets/nature/campfire_bricks.glb",
"assets/nature/campfire_logs.glb",
"assets/nature/campfire_planks.glb",
"assets/nature/campfire_stones.glb",
"assets/nature/canoe.glb",
"assets/nature/canoe_paddle.glb",
"assets/nature/cliff_blockCave_rock.glb",
"assets/nature/cliff_blockCave_stone.glb",
"assets/nature/cliff_blockDiagonal_rock.glb",
"assets/nature/cliff_blockDiagonal_stone.glb",
"assets/nature/cliff_blockHalf_rock.glb",
"assets/nature/cliff_blockHalf_stone.glb",
"assets/nature/cliff_blockQuarter_rock.glb",
"assets/nature/cliff_blockQuarter_stone.glb",
"assets/nature/cliff_blockSlopeHalfWalls_rock.glb",
"assets/nature/cliff_blockSlopeHalfWalls_stone.glb",
"assets/nature/cliff_blockSlopeWalls_rock.glb",
"assets/nature/cliff_blockSlopeWalls_stone.glb",
"assets/nature/cliff_blockSlope_rock.glb",
"assets/nature/cliff_blockSlope_stone.glb",
"assets/nature/cliff_block_rock.glb",
"assets/nature/cliff_block_stone.glb",
"assets/nature/cliff_cave_rock.glb",
"assets/nature/cliff_cave_stone.glb",
"assets/nature/cliff_cornerInnerLarge_rock.glb",
"assets/nature/cliff_cornerInnerLarge_stone.glb",
"assets/nature/cliff_cornerInnerTop_rock.glb",
"assets/nature/cliff_cornerInnerTop_stone.glb",
"assets/nature/cliff_cornerInner_rock.glb",
"assets/nature/cliff_cornerInner_stone.glb",
"assets/nature/cliff_cornerLarge_rock.glb",
"assets/nature/cliff_cornerLarge_stone.glb",
"assets/nature/cliff_cornerTop_rock.glb",
"assets/nature/cliff_cornerTop_stone.glb",
"assets/nature/cliff_corner_rock.glb",
"assets/nature/cliff_corner_stone.glb",
"assets/nature/cliff_diagonal_rock.glb",
"assets/nature/cliff_diagonal_stone.glb",
"assets/nature/cliff_halfCornerInner_rock.glb",
"assets/nature/cliff_halfCornerInner_stone.glb",
"assets/nature/cliff_halfCorner_rock.glb",
"assets/nature/cliff_halfCorner_stone.glb",
"assets/nature/cliff_half_rock.glb",
"assets/nature/cliff_half_stone.glb",
"assets/nature/cliff_large_rock.glb",
"assets/nature/cliff_large_stone.glb",
"assets/nature/cliff_rock.glb",
"assets/nature/cliff_stepsCornerInner_rock.glb",
"assets/nature/cliff_stepsCornerInner_stone.glb",
"assets/nature/cliff_stepsCorner_rock.glb",
"assets/nature/cliff_stepsCorner_stone.glb",
"assets/nature/cliff_steps_rock.glb",
"assets/nature/cliff_steps_stone.glb",
"assets/nature/cliff_stone.glb",
"assets/nature/cliff_topDiagonal_rock.glb",
"assets/nature/cliff_topDiagonal_stone.glb",
"assets/nature/cliff_top_rock.glb",
"assets/nature/cliff_top_stone.glb",
"assets/nature/cliff_waterfallTop_rock.glb",
"assets/nature/cliff_waterfallTop_stone.glb",
"assets/nature/cliff_waterfall_rock.glb",
"assets/nature/cliff_waterfall_stone.glb",
"assets/nature/crop_carrot.glb",
"assets/nature/crop_melon.glb",
"assets/nature/crop_pumpkin.glb",
"assets/nature/crop_turnip.glb",
"assets/nature/crops_bambooStageA.glb",
"assets/nature/crops_bambooStageB.glb",
"assets/nature/crops_cornStageA.glb",
"assets/nature/crops_cornStageB.glb",
"assets/nature/crops_cornStageC.glb",
"assets/nature/crops_cornStageD.glb",
"assets/nature/crops_dirtDoubleRow.glb",
"assets/nature/crops_dirtDoubleRowCorner.glb",
"assets/nature/crops_dirtDoubleRowEnd.glb",
"assets/nature/crops_dirtRow.glb",
"assets/nature/crops_dirtRowCorner.glb",
"assets/nature/crops_dirtRowEnd.glb",
"assets/nature/crops_dirtSingle.glb",
"assets/nature/crops_leafsStageA.glb",
"assets/nature/crops_leafsStageB.glb",
"assets/nature/crops_wheatStageA.glb",
"assets/nature/crops_wheatStageB.glb",
"assets/nature/fence_bend.glb",
"assets/nature/fence_bendCenter.glb",
"assets/nature/fence_corner.glb",
"assets/nature/fence_gate.glb",
"assets/nature/fence_planks.glb",
"assets/nature/fence_planksDouble.glb",
"assets/nature/fence_simple.glb",
"assets/nature/fence_simpleCenter.glb",
"assets/nature/fence_simpleDiagonal.glb",
"assets/nature/fence_simpleDiagonalCenter.glb",
"assets/nature/fence_simpleHigh.glb",
"assets/nature/fence_simpleLow.glb",
"assets/nature/flower_purpleA.glb",
"assets/nature/flower_purpleB.glb",
"assets/nature/flower_purpleC.glb",
"assets/nature/flower_redA.glb",
"assets/nature/flower_redB.glb",
"assets/nature/flower_redC.glb",
"assets/nature/flower_yellowA.glb",
"assets/nature/flower_yellowB.glb",
"assets/nature/flower_yellowC.glb",
"assets/nature/grass.glb",
"assets/nature/grass_large.glb",
"assets/nature/grass_leafs.glb",
"assets/nature/grass_leafsLarge.glb",
"assets/nature/ground_grass.glb",
"assets/nature/ground_pathBend.glb",
"assets/nature/ground_pathBendBank.glb",
"assets/nature/ground_pathCorner.glb",
"assets/nature/ground_pathCornerSmall.glb",
"assets/nature/ground_pathCross.glb",
"assets/nature/ground_pathEnd.glb",
"assets/nature/ground_pathEndClosed.glb",
"assets/nature/ground_pathOpen.glb",
"assets/nature/ground_pathRocks.glb",
"assets/nature/ground_pathSide.glb",
"assets/nature/ground_pathSideOpen.glb",
"assets/nature/ground_pathSplit.glb",
"assets/nature/ground_pathStraight.glb",
"assets/nature/ground_pathTile.glb",
"assets/nature/ground_riverBend.glb",
"assets/nature/ground_riverBendBank.glb",
"assets/nature/ground_riverCorner.glb",
"assets/nature/ground_riverCornerSmall.glb",
"assets/nature/ground_riverCross.glb",
"assets/nature/ground_riverEnd.glb",
"assets/nature/ground_riverEndClosed.glb",
"assets/nature/ground_riverOpen.glb",
"assets/nature/ground_riverRocks.glb",
"assets/nature/ground_riverSide.glb",
"assets/nature/ground_riverSideOpen.glb",
"assets/nature/ground_riverSplit.glb",
"assets/nature/ground_riverStraight.glb",
"assets/nature/ground_riverTile.glb",
"assets/nature/hanging_moss.glb",
"assets/nature/lily_large.glb",
"assets/nature/lily_small.glb",
"assets/nature/log.glb",
"assets/nature/log_large.glb",
"assets/nature/log_stack.glb",
"assets/nature/log_stackLarge.glb",
"assets/nature/mushroom_red.glb",
"assets/nature/mushroom_redGroup.glb",
"assets/nature/mushroom_redTall.glb",
"assets/nature/mushroom_tan.glb",
"assets/nature/mushroom_tanGroup.glb",
"assets/nature/mushroom_tanTall.glb",
"assets/nature/path_stone.glb",
"assets/nature/path_stoneCircle.glb",
"assets/nature/path_stoneCorner.glb",
"assets/nature/path_stoneEnd.glb",
"assets/nature/path_wood.glb",
"assets/nature/path_woodCorner.glb",
"assets/nature/path_woodEnd.glb",
"assets/nature/plant_bush.glb",
"assets/nature/plant_bushDetailed.glb",
"assets/nature/plant_bushLarge.glb",
"assets/nature/plant_bushLargeTriangle.glb",
"assets/nature/plant_bushSmall.glb",
"assets/nature/plant_bushTriangle.glb",
"assets/nature/plant_flatShort.glb",
"assets/nature/plant_flatTall.glb",
"assets/nature/platform_beach.glb",
"assets/nature/platform_grass.glb",
"assets/nature/platform_stone.glb",
"assets/nature/pot_large.glb",
"assets/nature/pot_small.glb",
"assets/nature/rock_largeA.glb",
"assets/nature/rock_largeB.glb",
"assets/nature/rock_largeC.glb",
"assets/nature/rock_largeD.glb",
"assets/nature/rock_largeE.glb",
"assets/nature/rock_largeF.glb",
"assets/nature/rock_smallA.glb",
"assets/nature/rock_smallB.glb",
"assets/nature/rock_smallC.glb",
"assets/nature/rock_smallD.glb",
"assets/nature/rock_smallE.glb",
"assets/nature/rock_smallF.glb",
"assets/nature/rock_smallFlatA.glb",
"assets/nature/rock_smallFlatB.glb",
"assets/nature/rock_smallFlatC.glb",
"assets/nature/rock_smallG.glb",
"assets/nature/rock_smallH.glb",
"assets/nature/rock_smallI.glb",
"assets/nature/rock_smallTopA.glb",
"assets/nature/rock_smallTopB.glb",
"assets/nature/rock_tallA.glb",
"assets/nature/rock_tallB.glb",
"assets/nature/rock_tallC.glb",
"assets/nature/rock_tallD.glb",
"assets/nature/rock_tallE.glb",
"assets/nature/rock_tallF.glb",
"assets/nature/rock_tallG.glb",
"assets/nature/rock_tallH.glb",
"assets/nature/rock_tallI.glb",
"assets/nature/rock_tallJ.glb",
"assets/nature/sign.glb",
"assets/nature/statue_block.glb",
"assets/nature/statue_column.glb",
"assets/nature/statue_columnDamaged.glb",
"assets/nature/statue_head.glb",
"assets/nature/statue_obelisk.glb",
"assets/nature/statue_ring.glb",
"assets/nature/stone_largeA.glb",
"assets/nature/stone_largeB.glb",
"assets/nature/stone_largeC.glb",
"assets/nature/stone_largeD.glb",
"assets/nature/stone_largeE.glb",
"assets/nature/stone_largeF.glb",
"assets/nature/stone_smallA.glb",
"assets/nature/stone_smallB.glb",
"assets/nature/stone_smallC.glb",
"assets/nature/stone_smallD.glb",
"assets/nature/stone_smallE.glb",
"assets/nature/stone_smallF.glb",
"assets/nature/stone_smallFlatA.glb",
"assets/nature/stone_smallFlatB.glb",
"assets/nature/stone_smallFlatC.glb",
"assets/nature/stone_smallG.glb",
"assets/nature/stone_smallH.glb",
"assets/nature/stone_smallI.glb",
"assets/nature/stone_smallTopA.glb",
"assets/nature/stone_smallTopB.glb",
"assets/nature/stone_tallA.glb",
"assets/nature/stone_tallB.glb",
"assets/nature/stone_tallC.glb",
"assets/nature/stone_tallD.glb",
"assets/nature/stone_tallE.glb",
"assets/nature/stone_tallF.glb",
"assets/nature/stone_tallG.glb",
"assets/nature/stone_tallH.glb",
"assets/nature/stone_tallI.glb",
"assets/nature/stone_tallJ.glb",
"assets/nature/stump_old.glb",
"assets/nature/stump_oldTall.glb",
"assets/nature/stump_round.glb",
"assets/nature/stump_roundDetailed.glb",
"assets/nature/stump_square.glb",
"assets/nature/stump_squareDetailed.glb",
"assets/nature/stump_squareDetailedWide.glb",
"assets/nature/tent_detailedClosed.glb",
"assets/nature/tent_detailedOpen.glb",
"assets/nature/tent_smallClosed.glb",
"assets/nature/tent_smallOpen.glb",
"assets/nature/tree_blocks.glb",
"assets/nature/tree_blocks_dark.glb",
"assets/nature/tree_blocks_fall.glb",
"assets/nature/tree_cone.glb",
"assets/nature/tree_cone_dark.glb",
"assets/nature/tree_cone_fall.glb",
"assets/nature/tree_default.glb",
"assets/nature/tree_default_dark.glb",
"assets/nature/tree_default_fall.glb",
"assets/nature/tree_detailed.glb",
"assets/nature/tree_detailed_dark.glb",
"assets/nature/tree_detailed_fall.glb",
"assets/nature/tree_fat.glb",
"assets/nature/tree_fat_darkh.glb",
"assets/nature/tree_fat_fall.glb",
"assets/nature/tree_oak.glb",
"assets/nature/tree_oak_dark.glb",
"assets/nature/tree_oak_fall.glb",
"assets/nature/tree_palm.glb",
"assets/nature/tree_palmBend.glb",
"assets/nature/tree_palmDetailedShort.glb",
"assets/nature/tree_palmDetailedTall.glb",
"assets/nature/tree_palmShort.glb",
"assets/nature/tree_palmTall.glb",
"assets/nature/tree_pineDefaultA.glb",
"assets/nature/tree_pineDefaultB.glb",
"assets/nature/tree_pineGroundA.glb",
"assets/nature/tree_pineGroundB.glb",
"assets/nature/tree_pineRoundA.glb",
"assets/nature/tree_pineRoundB.glb",
"assets/nature/tree_pineRoundC.glb",
"assets/nature/tree_pineRoundD.glb",
"assets/nature/tree_pineRoundE.glb",
"assets/nature/tree_pineRoundF.glb",
"assets/nature/tree_pineSmallA.glb",
"assets/nature/tree_pineSmallB.glb",
"assets/nature/tree_pineSmallC.glb",
"assets/nature/tree_pineSmallD.glb",
"assets/nature/tree_pineTallA.glb",
"assets/nature/tree_pineTallA_detailed.glb",
"assets/nature/tree_pineTallB.glb",
"assets/nature/tree_pineTallB_detailed.glb",
"assets/nature/tree_pineTallC.glb",
"assets/nature/tree_pineTallC_detailed.glb",
"assets/nature/tree_pineTallD.glb",
"assets/nature/tree_pineTallD_detailed.glb",
"assets/nature/tree_plateau.glb",
"assets/nature/tree_plateau_dark.glb",
"assets/nature/tree_plateau_fall.glb",
"assets/nature/tree_simple.glb",
"assets/nature/tree_simple_dark.glb",
"assets/nature/tree_simple_fall.glb",
"assets/nature/tree_small.glb",
"assets/nature/tree_small_dark.glb",
"assets/nature/tree_small_fall.glb",
"assets/nature/tree_tall.glb",
"assets/nature/tree_tall_dark.glb",
"assets/nature/tree_tall_fall.glb",
"assets/nature/tree_thin.glb",
"assets/nature/tree_thin_dark.glb",
"assets/nature/tree_thin_fall.glb",
"assets/survival/Textures/colormap.png",
"assets/survival/barrel-open.glb",
"assets/survival/barrel.glb",
"assets/survival/bedroll-frame.glb",
"assets/survival/bedroll-packed.glb",
"assets/survival/bedroll.glb",
"assets/survival/bottle-large.glb",
"assets/survival/bottle.glb",
"assets/survival/box-large-open.glb",
"assets/survival/box-large.glb",
"assets/survival/box-open.glb",
"assets/survival/box.glb",
"assets/survival/bucket.glb",
"assets/survival/campfire-fishing-stand.glb",
"assets/survival/campfire-pit.glb",
"assets/survival/campfire-stand.glb",
"assets/survival/chest.glb",
"assets/survival/fence-doorway.glb",
"assets/survival/fence-fortified.glb",
"assets/survival/fence.glb",
"assets/survival/fish-large.glb",
"assets/survival/fish.glb",
"assets/survival/floor-hole.glb",
"assets/survival/floor-old.glb",
"assets/survival/floor.glb",
"assets/survival/grass-large.glb",
"assets/survival/grass.glb",
"assets/survival/metal-panel-narrow.glb",
"assets/survival/metal-panel-screws-half.glb",
"assets/survival/metal-panel-screws-narrow.glb",
"assets/survival/metal-panel-screws.glb",
"assets/survival/metal-panel.glb",
"assets/survival/patch-grass-large.glb",
"assets/survival/patch-grass.glb",
"assets/survival/resource-planks.glb",
"assets/survival/resource-stone-large.glb",
"assets/survival/resource-stone.glb",
"assets/survival/resource-wood.glb",
"assets/survival/rock-a.glb",
"assets/survival/rock-b.glb",
"assets/survival/rock-c.glb",
"assets/survival/rock-flat-grass.glb",
"assets/survival/rock-flat.glb",
"assets/survival/rock-sand-a.glb",
"assets/survival/rock-sand-b.glb",
"assets/survival/rock-sand-c.glb",
"assets/survival/signpost-single.glb",
"assets/survival/signpost.glb",
"assets/survival/structure-canvas.glb",
"assets/survival/structure-floor.glb",
"assets/survival/structure-metal-doorway.glb",
"assets/survival/structure-metal-floor.glb",
"assets/survival/structure-metal-roof.glb",
"assets/survival/structure-metal-wall.glb",
"assets/survival/structure-metal.glb",
"assets/survival/structure-roof.glb",
"assets/survival/structure.glb",
"assets/survival/tent-canvas-half.glb",
"assets/survival/tent-canvas.glb",
"assets/survival/tent.glb",
"assets/survival/tool-axe-upgraded.glb",
"assets/survival/tool-axe.glb",
"assets/survival/tool-hammer-upgraded.glb",
"assets/survival/tool-hammer.glb",
"assets/survival/tool-hoe-upgraded.glb",
"assets/survival/tool-hoe.glb",
"assets/survival/tool-pickaxe-upgraded.glb",
"assets/survival/tool-pickaxe.glb",
"assets/survival/tool-shovel-upgraded.glb",
"assets/survival/tool-shovel.glb",
"assets/survival/tree-autumn-tall.glb",
"assets/survival/tree-autumn-trunk.glb",
"assets/survival/tree-autumn.glb",
"assets/survival/tree-log-small.glb",
"assets/survival/tree-log.glb",
"assets/survival/tree-tall.glb",
"assets/survival/tree-trunk.glb",
"assets/survival/tree.glb",
"assets/survival/workbench-anvil.glb",
"assets/survival/workbench-grind.glb",
"assets/survival/workbench.glb"
];
// </generated>

const CDN = [
  'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
  ...['geometries/RoundedBoxGeometry.js', 'geometries/TextGeometry.js', 'loaders/GLTFLoader.js', 'loaders/TTFLoader.js',
    'loaders/FontLoader.js', 'utils/BufferGeometryUtils.js', 'math/MeshSurfaceSampler.js', 'postprocessing/EffectComposer.js',
    'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js']
    .map((p) => `https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/${p}`),
  'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/web/pdf_viewer.css',
  'https://cdn.jsdelivr.net/npm/lucide@0.469.0/+esm',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js',
  'https://cdn.jsdelivr.net/fontsource/fonts/nunito@latest/latin-900-normal.ttf',
  'https://cdn.jsdelivr.net/fontsource/fonts/nunito@latest/vietnamese-900-normal.ttf',
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap';
const CACHE = `hearthwood-${VERSION}`;

/** Tell open pages how far the offline download has got. */
async function report(msg) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg);
}

/** A clean copy of a response: redirected responses can't be used to answer a page load. */
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

/** Fetch one file and save it, retrying a couple of times on hiccups. */
async function save(cache, url, tries = 3) {
  for (let i = 0; ; i++) {
    try {
      const req = new Request(url, { cache: url.startsWith('http') ? 'default' : 'no-cache' });
      const res = await fetch(req);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      await cache.put(url, await clean(res));
      return;
    } catch (e) {
      if (i + 1 >= tries) throw e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
}

// The page itself plus the code: without these nothing runs, so the install waits for them.
const isCore = (u) => u === 'index.html' || u === 'manifest.webmanifest' || u.startsWith('src/');

/**
 * Save everything not yet in the cache. Returns how many files are still missing; those are
 * tried again on the next visit, and anything used in the meantime is saved as it loads.
 */
let filling = null;
function fill() {
  return (filling ??= (async () => {
    const cache = await caches.open(CACHE);
    const all = [...FILES, ...CDN, FONT_CSS];
    const have = new Set((await cache.keys()).map((r) => r.url));
    const todo = all.filter((u) => !have.has(new URL(u, self.location).href));
    let done = all.length - todo.length;
    const queue = [...todo], failed = [];
    report({ type: 'sw-progress', done, total: all.length });
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const u = queue.shift();
        try { await save(cache, u); } catch { failed.push(u); }
        if (++done % 10 === 0 || done === all.length) report({ type: 'sw-progress', done, total: all.length });
      }
    }));
    // Google Fonts serves a stylesheet that points at font files; save those too
    try {
      const css = await (await cache.match(FONT_CSS))?.text();
      if (css) await Promise.allSettled([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => save(cache, m[1], 2)));
    } catch {}
    filling = null;
    // only our own files count: a CDN file that failed is saved later, when it's first used
    const missing = failed.filter((u) => !u.startsWith('http'));
    report(missing.length ? { type: 'sw-partial', missing: missing.length, total: all.length } : { type: 'sw-ready', version: VERSION });
    return missing;
  })());
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // the code first (must succeed), then everything else in the background after activation
    await Promise.all(FILES.filter(isCore).map((u) => save(cache, u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('hearthwood-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
  fill();
});

// each page load asks for the status; that also finishes any files a previous visit couldn't save
self.addEventListener('message', (e) => {
  if (e.data === 'status') e.waitUntil(fill()); // keeps the worker awake until the download is done
});

const sameOrigin = (url) => url.origin === self.location.origin;

/** Network first with a time limit, falling back to the saved copy. */
async function networkFirst(req, key, fallback) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then((res) => {
    if (res.ok) clean(res.clone()).then((c) => cache.put(key, c));
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 4000));
  const saved = () => cache.match(key, { ignoreSearch: true }).then((r) => r || (fallback && cache.match(fallback)));
  try {
    const first = await Promise.race([net, slow]);
    // a page load that the host answers with an error (some hosts 404 a folder address) gets the saved page
    if (first && !first.ok && fallback) return (await saved()) || first;
    if (first) return first;
    // the network is dragging: answer from the saved copy if there is one, otherwise keep waiting
    return (await saved()) || (await net);
  } catch {
    const hit = await saved();
    if (hit) return hit;
    throw new Error('offline and not saved');
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req.url) || await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req.url, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && sameOrigin(url)) {
    // every page of the site is index.html; some hosts don't serve a folder address, so key by the file
    const index = new URL('index.html', self.registration.scope).href;
    e.respondWith(networkFirst(req, url.pathname.endsWith('/') ? index : url.href.split('#')[0].split('?')[0], index)
      .catch(() => Response.error()));
  } else if (sameOrigin(url)) {
    e.respondWith(networkFirst(req, url.href.split('#')[0].split('?')[0]).catch(() => Response.error()));
  } else if (/^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req));
  }
});
