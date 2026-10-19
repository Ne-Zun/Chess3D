import * as THREE from 'three';

/**
 * Procedural 3D Chess Piece Factory
 * Builds authentic competition-grade Staunton pieces using Three.js geometries
 */

export class PieceFactory {
  constructor() {
    this.geometryCache = new Map();
    this.materialsCache = new Map();
    this.currentTheme = 'classic';
    this.initMaterials();
  }

  setTheme(themeName) {
    this.currentTheme = themeName;
    this.materialsCache.clear();
    this.initMaterials();
  }

  initMaterials() {
    let whiteMat, blackMat, goldMat;

    switch (this.currentTheme) {
      case 'cyberpunk':
        whiteMat = new THREE.MeshPhysicalMaterial({
          color: 0x00f3ff,
          emissive: 0x004466,
          roughness: 0.15,
          metalness: 0.2,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          transmission: 0.4,
          ior: 1.5,
          reflectivity: 0.9
        });
        blackMat = new THREE.MeshPhysicalMaterial({
          color: 0x180028,
          emissive: 0x4a0055,
          roughness: 0.18,
          metalness: 0.3,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          transmission: 0.3,
          ior: 1.5,
          reflectivity: 0.8
        });
        goldMat = new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x0088aa,
          metalness: 0.9,
          roughness: 0.1
        });
        break;

      case 'royal':
        whiteMat = new THREE.MeshStandardMaterial({
          color: 0xeef2f7,
          metalness: 0.85,
          roughness: 0.2,
          envMapIntensity: 1.5
        });
        blackMat = new THREE.MeshStandardMaterial({
          color: 0xc89622,
          metalness: 0.9,
          roughness: 0.22,
          envMapIntensity: 1.8
        });
        goldMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          metalness: 0.95,
          roughness: 0.1
        });
        break;

      case 'classic':
      default:
        // Polished Alabaster/Ivory vs Dark Espresso Walnut
        whiteMat = new THREE.MeshPhysicalMaterial({
          color: 0xf6f3eb,
          roughness: 0.2,
          metalness: 0.05,
          clearcoat: 0.8,
          clearcoatRoughness: 0.15,
          reflectivity: 0.6
        });
        blackMat = new THREE.MeshPhysicalMaterial({
          color: 0x241d1a,
          roughness: 0.25,
          metalness: 0.08,
          clearcoat: 0.7,
          clearcoatRoughness: 0.2,
          reflectivity: 0.5
        });
        goldMat = new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          metalness: 0.8,
          roughness: 0.3
        });
        break;
    }

    this.materialsCache.set('w', whiteMat);
    this.materialsCache.set('b', blackMat);
    this.materialsCache.set('gold', goldMat);
  }

  getMaterial(color) {
    return this.materialsCache.get(color) || this.materialsCache.get('w');
  }

  // --- Procedural Geometries ---

  // Pawn Geometry
  createPawnGeometry() {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.62, 0),
      new THREE.Vector2(0.62, 0.08),
      new THREE.Vector2(0.55, 0.16),
      new THREE.Vector2(0.50, 0.24),
      new THREE.Vector2(0.44, 0.36),
      new THREE.Vector2(0.32, 0.65),
      new THREE.Vector2(0.24, 0.95),
      new THREE.Vector2(0.22, 1.10),
      new THREE.Vector2(0.36, 1.15),
      new THREE.Vector2(0.36, 1.22),
      new THREE.Vector2(0.24, 1.25)
    ];

    // Sphere head
    const headRadius = 0.32;
    const headCenterY = 1.54;
    for (let i = -7; i <= 8; i++) {
      const angle = (i / 8) * (Math.PI / 2);
      const r = Math.max(0, Math.cos(angle) * headRadius);
      const y = headCenterY + Math.sin(angle) * headRadius;
      pts.push(new THREE.Vector2(r, y));
    }

    const geom = new THREE.LatheGeometry(pts, 32);
    geom.computeVertexNormals();
    return geom;
  }

  // Rook Geometry
  createRookGeometry() {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.68, 0),
      new THREE.Vector2(0.68, 0.10),
      new THREE.Vector2(0.60, 0.20),
      new THREE.Vector2(0.52, 0.32),
      new THREE.Vector2(0.44, 0.55),
      new THREE.Vector2(0.38, 1.20),
      new THREE.Vector2(0.36, 1.60),
      new THREE.Vector2(0.54, 1.72),
      new THREE.Vector2(0.54, 1.82),
      new THREE.Vector2(0.50, 1.86),
      new THREE.Vector2(0.52, 2.15),
      new THREE.Vector2(0.40, 2.15),
      new THREE.Vector2(0.38, 1.85),
      new THREE.Vector2(0, 1.85)
    ];

    const latheGeom = new THREE.LatheGeometry(pts, 32);
    latheGeom.computeVertexNormals();
    return latheGeom;
  }

  // Knight Geometry (Lathe base + Extruded Horse Head)
  createKnightMesh(color) {
    const group = new THREE.Group();
    const material = this.getMaterial(color);

    // Pedestal base
    const basePts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.66, 0),
      new THREE.Vector2(0.66, 0.10),
      new THREE.Vector2(0.58, 0.22),
      new THREE.Vector2(0.50, 0.34),
      new THREE.Vector2(0.42, 0.52),
      new THREE.Vector2(0.38, 0.72),
      new THREE.Vector2(0.46, 0.82),
      new THREE.Vector2(0.42, 0.88),
      new THREE.Vector2(0, 0.88)
    ];
    const baseGeom = new THREE.LatheGeometry(basePts, 32);
    baseGeom.computeVertexNormals();
    const baseMesh = new THREE.Mesh(baseGeom, material);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Sculpted Horse Head Shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.86);
    shape.lineTo(-0.24, 0.88);
    shape.quadraticCurveTo(-0.38, 1.15, -0.42, 1.55); // mane back
    shape.lineTo(-0.35, 1.80); // nape
    shape.lineTo(-0.25, 2.22); // ear back
    shape.lineTo(-0.16, 2.30); // ear tip
    shape.lineTo(-0.12, 2.05); // ear front
    shape.quadraticCurveTo(-0.02, 2.10, 0.05, 1.95); // forehead
    shape.quadraticCurveTo(0.30, 1.80, 0.44, 1.55); // bridge of nose
    shape.quadraticCurveTo(0.48, 1.40, 0.40, 1.30); // muzzle tip
    shape.quadraticCurveTo(0.24, 1.25, 0.16, 1.35); // mouth/jaw
    shape.quadraticCurveTo(0.12, 1.15, 0.18, 0.88); // chest
    shape.closePath();

    const extrudeSettings = {
      steps: 2,
      depth: 0.36,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.07,
      bevelOffset: 0,
      bevelSegments: 4
    };

    const headGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    headGeom.center();
    headGeom.computeVertexNormals();

    const headMesh = new THREE.Mesh(headGeom, material);
    headMesh.position.set(0, 1.55, 0);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    group.add(headMesh);

    return group;
  }

  // Bishop Geometry
  createBishopGeometry() {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.66, 0),
      new THREE.Vector2(0.66, 0.10),
      new THREE.Vector2(0.58, 0.20),
      new THREE.Vector2(0.48, 0.35),
      new THREE.Vector2(0.36, 0.70),
      new THREE.Vector2(0.26, 1.25),
      new THREE.Vector2(0.24, 1.45),
      new THREE.Vector2(0.38, 1.52),
      new THREE.Vector2(0.38, 1.60),
      new THREE.Vector2(0.26, 1.63)
    ];

    // Mitre (helmet teardrop)
    const mitrePoints = [
      new THREE.Vector2(0.35, 1.75),
      new THREE.Vector2(0.42, 1.95),
      new THREE.Vector2(0.38, 2.20),
      new THREE.Vector2(0.24, 2.45),
      new THREE.Vector2(0.12, 2.60),
      new THREE.Vector2(0.14, 2.65), // finial base
      new THREE.Vector2(0.08, 2.70),
      new THREE.Vector2(0.00, 2.75)  // tip
    ];
    pts.push(...mitrePoints);

    const latheGeom = new THREE.LatheGeometry(pts, 32);
    latheGeom.computeVertexNormals();
    return latheGeom;
  }

  // Queen Geometry
  createQueenGeometry() {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.72, 0),
      new THREE.Vector2(0.72, 0.10),
      new THREE.Vector2(0.62, 0.22),
      new THREE.Vector2(0.52, 0.36),
      new THREE.Vector2(0.38, 0.85),
      new THREE.Vector2(0.28, 1.50),
      new THREE.Vector2(0.26, 1.80),
      new THREE.Vector2(0.42, 1.92),
      new THREE.Vector2(0.42, 2.02),
      new THREE.Vector2(0.30, 2.06),
      new THREE.Vector2(0.42, 2.30),
      new THREE.Vector2(0.55, 2.65), // flared coronet
      new THREE.Vector2(0.48, 2.70),
      new THREE.Vector2(0.30, 2.62),
      new THREE.Vector2(0.18, 2.75),
      new THREE.Vector2(0.12, 2.85), // crown ball
      new THREE.Vector2(0.00, 2.95)
    ];

    const latheGeom = new THREE.LatheGeometry(pts, 32);
    latheGeom.computeVertexNormals();
    return latheGeom;
  }

  // King Geometry
  createKingMesh(color) {
    const group = new THREE.Group();
    const material = this.getMaterial(color);

    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.76, 0),
      new THREE.Vector2(0.76, 0.12),
      new THREE.Vector2(0.66, 0.25),
      new THREE.Vector2(0.56, 0.40),
      new THREE.Vector2(0.42, 0.95),
      new THREE.Vector2(0.32, 1.70),
      new THREE.Vector2(0.30, 2.05),
      new THREE.Vector2(0.46, 2.18),
      new THREE.Vector2(0.46, 2.30),
      new THREE.Vector2(0.32, 2.34),
      new THREE.Vector2(0.44, 2.55),
      new THREE.Vector2(0.52, 2.80),
      new THREE.Vector2(0.48, 3.00),
      new THREE.Vector2(0.28, 3.10),
      new THREE.Vector2(0.15, 3.15),
      new THREE.Vector2(0.00, 3.18)
    ];

    const latheGeom = new THREE.LatheGeometry(pts, 32);
    latheGeom.computeVertexNormals();
    const bodyMesh = new THREE.Mesh(latheGeom, material);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Cross finial atop King's crown
    const crossGroup = new THREE.Group();
    const crossMat = this.currentTheme === 'classic' ? this.getMaterial('gold') : material;
    
    // Vertical bar
    const vBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.42, 0.08),
      crossMat
    );
    vBar.position.y = 3.35;
    vBar.castShadow = true;
    crossGroup.add(vBar);

    // Horizontal bar
    const hBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.09, 0.08),
      crossMat
    );
    hBar.position.y = 3.42;
    hBar.castShadow = true;
    crossGroup.add(hBar);

    group.add(crossGroup);
    return group;
  }

  // Create complete piece mesh for given type ('p','r','n','b','q','k') and color ('w','b')
  createPiece(type, color) {
    let mesh;
    const material = this.getMaterial(color);

    switch (type) {
      case 'p': {
        const geom = this.getCachedGeometry('p', () => this.createPawnGeometry());
        mesh = new THREE.Mesh(geom, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        break;
      }

      case 'r': {
        const group = new THREE.Group();
        const geom = this.getCachedGeometry('r', () => this.createRookGeometry());
        const bodyMesh = new THREE.Mesh(geom, material);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        // 4 Battlements on Rook top
        const battlementGeom = new THREE.BoxGeometry(0.18, 0.16, 0.18);
        const radius = 0.44;
        const bY = 2.22;
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2 + Math.PI / 4;
          const bm = new THREE.Mesh(battlementGeom, material);
          bm.position.set(Math.cos(angle) * radius, bY, Math.sin(angle) * radius);
          bm.castShadow = true;
          group.add(bm);
        }
        mesh = group;
        break;
      }

      case 'n': {
        mesh = this.createKnightMesh(color);
        // Face opponent: White faces -Z (toward Black), Black faces +Z (toward White)
        mesh.rotation.y = color === 'w' ? -Math.PI / 2 : Math.PI / 2;
        break;
      }

      case 'b': {
        const geom = this.getCachedGeometry('b', () => this.createBishopGeometry());
        mesh = new THREE.Mesh(geom, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        break;
      }

      case 'q': {
        const group = new THREE.Group();
        const geom = this.getCachedGeometry('q', () => this.createQueenGeometry());
        const bodyMesh = new THREE.Mesh(geom, material);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        // 8 Crown Pearl spheres around the coronet rim
        const pearlGeom = new THREE.SphereGeometry(0.06, 12, 12);
        const pearlRadius = 0.52;
        const pearlY = 2.68;
        const crownMat = this.currentTheme === 'classic' ? this.getMaterial('gold') : material;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          const pearl = new THREE.Mesh(pearlGeom, crownMat);
          pearl.position.set(Math.cos(angle) * pearlRadius, pearlY, Math.sin(angle) * pearlRadius);
          pearl.castShadow = true;
          group.add(pearl);
        }
        mesh = group;
        break;
      }

      case 'k': {
        mesh = this.createKingMesh(color);
        break;
      }

      default:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    }

    // Attach metadata
    mesh.userData = { pieceType: type, pieceColor: color };
    return mesh;
  }

  getCachedGeometry(key, builder) {
    if (!this.geometryCache.has(key)) {
      this.geometryCache.set(key, builder());
    }
    return this.geometryCache.get(key);
  }
}
