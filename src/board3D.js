import * as THREE from 'three';

/**
 * Procedural 3D Chessboard with Luxury Border, Inlays, Coordinate Markings & Visual Effects
 */

export class Board3D {
  constructor(scene) {
    this.scene = scene;
    this.squareSize = 2.0;
    this.boardGroup = new THREE.Group();
    this.tiles = []; // 8x8 array of mesh tiles
    this.tileCoords = new Map(); // mesh.uuid -> { r, c }
    this.theme = 'classic';

    // Interactive Highlight Layers
    this.hoverMesh = null;
    this.selectedMesh = null;
    this.lastMoveOriginMesh = null;
    this.lastMoveTargetMesh = null;
    this.checkMesh = null;
    this.legalMoveMarkers = [];

    this.scene.add(this.boardGroup);
    this.buildBoard();
    this.createHighlightMeshes();
  }

  setTheme(themeName) {
    this.theme = themeName;
    this.scene.remove(this.boardGroup);
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this.tiles = [];
    this.tileCoords.clear();
    this.legalMoveMarkers = [];
    this.buildBoard();
    this.createHighlightMeshes();
  }

  buildBoard() {
    const s = this.squareSize;
    let lightTileColor, darkTileColor, frameColor, trimColor;

    switch (this.theme) {
      case 'cyberpunk':
        lightTileColor = 0x0f2238;
        darkTileColor = 0x060c18;
        frameColor = 0x040810;
        trimColor = 0x00f3ff;
        break;
      case 'royal':
        lightTileColor = 0xf0f4f8;
        darkTileColor = 0x1a2130;
        frameColor = 0x0f141d;
        trimColor = 0xd4af37;
        break;
      case 'classic':
      default:
        lightTileColor = 0xe9d6b7; // Light maple wood
        darkTileColor = 0x82532f;  // Rich dark walnut
        frameColor = 0x3d2213;     // Deep mahogany frame
        trimColor = 0xc89d4b;      // Brushed gold trim
        break;
    }

    const tileHeight = 0.4;
    const tileGeom = new THREE.BoxGeometry(s * 0.98, tileHeight, s * 0.98);

    const lightMat = new THREE.MeshStandardMaterial({
      color: lightTileColor,
      roughness: 0.3,
      metalness: 0.1
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: darkTileColor,
      roughness: 0.35,
      metalness: 0.1
    });

    // Outer frame pedestal
    const frameSize = 8 * s + 2.4;
    const frameGeom = new THREE.BoxGeometry(frameSize, 0.7, frameSize);
    const frameMat = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.4,
      metalness: 0.15
    });
    const frameMesh = new THREE.Mesh(frameGeom, frameMat);
    frameMesh.position.y = -0.25;
    frameMesh.receiveShadow = true;
    this.boardGroup.add(frameMesh);

    // Beveled Gold / Accent Trim
    const trimGeom = new THREE.BoxGeometry(8 * s + 0.3, 0.42, 8 * s + 0.3);
    const trimMat = new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.2,
      metalness: 0.8
    });
    const trimMesh = new THREE.Mesh(trimGeom, trimMat);
    trimMesh.position.y = -0.15;
    this.boardGroup.add(trimMesh);

    // 8x8 Grid of Tiles
    for (let r = 0; r < 8; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const mat = isLight ? lightMat.clone() : darkMat.clone();
        const tile = new THREE.Mesh(tileGeom, mat);

        const x = (c - 3.5) * s;
        const z = (r - 3.5) * s;
        tile.position.set(x, 0, z);
        tile.receiveShadow = true;
        tile.userData = { row: r, col: c, isTile: true, isLight };

        this.boardGroup.add(tile);
        this.tiles[r][c] = tile;
        this.tileCoords.set(tile.uuid, { r, c });
      }
    }

    // Add Coordinate Labels on borders (A-H, 1-8)
    this.createBoardCoordinates(frameSize, s, trimColor);
  }

  createBoardCoordinates(frameSize, s, textColor) {
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    const createTextCanvas = (text) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 128, 128);

      ctx.fillStyle = this.theme === 'cyberpunk' ? '#00f3ff' : '#dfb260';
      ctx.font = 'bold 64px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };

    const labelMatCache = new Map();
    const getLabelMat = (text) => {
      if (!labelMatCache.has(text)) {
        labelMatCache.set(text, new THREE.MeshBasicMaterial({
          map: createTextCanvas(text),
          transparent: true,
          depthWrite: false
        }));
      }
      return labelMatCache.get(text);
    };

    const labelGeom = new THREE.PlaneGeometry(0.8, 0.8);

    // Files (Bottom: rank 1 side, Top: rank 8 side)
    for (let c = 0; c < 8; c++) {
      const x = (c - 3.5) * s;
      const mat = getLabelMat(files[c]);

      // White edge (+Z side)
      const p1 = new THREE.Mesh(labelGeom, mat);
      p1.rotation.x = -Math.PI / 2;
      p1.position.set(x, 0.22, 4.5 * s);
      this.boardGroup.add(p1);

      // Black edge (-Z side)
      const p2 = new THREE.Mesh(labelGeom, mat);
      p2.rotation.x = -Math.PI / 2;
      p2.rotation.z = Math.PI;
      p2.position.set(x, 0.22, -4.5 * s);
      this.boardGroup.add(p2);
    }

    // Ranks (Left: a-file side, Right: h-file side)
    for (let r = 0; r < 8; r++) {
      const z = (r - 3.5) * s;
      const mat = getLabelMat(ranks[r]);

      // A-file edge (-X side)
      const p1 = new THREE.Mesh(labelGeom, mat);
      p1.rotation.x = -Math.PI / 2;
      p1.rotation.z = Math.PI / 2;
      p1.position.set(-4.5 * s, 0.22, z);
      this.boardGroup.add(p1);

      // H-file edge (+X side)
      const p2 = new THREE.Mesh(labelGeom, mat);
      p2.rotation.x = -Math.PI / 2;
      p2.rotation.z = -Math.PI / 2;
      p2.position.set(4.5 * s, 0.22, z);
      this.boardGroup.add(p2);
    }
  }

  createHighlightMeshes() {
    const s = this.squareSize;

    // Hover Highlight
    const hoverGeom = new THREE.PlaneGeometry(s * 0.95, s * 0.95);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false
    });
    this.hoverMesh = new THREE.Mesh(hoverGeom, hoverMat);
    this.hoverMesh.rotation.x = -Math.PI / 2;
    this.hoverMesh.position.y = 0.21;
    this.hoverMesh.visible = false;
    this.boardGroup.add(this.hoverMesh);

    // Selected Piece Square Highlight (Luminous Gold/Cyan)
    const selGeom = new THREE.PlaneGeometry(s * 0.96, s * 0.96);
    const selMat = new THREE.MeshBasicMaterial({
      color: this.theme === 'cyberpunk' ? 0x00f3ff : 0xf6c844,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });
    this.selectedMesh = new THREE.Mesh(selGeom, selMat);
    this.selectedMesh.rotation.x = -Math.PI / 2;
    this.selectedMesh.position.y = 0.215;
    this.selectedMesh.visible = false;
    this.boardGroup.add(this.selectedMesh);

    // Last Move Highlights
    const lastMat = new THREE.MeshBasicMaterial({
      color: 0x48b0ff,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });
    this.lastMoveOriginMesh = new THREE.Mesh(hoverGeom.clone(), lastMat);
    this.lastMoveOriginMesh.rotation.x = -Math.PI / 2;
    this.lastMoveOriginMesh.position.y = 0.212;
    this.lastMoveOriginMesh.visible = false;
    this.boardGroup.add(this.lastMoveOriginMesh);

    this.lastMoveTargetMesh = new THREE.Mesh(hoverGeom.clone(), lastMat.clone());
    this.lastMoveTargetMesh.rotation.x = -Math.PI / 2;
    this.lastMoveTargetMesh.position.y = 0.212;
    this.lastMoveTargetMesh.visible = false;
    this.boardGroup.add(this.lastMoveTargetMesh);

    // Check Warning (Vibrant pulsating red glow)
    const checkMat = new THREE.MeshBasicMaterial({
      color: 0xff2244,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    this.checkMesh = new THREE.Mesh(hoverGeom.clone(), checkMat);
    this.checkMesh.rotation.x = -Math.PI / 2;
    this.checkMesh.position.y = 0.218;
    this.checkMesh.visible = false;
    this.boardGroup.add(this.checkMesh);
  }

  // Convert (row, col) to 3D world (x, y, z)
  posToWorld(r, c) {
    const s = this.squareSize;
    return new THREE.Vector3(
      (c - 3.5) * s,
      0.2, // sitting directly on top of board surface
      (r - 3.5) * s
    );
  }

  setHover(r, c) {
    if (r === null || c === null) {
      this.hoverMesh.visible = false;
      return;
    }
    const world = this.posToWorld(r, c);
    this.hoverMesh.position.x = world.x;
    this.hoverMesh.position.z = world.z;
    this.hoverMesh.visible = true;
  }

  setSelected(r, c) {
    if (r === null || c === null) {
      this.selectedMesh.visible = false;
      return;
    }
    const world = this.posToWorld(r, c);
    this.selectedMesh.position.x = world.x;
    this.selectedMesh.position.z = world.z;
    this.selectedMesh.visible = true;
  }

  setLastMove(from, to) {
    if (!from || !to) {
      this.lastMoveOriginMesh.visible = false;
      this.lastMoveTargetMesh.visible = false;
      return;
    }
    const wFrom = this.posToWorld(from.r, from.c);
    const wTo = this.posToWorld(to.r, to.c);

    this.lastMoveOriginMesh.position.x = wFrom.x;
    this.lastMoveOriginMesh.position.z = wFrom.z;
    this.lastMoveOriginMesh.visible = true;

    this.lastMoveTargetMesh.position.x = wTo.x;
    this.lastMoveTargetMesh.position.z = wTo.z;
    this.lastMoveTargetMesh.visible = true;
  }

  setCheckWarning(r, c) {
    if (r === null || c === null) {
      this.checkMesh.visible = false;
      return;
    }
    const world = this.posToWorld(r, c);
    this.checkMesh.position.x = world.x;
    this.checkMesh.position.z = world.z;
    this.checkMesh.visible = true;
  }

  // Render legal move destination markers
  showLegalMoves(moves) {
    this.clearLegalMoves();
    const s = this.squareSize;

    for (const move of moves) {
      const { r, c } = move.to;
      const world = this.posToWorld(r, c);

      let marker;
      if (move.capture) {
        // Capture indicator: Pulsing red targeting ring around enemy piece
        const ringGeom = new THREE.RingGeometry(s * 0.36, s * 0.44, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff3344,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        marker = new THREE.Mesh(ringGeom, ringMat);
      } else {
        // Move indicator: Soft luminous disc
        const discGeom = new THREE.CircleGeometry(s * 0.16, 24);
        const discMat = new THREE.MeshBasicMaterial({
          color: this.theme === 'cyberpunk' ? 0x00f3ff : 0x5cd65c,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        marker = new THREE.Mesh(discGeom, discMat);
      }

      marker.rotation.x = -Math.PI / 2;
      marker.position.set(world.x, 0.22, world.z);
      marker.userData = { targetMove: move, isLegalMarker: true };
      this.boardGroup.add(marker);
      this.legalMoveMarkers.push(marker);
    }
  }

  clearLegalMoves() {
    for (const m of this.legalMoveMarkers) {
      this.boardGroup.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }
    this.legalMoveMarkers = [];
  }
}
