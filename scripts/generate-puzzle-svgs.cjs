#!/usr/bin/env node

/**
 * Generate puzzle files for 5 difficulty levels:
 * - Levels 1-5: Web images from LoremFlickr with level-specific categories
 *
 * Note: SVG pattern generation code with inspiring quotes is retained for future use.
 */

const fs = require('fs');
const path = require('path');

const PUZZLE_COUNT = 365;
const BASE_SIZE = 600;

// Level configurations matching puzzle-config.ts
const LEVELS = [
  { id: "level-1", pieces: 6, gridCols: 3, gridRows: 2 },
  { id: "level-2", pieces: 12, gridCols: 4, gridRows: 3 },
  { id: "level-3", pieces: 24, gridCols: 6, gridRows: 4 },
  { id: "level-4", pieces: 35, gridCols: 7, gridRows: 5 },
  { id: "level-5", pieces: 48, gridCols: 8, gridRows: 6 },
];

// Levels that use web images (1-5)
const WEB_IMAGE_LEVELS = LEVELS;

// Levels that use generated SVG with quotes (none currently, kept for future use)
const SVG_QUOTE_LEVELS = [];

// Different image categories per level to ensure unique images
const LEVEL_CATEGORIES = {
  "level-1": ["animals", "cartoon", "toys", "colorful", "cute", "pets", "zoo", "butterfly"],
  "level-2": ["flowers", "garden", "nature", "peaceful", "spring", "bloom", "botanical", "plants"],
  "level-3": ["landscape", "mountains", "ocean", "forest", "scenery", "waterfall", "valley", "nature"],
  "level-4": ["architecture", "city", "travel", "adventure", "buildings", "bridge", "castle", "monument"],
  "level-5": ["abstract", "art", "pattern", "texture", "mosaic", "geometric", "design", "modern"],
};

// Color palettes for SVG generation
const COLOR_PALETTES_LEVEL5 = [
  ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'],
  ['#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1', '#955251', '#B565A7', '#009B77'],
  ['#FF69B4', '#00CED1', '#FFD700', '#32CD32', '#FF6347', '#9370DB', '#20B2AA', '#FF8C00'],
  ['#8E4585', '#FF1493', '#00BFFF', '#FFD700', '#32CD32', '#FF4500', '#9400D3', '#00FA9A'],
  ['#F94144', '#F3722C', '#F8961E', '#F9C74F', '#90BE6D', '#43AA8B', '#577590', '#277DA1'],
];

const COLOR_PALETTES_LEVEL6 = [
  ['#228B22', '#87CEEB', '#FFD700', '#FF6347', '#8B4513', '#DDA0DD', '#00CED1', '#F0E68C'],
  ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA'],
  ['#FFB5E8', '#B28DFF', '#85E3FF', '#BFFCC6', '#FFC9DE', '#C4FAF8', '#E7FFAC', '#FFABAB'],
  ['#FF0000', '#0000FF', '#FFFF00', '#00FF00', '#FF00FF', '#00FFFF', '#FF8000', '#8000FF'],
  ['#E07A5F', '#3D405B', '#81B29A', '#F2CC8F', '#F4F1DE', '#CB997E', '#DDBEA9', '#A5A58D'],
];

// 365+ inspiring quotes
const INSPIRING_QUOTES = [
  "Believe you can and you're halfway there.",
  "The only way to do great work is to love what you do.",
  "Every day is a new beginning.",
  "You are capable of amazing things.",
  "Dream big, work hard, stay focused.",
  "Progress, not perfection.",
  "Be the change you wish to see.",
  "Your potential is limitless.",
  "Start where you are. Use what you have. Do what you can.",
  "The best time to start is now.",
  "Every accomplishment starts with the decision to try.",
  "You are stronger than you think.",
  "Make today amazing.",
  "Small steps lead to big changes.",
  "Embrace the journey.",
  "Your only limit is your mind.",
  "Stay curious, stay humble.",
  "Create your own sunshine.",
  "Be brave, take risks.",
  "Today is full of possibilities.",
  "Keep going, keep growing.",
  "You've got this.",
  "Make it happen.",
  "Rise and shine.",
  "Be fearless in the pursuit of what sets your soul on fire.",
  "The future belongs to those who believe in their dreams.",
  "Do something today your future self will thank you for.",
  "Life is tough, but so are you.",
  "Strive for progress, not perfection.",
  "Be a voice, not an echo.",
  "The secret of getting ahead is getting started.",
  "What we think, we become.",
  "Act as if what you do makes a difference. It does.",
  "Success is not final, failure is not fatal.",
  "It always seems impossible until it's done.",
  "Happiness is not by chance, but by choice.",
  "In the middle of difficulty lies opportunity.",
  "The only impossible journey is the one you never begin.",
  "Turn your wounds into wisdom.",
  "Be yourself; everyone else is already taken.",
  "Life shrinks or expands in proportion to one's courage.",
  "What you get by achieving your goals is not as important as what you become.",
  "Doubt kills more dreams than failure ever will.",
  "Everything you've ever wanted is on the other side of fear.",
  "You don't have to be great to start, but you have to start to be great.",
  "The mind is everything. What you think, you become.",
  "I have not failed. I've just found 10,000 ways that won't work.",
  "Whether you think you can or think you can't, you're right.",
  "The greatest glory is not in never falling, but in rising every time we fall.",
  "It does not matter how slowly you go as long as you do not stop.",
  "Quality is not an act, it is a habit.",
  "The only person you are destined to become is the person you decide to be.",
  "Go confidently in the direction of your dreams.",
  "A journey of a thousand miles begins with a single step.",
  "Your time is limited, don't waste it living someone else's life.",
  "Stay hungry, stay foolish.",
  "Innovation distinguishes between a leader and a follower.",
  "Life is what happens when you're busy making other plans.",
  "The way to get started is to quit talking and begin doing.",
  "Don't watch the clock; do what it does. Keep going.",
  "Everything you can imagine is real.",
  "Whatever you are, be a good one.",
  "If opportunity doesn't knock, build a door.",
  "The best revenge is massive success.",
  "I am not a product of my circumstances. I am a product of my decisions.",
  "Twenty years from now you will be more disappointed by the things you didn't do.",
  "Fall seven times, stand up eight.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't be pushed by your problems. Be led by your dreams.",
  "Opportunities don't happen. You create them.",
  "Success usually comes to those who are too busy to be looking for it.",
  "I find that the harder I work, the more luck I seem to have.",
  "Don't be afraid to give up the good to go for the great.",
  "I would rather die of passion than of boredom.",
  "If you can dream it, you can do it.",
  "A person who never made a mistake never tried anything new.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you fall, the higher you bounce.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do what you can with all you have, wherever you are.",
  "Little things make big days.",
  "It's going to be hard, but hard does not mean impossible.",
  "Don't wait for opportunity. Create it.",
  "Sometimes later becomes never. Do it now.",
  "Dream bigger. Do bigger.",
  "Don't tell people your plans. Show them your results.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things take time. Be patient.",
  "Work hard in silence, let success make the noise.",
  "Excuses will always be there for you, opportunity won't.",
  "Never give up on a dream just because of the time it will take.",
  "The key to success is to focus on goals, not obstacles.",
  "Don't limit your challenges. Challenge your limits.",
  "Believe in yourself and all that you are.",
  "You were born to be real, not to be perfect.",
  "The only bad workout is the one that didn't happen.",
  "Make your life a masterpiece; imagine no limitations.",
  "Work until your idols become your rivals.",
  "Set goals that scare and excite you at the same time.",
  "Your life does not get better by chance, it gets better by change.",
  "Take the risk or lose the chance.",
  "Some people dream of success, while others wake up and work hard at it.",
  "Life has no limitations, except the ones you make.",
  "Stop doubting yourself, work hard, and make it happen.",
  "The sun is a daily reminder that we too can rise again.",
  "Sometimes you win, sometimes you learn.",
  "Good things come to people who wait, but better things come to those who go out and get them.",
  "If you want to fly, give up everything that weighs you down.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Hustle until your haters ask if you're hiring.",
  "Be so good they can't ignore you.",
  "Courage is resistance to fear, not absence of fear.",
  "Life begins at the end of your comfort zone.",
  "Everything you want is out there waiting for you to ask.",
  "Be stubborn about your goals and flexible about your methods.",
  "Don't count the days, make the days count.",
  "Champions keep playing until they get it right.",
  "Be the energy you want to attract.",
  "Difficult roads often lead to beautiful destinations.",
  "You're allowed to scream, you're allowed to cry, but never give up.",
  "If you're not willing to risk the usual, you'll have to settle for the ordinary.",
  "Don't wish it were easier. Wish you were better.",
  "If you want it, work for it. It's that simple.",
  "Motivation gets you started. Habit keeps you going.",
  "Winners are not people who never fail but people who never quit.",
  "Don't let yesterday take up too much of today.",
  "If plan A doesn't work, the alphabet has 25 more letters.",
  "A goal without a plan is just a wish.",
  "Success is walking from failure to failure with no loss of enthusiasm.",
  "You miss 100% of the shots you don't take.",
  "The comeback is always stronger than the setback.",
  "If it doesn't challenge you, it won't change you.",
  "The only thing standing between you and your goal is the story you keep telling yourself.",
  "It's not about perfect. It's about effort.",
  "To live is the rarest thing in the world. Most people exist, that is all.",
  "Be happy with what you have while working for what you want.",
  "Failure is the condiment that gives success its flavor.",
  "Don't let the fear of losing be greater than the excitement of winning.",
  "If you're going through hell, keep going.",
  "Dream without fear. Love without limits.",
  "Nothing is impossible. The word itself says 'I'm possible!'",
  "Be a diamond, resilient and strong.",
  "Inhale courage, exhale fear.",
  "Stars can't shine without darkness.",
  "Grow through what you go through.",
  "Today's struggles are tomorrow's strengths.",
  "Collect moments, not things.",
  "Your vibe attracts your tribe.",
  "Be a warrior, not a worrier.",
  "Choose joy.",
  "Find your fire.",
  "Let your smile change the world.",
  "Do more of what makes you happy.",
  "Make peace with your past.",
  "Trust the timing of your life.",
  "You are enough.",
  "Shine bright like a diamond.",
  "Own your story.",
  "Live in the moment.",
  "Be present, be grateful.",
  "Stay wild, stay free.",
  "Let go and let flow.",
  "Embrace uncertainty.",
  "Keep your head high.",
  "Find beauty in simplicity.",
  "Bloom where you are planted.",
  "Dance in the rain.",
  "Choose happiness daily.",
  "Be kind to yourself.",
  "Find strength in stillness.",
  "Celebrate small victories.",
  "Breathe deeply, live fully.",
  "Create your own magic.",
  "Be the light.",
  "Keep moving forward.",
  "Believe in new possibilities.",
  "Spread love everywhere.",
  "Follow your heart.",
  "Stay positive, stay fighting.",
  "Love conquers all.",
  "Never stop exploring.",
  "Find peace within.",
  "Let it be.",
  "Be authentically you.",
  "Keep the faith.",
  "Rise above the storm.",
  "Find your balance.",
  "Stay grounded, stay lifted.",
  "Nurture your soul.",
  "Seek adventure always.",
  "Be the reason someone smiles.",
  "Today is a gift.",
  "Live with intention.",
  "Kindness matters.",
  "Find your zen.",
  "Keep shining bright.",
  "Love yourself first.",
  "Make today count.",
  "Be bold, be brave.",
  "Simplify your life.",
  "Find joy in the ordinary.",
  "Stay humble, stay kind.",
  "Embrace your journey.",
  "Be mindful, be grateful.",
  "Keep your spirit high.",
  "Live, laugh, love.",
  "Find strength in vulnerability.",
  "Be open to change.",
  "Stay true to yourself.",
  "Cherish every moment.",
  "Keep learning, keep growing.",
  "Be patient with yourself.",
  "Find your passion.",
  "Stay curious and open.",
  "Be gentle with yourself.",
  "Trust your journey.",
  "Keep hope alive.",
  "Find your purpose.",
  "Stay committed to growth.",
  "Be a force for good.",
  "Keep your dreams alive.",
  "Find gratitude daily.",
  "Stay resilient.",
  "Be compassionate.",
  "Keep faith in yourself.",
  "Find your inner strength.",
  "Stay motivated.",
  "Be persistent.",
  "Keep pushing forward.",
  "Find your calm.",
  "Stay determined.",
  "Be unstoppable.",
  "Keep believing.",
  "Find your way.",
  "Stay focused on your goals.",
  "Be courageous.",
  "Keep dreaming big.",
  "Find your voice.",
  "Stay inspired.",
  "Be relentless.",
  "Keep the momentum.",
  "Find your rhythm.",
  "Stay dedicated.",
  "Be intentional.",
  "Keep striving.",
  "Find your truth.",
  "Stay optimistic.",
  "Be transformative.",
  "Keep evolving.",
  "Find your spark.",
  "Stay grounded in purpose.",
  "Be legendary.",
  "Keep breaking barriers.",
  "Find your freedom.",
  "Stay hungry for success.",
  "Be extraordinary.",
  "Keep setting records.",
  "Find your greatness.",
  "Stay humble in victory.",
  "Be phenomenal.",
  "Keep raising the bar.",
  "Find your edge.",
  "Stay sharp.",
  "Be magnificent.",
  "Keep exceeding expectations.",
  "Find your power.",
  "Stay bold.",
  "Be remarkable.",
  "Keep surprising yourself.",
  "Find your wings.",
  "Stay fearless.",
  "Be outstanding.",
  "Keep challenging norms.",
  "Find your glow.",
  "Stay radiant.",
  "Be spectacular.",
  "Keep writing your story.",
  "Find your adventure.",
  "Stay wild at heart.",
  "Be incredible.",
  "Keep blazing trails.",
  "Find your mountain.",
  "Stay climbing.",
  "Be amazing.",
  "Keep reaching higher.",
  "Find your horizon.",
  "Stay expanding.",
  "Be wonderful.",
  "Keep growing stronger.",
  "Find your anchor.",
  "Stay steady.",
  "Be exceptional.",
  "Keep moving mountains.",
  "Find your oasis.",
  "Stay refreshed.",
  "Be brilliant.",
  "Keep illuminating.",
  "Find your treasure.",
  "Stay seeking.",
  "Be golden.",
  "Keep winning.",
  "Find your victory.",
  "Stay triumphant.",
  "Be victorious.",
  "Keep conquering.",
  "Find your crown.",
  "Stay royal.",
  "Be majestic.",
  "Keep reigning.",
  "Find your throne.",
  "Stay elevated.",
  "Be supreme.",
  "Keep ascending.",
  "Find your summit.",
  "Stay at the top.",
  "Be undefeated.",
  "Keep your fire burning.",
  "Find your flame.",
  "Stay ignited.",
  "Be blazing.",
  "Keep spreading light.",
  "Find your sunrise.",
  "Stay dawning.",
  "Be luminous.",
  "Keep awakening.",
  "Find your energy.",
  "Stay charged.",
  "Be electric.",
  "Keep sparking.",
  "Find your thunder.",
  "Stay powerful.",
  "Be mighty.",
  "Keep roaring.",
  "Find your strength.",
  "Stay unbreakable.",
  "Be solid.",
  "Keep standing tall.",
  "Find your foundation.",
  "Stay rooted.",
  "Be grounded.",
  "Keep flourishing.",
  "Find your bloom.",
  "Stay blossoming.",
  "Be vibrant.",
  "Keep colorful.",
  "Find your rainbow.",
  "Stay bright.",
  "Be dazzling.",
  "Keep glowing.",
  "Find your star.",
  "Stay stellar.",
  "Be cosmic.",
  "Keep expanding horizons.",
  "Find your universe.",
  "Stay infinite.",
  "Be boundless.",
  "Keep exploring galaxies.",
  "Find your destiny.",
  "Stay on course.",
  "Be destined for greatness.",
  "Keep following your north star.",
  "Find your compass.",
  "Stay directed.",
  "Be guided.",
  "Keep navigating forward.",
  "Find your path home.",
  "Stay on the journey.",
  "Be adventurous.",
  "Keep discovering.",
  "Find new worlds.",
  "Stay pioneering.",
  "Be a trailblazer.",
  "Keep innovating.",
  "Find new solutions.",
  "Stay creative.",
  "Be inventive.",
  "Keep imagining.",
  "Find new dreams.",
  "Stay visionary.",
  "Be a dreamer.",
  "Keep aspiring.",
  "Find new heights.",
  "Stay ambitious.",
  "Be driven.",
  "Keep pursuing excellence.",
  "Find your mastery.",
  "Stay skilled.",
  "Be an expert.",
  "Keep perfecting your craft.",
  "Find your art.",
  "Stay artistic.",
  "Be creative.",
  "Keep expressing yourself.",
  "Find your voice through art.",
  "Stay original.",
  "Be unique.",
  "Keep being authentic.",
  "Find your signature style.",
  "Stay distinctive.",
  "Be one of a kind.",
];

function seededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function createStar(cx, cy, outerR, innerR, points, color, rotation, opacity) {
  let path = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI / points) - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    path += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
  }
  path += ' Z';
  return `<path d="${path}" fill="${color}" opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})"/>`;
}

function generateGridPattern(width, height, gridCols, gridRows, palette, seed) {
  const random = seededRandom(seed);
  const cellWidth = width / gridCols;
  const cellHeight = height / gridRows;
  let shapes = '';

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const x = col * cellWidth;
      const y = row * cellHeight;
      const cellSeed = seed + row * 100 + col;
      const cellRandom = seededRandom(cellSeed);

      const bgColor = palette[Math.floor(cellRandom() * palette.length)];
      shapes += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${bgColor}"/>`;

      const shapeCount = 2 + Math.floor(cellRandom() * 3);
      for (let s = 0; s < shapeCount; s++) {
        const shapeColor = palette[Math.floor(cellRandom() * palette.length)];
        const shapeType = Math.floor(cellRandom() * 5);
        const cx = x + cellWidth * (0.2 + cellRandom() * 0.6);
        const cy = y + cellHeight * (0.2 + cellRandom() * 0.6);
        const size = Math.min(cellWidth, cellHeight) * (0.15 + cellRandom() * 0.35);
        const opacity = 0.7 + cellRandom() * 0.3;

        switch (shapeType) {
          case 0:
            shapes += `<circle cx="${cx}" cy="${cy}" r="${size}" fill="${shapeColor}" opacity="${opacity}"/>`;
            break;
          case 1:
            const rotation = cellRandom() * 45;
            shapes += `<rect x="${cx - size}" y="${cy - size * 0.7}" width="${size * 2}" height="${size * 1.4}" fill="${shapeColor}" opacity="${opacity}" rx="4" transform="rotate(${rotation} ${cx} ${cy})"/>`;
            break;
          case 2:
            const triPoints = `${cx},${cy - size} ${cx - size * 0.866},${cy + size * 0.5} ${cx + size * 0.866},${cy + size * 0.5}`;
            shapes += `<polygon points="${triPoints}" fill="${shapeColor}" opacity="${opacity}"/>`;
            break;
          case 3:
            const diaPoints = `${cx},${cy - size} ${cx + size * 0.7},${cy} ${cx},${cy + size} ${cx - size * 0.7},${cy}`;
            shapes += `<polygon points="${diaPoints}" fill="${shapeColor}" opacity="${opacity}"/>`;
            break;
          case 4:
            shapes += createStar(cx, cy, size, size * 0.5, 5, shapeColor, cellRandom() * 360, opacity);
            break;
        }
      }

      const edgeColor = palette[Math.floor(cellRandom() * palette.length)];
      const edgeWidth = Math.min(cellWidth, cellHeight) * 0.08;
      if (cellRandom() > 0.5) {
        shapes += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${edgeWidth}" fill="${edgeColor}" opacity="0.6"/>`;
      }
      if (cellRandom() > 0.5) {
        shapes += `<rect x="${x}" y="${y}" width="${edgeWidth}" height="${cellHeight}" fill="${edgeColor}" opacity="0.6"/>`;
      }
    }
  }

  return shapes;
}

// Wrap text to fit within width
function wrapText(text, maxCharsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function generateSVGWithQuote(puzzleNumber, gridCols, gridRows, isLevel6) {
  const aspectRatio = gridCols / gridRows;
  let width, height;

  if (aspectRatio >= 1) {
    width = BASE_SIZE;
    height = BASE_SIZE / aspectRatio;
  } else {
    height = BASE_SIZE;
    width = BASE_SIZE * aspectRatio;
  }

  const palette = isLevel6
    ? COLOR_PALETTES_LEVEL6[(puzzleNumber - 1) % COLOR_PALETTES_LEVEL6.length]
    : COLOR_PALETTES_LEVEL5[(puzzleNumber - 1) % COLOR_PALETTES_LEVEL5.length];

  const seed = puzzleNumber * (isLevel6 ? 54321 : 12345);
  const content = generateGridPattern(width, height, gridCols, gridRows, palette, seed);

  // Get quote for this puzzle
  const quote = INSPIRING_QUOTES[(puzzleNumber - 1) % INSPIRING_QUOTES.length];

  // Text styling
  const fontSize = Math.min(width, height) * 0.06;
  const maxCharsPerLine = Math.floor(width / (fontSize * 0.5));
  const lines = wrapText(quote, maxCharsPerLine);
  const lineHeight = fontSize * 1.3;
  const textBlockHeight = lines.length * lineHeight;
  const startY = (height - textBlockHeight) / 2 + fontSize;

  // Create text elements with shadow for readability
  let textElements = '';
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    const x = width / 2;
    // Shadow/outline
    textElements += `<text x="${x}" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="bold" fill="#000" opacity="0.5" transform="translate(2, 2)">${escapeXml(line)}</text>`;
    // Main text
    textElements += `<text x="${x}" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF" stroke="#000" stroke-width="1">${escapeXml(line)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${content}
  ${textElements}
</svg>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate web image URL with level-specific categories
function getWebImageUrl(levelId, puzzleNumber, gridCols, gridRows) {
  const aspectRatio = gridCols / gridRows;
  let width, height;

  if (aspectRatio >= 1) {
    width = 800;
    height = Math.round(800 / aspectRatio);
  } else {
    height = 800;
    width = Math.round(800 * aspectRatio);
  }

  // Get categories for this level
  const categories = LEVEL_CATEGORIES[levelId];
  const category = categories[(puzzleNumber - 1) % categories.length];

  // Use level number in lock seed to ensure different images per level
  const levelNum = parseInt(levelId.replace('level-', ''));
  const lockValue = levelNum * 1000 + puzzleNumber;

  return `https://loremflickr.com/${width}/${height}/${category}?lock=${lockValue}`;
}

const LEVEL_THEMES = {
  "level-1": ["Cute Animals", "Fun Cartoon", "Colorful Toys", "Happy Colors", "Pet Friends", "Zoo Fun", "Butterfly Garden", "Playful Scene"],
  "level-2": ["Flower Garden", "Nature Beauty", "Peaceful Garden", "Spring Blooms", "Botanical Art", "Plant Life", "Garden View", "Floral Scene"],
  "level-3": ["Mountain Vista", "Ocean View", "Forest Path", "Nature Scenery", "Waterfall", "Valley View", "Landscape", "Natural Wonder"],
  "level-4": ["Architecture", "City View", "Travel Adventure", "Historic Building", "Bridge Design", "Castle View", "Monument", "Urban Scene"],
  "level-5": ["Abstract Art", "Modern Design", "Pattern Study", "Texture Art", "Mosaic Beauty", "Geometric Art", "Design Challenge", "Modern Art"],
};

const BASE_DIR = path.join(__dirname, '..', 'public', 'puzzles');

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function generateWebImagePuzzles() {
  console.log('Generating puzzles for levels 1-5 (web images)...\n');

  let totalJson = 0;

  for (const level of WEB_IMAGE_LEVELS) {
    const levelDir = path.join(BASE_DIR, level.id);
    ensureDirectoryExists(levelDir);

    // Remove old images directory if exists
    const oldImagesDir = path.join(levelDir, 'images');
    if (fs.existsSync(oldImagesDir)) {
      fs.rmSync(oldImagesDir, { recursive: true });
    }

    console.log(`  ${level.id} (${level.gridCols}x${level.gridRows} grid)...`);

    const themes = LEVEL_THEMES[level.id];

    for (let puzzleNum = 1; puzzleNum <= PUZZLE_COUNT; puzzleNum++) {
      const imageUrl = getWebImageUrl(level.id, puzzleNum, level.gridCols, level.gridRows);

      const puzzleData = {
        imageSrc: imageUrl,
        pieces: level.pieces,
        gridCols: level.gridCols,
        gridRows: level.gridRows,
        title: `${themes[(puzzleNum - 1) % themes.length]} #${puzzleNum}`,
        description: `Daily puzzle ${puzzleNum} for ${level.id}`
      };

      const jsonPath = path.join(levelDir, `puzzle-${puzzleNum}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(puzzleData, null, 2));
      totalJson++;
    }

    console.log(`    ✓ ${PUZZLE_COUNT} JSON files (web images)`);
  }

  return { totalJson };
}

function generateSvgQuotePuzzles() {
  console.log('\nGenerating puzzles for levels 5-6 (SVG with quotes)...\n');

  let totalSvgs = 0;
  let totalJson = 0;

  for (const level of SVG_QUOTE_LEVELS) {
    const isLevel6 = level.id === 'level-6';
    const levelDir = path.join(BASE_DIR, level.id);
    const imagesDir = path.join(levelDir, 'images');
    ensureDirectoryExists(imagesDir);

    console.log(`  ${level.id} (${level.gridCols}x${level.gridRows} grid)...`);

    const themes = LEVEL_THEMES[level.id];

    for (let puzzleNum = 1; puzzleNum <= PUZZLE_COUNT; puzzleNum++) {
      // Generate SVG with quote
      const svg = generateSVGWithQuote(puzzleNum, level.gridCols, level.gridRows, isLevel6);
      const svgPath = path.join(imagesDir, `puzzle-${puzzleNum}.svg`);
      fs.writeFileSync(svgPath, svg);
      totalSvgs++;

      // Generate JSON
      const puzzleData = {
        imageSrc: `/puzzles/${level.id}/images/puzzle-${puzzleNum}.svg`,
        pieces: level.pieces,
        gridCols: level.gridCols,
        gridRows: level.gridRows,
        title: `${themes[(puzzleNum - 1) % themes.length]} #${puzzleNum}`,
        description: `Daily puzzle ${puzzleNum} for ${level.id}`
      };

      const jsonPath = path.join(levelDir, `puzzle-${puzzleNum}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(puzzleData, null, 2));
      totalJson++;
    }

    console.log(`    ✓ ${PUZZLE_COUNT} SVGs and JSON files`);
  }

  return { totalSvgs, totalJson };
}

function main() {
  console.log('='.repeat(50));
  console.log('Puzzle Generator - Level-Based System');
  console.log('='.repeat(50) + '\n');

  // Levels 1-5 use web images with level-specific categories
  const webResults = generateWebImagePuzzles();

  // SVG generation is kept for future use but currently not active
  let svgResults = { totalSvgs: 0, totalJson: 0 };
  if (SVG_QUOTE_LEVELS.length > 0) {
    svgResults = generateSvgQuotePuzzles();
  }

  console.log('\n' + '='.repeat(50));
  console.log('Generation complete!');
  console.log('='.repeat(50));
  console.log(`\nLevels 1-5 (web images from LoremFlickr):`);
  console.log(`  - ${webResults.totalJson} JSON files`);
  console.log(`  - Different image categories per level for variety`);
  if (svgResults.totalSvgs > 0) {
    console.log(`\nSVG levels (generated SVGs with quotes):`);
    console.log(`  - ${svgResults.totalSvgs} SVG images`);
    console.log(`  - ${svgResults.totalJson} JSON files`);
    console.log(`  - Inspiring quotes overlaid on colorful patterns`);
  }
  console.log(`\nTotal: ${webResults.totalJson + svgResults.totalJson} puzzle files across ${LEVELS.length} levels`);
}

main();
