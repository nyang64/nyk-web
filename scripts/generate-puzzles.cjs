#!/usr/bin/env node

/**
 * Generate 365 puzzle JSON files for each age group
 * Uses Lorem Picsum for diverse, free images
 */

const fs = require('fs');
const path = require('path');

// Age group configurations (must match puzzle-config.ts)
const AGE_GROUPS = [
  { id: "1yo", label: "1 year old", pieces: 6, gridCols: 3, gridRows: 2 },
  { id: "2yo", label: "2 year old", pieces: 9, gridCols: 3, gridRows: 3 },
  { id: "3yo", label: "3 year old", pieces: 12, gridCols: 4, gridRows: 3 },
  { id: "4-6", label: "4 to 6 years", pieces: 16, gridCols: 4, gridRows: 4 },
  { id: "6-11", label: "6 to 11 years", pieces: 24, gridCols: 6, gridRows: 4 },
  { id: "12-65", label: "12 to 65 years", pieces: 35, gridCols: 7, gridRows: 5 },
  { id: "65-75", label: "65 to 75 years", pieces: 24, gridCols: 6, gridRows: 4 },
  { id: "75-85", label: "75 to 85 years", pieces: 16, gridCols: 4, gridRows: 4 },
  { id: "85+", label: "85+ years", pieces: 9, gridCols: 3, gridRows: 3 },
  { id: "advanced", label: "Advanced", pieces: 64, gridCols: 8, gridRows: 8 },
];

// Puzzle themes for variety in titles
const THEMES = [
  "Nature Scene", "Mountain Vista", "Ocean View", "Forest Path", "Sunset Glow",
  "City Lights", "Country Road", "Garden Beauty", "Wildlife Wonder", "Beach Paradise",
  "Autumn Colors", "Winter Magic", "Spring Bloom", "Summer Day", "Starry Night",
  "River Flow", "Desert Dunes", "Tropical Island", "Snowy Peak", "Meadow Flowers",
  "Lakeside View", "Canyon Depths", "Waterfall Splash", "Rolling Hills", "Cloudy Sky",
  "Rainy Day", "Foggy Morning", "Sunny Afternoon", "Golden Hour", "Blue Hour",
  "Wildlife Safari", "Bird Watching", "Butterfly Garden", "Coral Reef", "Deep Forest",
  "Ancient Ruins", "Modern Art", "Classic Beauty", "Abstract Colors", "Geometric Shapes",
  "Peaceful Lake", "Rushing Stream", "Calm Waters", "Stormy Seas", "Gentle Waves",
  "Farm Life", "Village Scene", "Harbor View", "Lighthouse Beacon", "Bridge Crossing"
];

const PUZZLE_COUNT = 365;
const BASE_DIR = path.join(__dirname, '..', 'public', 'puzzles');

// Image dimensions for Lorem Picsum (we use a consistent size, CSS handles scaling)
const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 600;

function getTheme(puzzleNumber) {
  return THEMES[(puzzleNumber - 1) % THEMES.length];
}

function generatePuzzleJson(ageGroup, puzzleNumber) {
  // Use Lorem Picsum with a seed for consistent, unique images
  // Seed format: ageGroupId-puzzleNumber to ensure uniqueness across groups
  const seed = `${ageGroup.id}-puzzle-${puzzleNumber}`;
  const imageSrc = `https://picsum.photos/seed/${seed}/${IMAGE_WIDTH}/${IMAGE_HEIGHT}`;

  return {
    imageSrc,
    pieces: ageGroup.pieces,
    gridCols: ageGroup.gridCols,
    gridRows: ageGroup.gridRows,
    title: `${getTheme(puzzleNumber)} #${puzzleNumber}`,
    description: `Daily puzzle ${puzzleNumber} for ${ageGroup.label}`
  };
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function generateAllPuzzles() {
  console.log('Generating puzzles...\n');

  let totalGenerated = 0;

  for (const ageGroup of AGE_GROUPS) {
    const groupDir = path.join(BASE_DIR, ageGroup.id);
    ensureDirectoryExists(groupDir);

    console.log(`Generating ${PUZZLE_COUNT} puzzles for ${ageGroup.label}...`);

    for (let puzzleNum = 1; puzzleNum <= PUZZLE_COUNT; puzzleNum++) {
      const puzzleData = generatePuzzleJson(ageGroup, puzzleNum);
      const filePath = path.join(groupDir, `puzzle-${puzzleNum}.json`);

      fs.writeFileSync(filePath, JSON.stringify(puzzleData, null, 2));
      totalGenerated++;
    }

    console.log(`  ✓ Created ${PUZZLE_COUNT} puzzles in ${groupDir}`);
  }

  console.log(`\n✓ Generated ${totalGenerated} puzzle files total!`);
  console.log(`  (${AGE_GROUPS.length} age groups × ${PUZZLE_COUNT} puzzles each)`);
}

// Run the generator
generateAllPuzzles();
