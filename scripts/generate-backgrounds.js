/**
 * Generate 30 named procedural SVG background scenes for CrapChat.
 * Run: node scripts/generate-backgrounds.js
 */
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../public/assets/backgrounds');
fs.mkdirSync(outDir, { recursive: true });

function svg(w, h, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${body}
</svg>`;
}

function grad(id, stops, vert = true) {
  const coords = vert
    ? 'x1="0%" y1="0%" x2="0%" y2="100%"'
    : 'x1="0%" y1="0%" x2="100%" y2="0%"';
  return `<linearGradient id="${id}" ${coords}>
${stops.map(([o, c]) => `  <stop offset="${o}" stop-color="${c}"/>`).join('\n')}
</linearGradient>`;
}

function radial(id, stops, cx = '50%', cy = '40%', r = '60%') {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">
${stops.map(([o, c]) => `  <stop offset="${o}" stop-color="${c}"/>`).join('\n')}
</radialGradient>`;
}

const scenes = [];

function add(id, name, category, content) {
  scenes.push({ id, name, category, file: `${id}.svg` });
  fs.writeFileSync(path.join(outDir, `${id}.svg`), content);
}

const W = 1280, H = 720;

// 1. Business Office
add('business-office', 'Business Office', 'office', svg(W, H, `
  <defs>${grad('wall', [['0%','#e8eef5'],['100%','#c5d0de']])}
  ${grad('desk', [['0%','#8b6914'],['100%','#5c4010']])}</defs>
  <rect width="100%" height="100%" fill="url(#wall)"/>
  <rect x="0" y="480" width="1280" height="240" fill="url(#desk)"/>
  <rect x="80" y="120" width="420" height="280" rx="4" fill="#2c3e50"/>
  <rect x="100" y="140" width="380" height="220" fill="#3498db"/>
  <rect x="100" y="140" width="380" height="30" fill="#2980b9"/>
  <text x="290" y="162" text-anchor="middle" fill="white" font-family="sans-serif" font-size="14">Q4 Revenue</text>
  <rect x="600" y="160" width="180" height="240" fill="#7f8c8d" opacity="0.4"/>
  <rect x="620" y="180" width="140" height="20" fill="#95a5a6"/>
  <rect x="620" y="220" width="140" height="20" fill="#95a5a6"/>
  <rect x="620" y="260" width="140" height="20" fill="#95a5a6"/>
  <rect x="900" y="100" width="280" height="360" fill="#34495e"/>
  <rect x="920" y="120" width="240" height="160" fill="#ecf0f1"/>
  <circle cx="1040" cy="340" r="40" fill="#bdc3c7"/>
  <rect x="1000" y="390" width="80" height="50" fill="#95a5a6"/>
  <rect x="200" y="500" width="120" height="8" fill="#2c3e50" rx="2"/>
  <rect x="400" y="495" width="80" height="50" fill="#1a1a2e" rx="4"/>
`));

// 2. Home Office
add('home-office', 'Home Office', 'office', svg(W, H, `
  <defs>${grad('wall2', [['0%','#f5e6d3'],['100%','#e8d4b8']])}
  ${grad('wood', [['0%','#c4a574'],['100%','#8b6914']])}</defs>
  <rect width="100%" height="100%" fill="url(#wall2)"/>
  <rect x="0" y="520" width="1280" height="200" fill="url(#wood)"/>
  <rect x="100" y="80" width="300" height="400" fill="#6b4423"/>
  <rect x="120" y="100" width="260" height="40" fill="#8b6914"/>
  <rect x="120" y="160" width="260" height="40" fill="#8b6914"/>
  <rect x="120" y="220" width="260" height="40" fill="#8b6914"/>
  <rect x="120" y="280" width="260" height="40" fill="#8b6914"/>
  <rect x="500" y="150" width="350" height="220" rx="8" fill="#2d3436"/>
  <rect x="520" y="170" width="310" height="180" fill="#00b894"/>
  <rect x="900" y="200" width="60" height="280" fill="#fdcb6e"/>
  <ellipse cx="930" cy="180" rx="50" ry="40" fill="#00b894"/>
  <ellipse cx="950" cy="160" rx="30" ry="25" fill="#55efc4"/>
  <rect x="1050" y="100" width="150" height="200" fill="#dfe6e9" stroke="#b2bec3" stroke-width="4"/>
  <circle cx="1125" cy="200" r="30" fill="#fd79a8"/>
`));

// 3. Living Room
add('living-room', 'Cozy Living Room', 'home', svg(W, H, `
  <defs>${grad('lrwall', [['0%','#fff5ee'],['100%','#ffe4d4']])}
  ${grad('sofa', [['0%','#6c5ce7'],['100%','#4834d4']])}</defs>
  <rect width="100%" height="100%" fill="url(#lrwall)"/>
  <rect x="0" y="450" width="1280" height="270" fill="#d4a574"/>
  <rect x="150" y="280" width="600" height="220" rx="20" fill="url(#sofa)"/>
  <rect x="150" y="280" width="150" height="120" rx="15" fill="#5f4cd1"/>
  <rect x="600" y="280" width="150" height="120" rx="15" fill="#5f4cd1"/>
  <rect x="800" y="150" width="350" height="220" rx="8" fill="#2d3436"/>
  <rect x="820" y="170" width="310" height="180" fill="#0984e3"/>
  <rect x="100" y="100" width="200" height="150" fill="#e17055" opacity="0.6"/>
  <rect x="120" y="120" width="160" height="110" fill="#fab1a0"/>
  <ellipse cx="400" cy="500" rx="80" ry="20" fill="#a29bfe" opacity="0.5"/>
  <rect x="50" y="400" width="80" height="100" fill="#636e72"/>
  <ellipse cx="90" cy="380" rx="40" ry="30" fill="#00b894"/>
`));

// 4. Library
add('library', 'Quiet Library', 'home', svg(W, H, `
  <defs>${grad('libwall', [['0%','#3d2914'],['100%','#2a1a0a']])}</defs>
  <rect width="100%" height="100%" fill="url(#libwall)"/>
  ${[0,1,2,3,4,5,6,7].map(i => {
    const x = 40 + i * 155;
    return `<rect x="${x}" y="40" width="140" height="640" fill="#5c3d1e"/>
    ${[0,1,2,3,4,5,6,7,8,9].map(j => {
      const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'];
      return `<rect x="${x+8}" y="${60+j*55}" width="124" height="45" fill="${colors[(i+j)%8]}"/>`;
    }).join('')}`;
  }).join('')}
  <rect x="400" y="500" width="480" height="40" fill="#8b6914"/>
  <ellipse cx="640" cy="480" rx="60" ry="20" fill="#f1c40f" opacity="0.3"/>
`));

// 5. Modern Kitchen
add('kitchen', 'Modern Kitchen', 'home', svg(W, H, `
  <defs>${grad('kwall', [['0%','#f8f9fa'],['100%','#e9ecef']])}</defs>
  <rect width="100%" height="100%" fill="url(#kwall)"/>
  <rect x="0" y="380" width="1280" height="40" fill="#adb5bd"/>
  <rect x="0" y="420" width="1280" height="300" fill="#495057"/>
  <rect x="50" y="100" width="200" height="260" fill="#dee2e6"/>
  <rect x="70" y="120" width="160" height="140" fill="#74b9ff" opacity="0.5" stroke="#0984e3" stroke-width="3"/>
  <rect x="300" y="80" width="680" height="280" fill="#ced4da"/>
  <rect x="320" y="100" width="200" height="180" fill="#2d3436"/>
  <rect x="540" y="100" width="200" height="180" fill="#2d3436"/>
  <rect x="760" y="100" width="200" height="180" fill="#2d3436"/>
  <circle cx="200" cy="480" r="50" fill="#e17055"/>
  <rect x="1000" y="200" width="200" height="160" fill="#636e72"/>
  <rect x="1020" y="220" width="160" height="100" fill="#81ecec" opacity="0.4"/>
`));

// 6. Bedroom
add('bedroom', 'Calm Bedroom', 'home', svg(W, H, `
  <defs>${grad('bwall', [['0%','#dfe6e9'],['100%','#b2bec3']])}
  ${grad('bed', [['0%','#fd79a8'],['100%','#e84393']])}</defs>
  <rect width="100%" height="100%" fill="url(#bwall)"/>
  <rect x="0" y="500" width="1280" height="220" fill="#a29bfe" opacity="0.3"/>
  <rect x="200" y="280" width="700" height="280" rx="10" fill="url(#bed)"/>
  <rect x="200" y="250" width="200" height="80" rx="20" fill="#ffeaa7"/>
  <rect x="700" y="250" width="200" height="80" rx="20" fill="#ffeaa7"/>
  <rect x="100" y="80" width="180" height="140" fill="#81ecec" opacity="0.5"/>
  <rect x="980" y="100" width="200" height="300" fill="#636e72"/>
  <rect x="1000" y="120" width="160" height="120" fill="#74b9ff" opacity="0.4"/>
  <ellipse cx="1100" cy="320" rx="40" ry="50" fill="#fdcb6e"/>
`));

// 7. Tropical Beach
add('tropical-beach', 'Tropical Beach', 'nature', svg(W, H, `
  <defs>${grad('sky1', [['0%','#74b9ff'],['60%','#a29bfe'],['100%','#fdcb6e']])}
  ${grad('ocean', [['0%','#00cec9'],['100%','#0984e3']])}
  ${grad('sand', [['0%','#ffeaa7'],['100%','#fdcb6e']])}</defs>
  <rect width="100%" height="400" fill="url(#sky1)"/>
  <circle cx="1000" cy="120" r="60" fill="#fdcb6e"/>
  <rect y="400" width="1280" height="150" fill="url(#ocean)"/>
  <rect y="550" width="1280" height="170" fill="url(#sand)"/>
  <path d="M200,400 Q180,300 160,200 Q200,250 220,200 Q200,300 200,400" fill="#00b894"/>
  <ellipse cx="190" cy="180" rx="80" ry="30" fill="#00b894" transform="rotate(-20,190,180)"/>
  <ellipse cx="190" cy="180" rx="80" ry="30" fill="#00b894" transform="rotate(20,190,180)"/>
  <ellipse cx="190" cy="180" rx="80" ry="30" fill="#55efc4" transform="rotate(-60,190,180)"/>
  <ellipse cx="600" cy="480" rx="40" ry="15" fill="white" opacity="0.6"/>
  <ellipse cx="800" cy="500" rx="30" ry="10" fill="white" opacity="0.5"/>
`));

// 8. Sunset Beach
add('sunset-beach', 'Sunset Beach', 'nature', svg(W, H, `
  <defs>${grad('ssky', [['0%','#2d3436'],['30%','#e17055'],['60%','#fdcb6e'],['100%','#fd79a8']])}
  ${grad('socean', [['0%','#e17055'],['100%','#6c5ce7']])}
  ${grad('ssand', [['0%','#dfe6e9'],['100%','#b2bec3']])}</defs>
  <rect width="100%" height="380" fill="url(#ssky)"/>
  <circle cx="640" cy="300" r="70" fill="#fdcb6e"/>
  <rect y="380" width="1280" height="160" fill="url(#socean)"/>
  <rect y="540" width="1280" height="180" fill="url(#ssand)"/>
  <ellipse cx="300" cy="420" rx="100" ry="8" fill="#fdcb6e" opacity="0.4"/>
  <ellipse cx="900" cy="450" rx="80" ry="6" fill="#ffeaa7" opacity="0.3"/>
`));

// 9. Blue Sky Clouds
add('blue-sky', 'Blue Sky & Clouds', 'nature', svg(W, H, `
  <defs>${grad('bsky', [['0%','#0984e3'],['100%','#74b9ff']])}</defs>
  <rect width="100%" height="100%" fill="url(#bsky)"/>
  <ellipse cx="300" cy="200" rx="120" ry="50" fill="white" opacity="0.9"/>
  <ellipse cx="380" cy="180" rx="80" ry="45" fill="white" opacity="0.9"/>
  <ellipse cx="250" cy="180" rx="70" ry="40" fill="white" opacity="0.85"/>
  <ellipse cx="700" cy="300" rx="150" ry="60" fill="white" opacity="0.8"/>
  <ellipse cx="800" cy="280" rx="100" ry="50" fill="white" opacity="0.85"/>
  <ellipse cx="650" cy="280" rx="90" ry="45" fill="white" opacity="0.8"/>
  <ellipse cx="1000" cy="150" rx="100" ry="40" fill="white" opacity="0.7"/>
  <ellipse cx="1100" cy="140" rx="70" ry="35" fill="white" opacity="0.75"/>
`));

// 10. Dramatic Sunset Sky
add('sunset-sky', 'Dramatic Sunset Sky', 'nature', svg(W, H, `
  <defs>${grad('dsky', [['0%','#2d3436'],['25%','#6c5ce7'],['50%','#e17055'],['75%','#fdcb6e'],['100%','#ffeaa7']])}</defs>
  <rect width="100%" height="100%" fill="url(#dsky)"/>
  <circle cx="640" cy="500" r="80" fill="#fdcb6e"/>
  <ellipse cx="200" cy="250" rx="200" ry="40" fill="#2d3436" opacity="0.4"/>
  <ellipse cx="900" cy="180" rx="250" ry="50" fill="#2d3436" opacity="0.35"/>
  <ellipse cx="500" cy="350" rx="180" ry="30" fill="#e17055" opacity="0.3"/>
`));

// 11. Mountain Range
add('mountains', 'Mountain Range', 'nature', svg(W, H, `
  <defs>${grad('msky', [['0%','#74b9ff'],['100%','#dfe6e9']])}
  ${grad('snow', [['0%','#ffffff'],['100%','#dfe6e9']])}</defs>
  <rect width="100%" height="100%" fill="url(#msky)"/>
  <polygon points="0,720 0,400 200,150 400,400 500,250 700,450 900,100 1100,400 1280,300 1280,720" fill="#636e72"/>
  <polygon points="200,150 280,280 120,280" fill="url(#snow)"/>
  <polygon points="900,100 980,250 820,250" fill="url(#snow)"/>
  <polygon points="500,250 560,350 440,350" fill="url(#snow)" opacity="0.8"/>
  <rect y="550" width="1280" height="170" fill="#00b894" opacity="0.4"/>
`));

// 12. Snowy Peaks
add('snowy-peaks', 'Snowy Peaks', 'nature', svg(W, H, `
  <defs>${grad('ssky2', [['0%','#2d3436'],['50%','#636e72'],['100%','#b2bec3']])}</defs>
  <rect width="100%" height="100%" fill="url(#ssky2)"/>
  <polygon points="0,720 100,300 300,500 450,150 600,400 800,80 1000,350 1150,200 1280,400 1280,720" fill="#dfe6e9"/>
  <polygon points="450,150 520,280 380,280" fill="white"/>
  <polygon points="800,80 880,220 720,220" fill="white"/>
  <polygon points="1150,200 1200,300 1100,300" fill="white"/>
  <ellipse cx="640" cy="100" rx="80" ry="20" fill="white" opacity="0.5"/>
`));

// 13. Dense Forest
add('forest', 'Dense Forest', 'nature', svg(W, H, `
  <defs>${grad('fsky', [['0%','#55efc4'],['100%','#00b894']])}</defs>
  <rect width="100%" height="100%" fill="url(#fsky)"/>
  ${[0,1,2,3,4,5,6,7,8,9].map(i => {
    const x = 50 + i * 130;
    const h = 300 + (i % 3) * 80;
    const green = ['#00b894','#00cec9','#55efc4','#26de81'][i % 4];
    return `<rect x="${x+40}" y="${720-h+150}" width="30" height="${h-150}" fill="#6b4423"/>
    <polygon points="${x},${720-h+200} ${x+55},${720-h} ${x+110},${720-h+200}" fill="${green}"/>
    <polygon points="${x+10},${720-h+280} ${x+55},${720-h+100} ${x+100},${720-h+280}" fill="${green}" opacity="0.8"/>`;
  }).join('')}
  <rect y="650" width="1280" height="70" fill="#6b4423" opacity="0.5"/>
`));

// 14. Enchanted Forest
add('enchanted-forest', 'Enchanted Forest', 'nature', svg(W, H, `
  <defs>${grad('efsky', [['0%','#2d3436'],['100%','#6c5ce7']])}
  ${radial('glow', [['0%','#a29bfe'],['100%','transparent']])}</defs>
  <rect width="100%" height="100%" fill="url(#efsky)"/>
  <circle cx="640" cy="400" r="200" fill="url(#glow)" opacity="0.5"/>
  ${[0,1,2,3,4,5,6].map(i => {
    const x = 80 + i * 180;
    return `<rect x="${x+50}" y="300" width="25" height="420" fill="#2d3436"/>
    <ellipse cx="${x+62}" cy="280" rx="70" ry="100" fill="#6c5ce7" opacity="0.7"/>
    <ellipse cx="${x+62}" cy="250" rx="50" ry="70" fill="#a29bfe" opacity="0.5"/>
    <circle cx="${x+30}" cy="${400+i*30}" r="3" fill="#ffeaa7" opacity="0.8"/>
    <circle cx="${x+100}" cy="${350+i*40}" r="2" fill="#fdcb6e" opacity="0.7"/>`;
  }).join('')}
`));

// 15. City Skyline Night
add('city-night', 'City Skyline Night', 'urban', svg(W, H, `
  <defs>${grad('csky', [['0%','#0a0a1a'],['60%','#1a1a3e'],['100%','#2d1b4e']])}</defs>
  <rect width="100%" height="100%" fill="url(#csky)"/>
  ${[...Array(40)].map((_,i) => `<circle cx="${50+i*32}" cy="${30+(i*17)%200}" r="${1+(i%3)}" fill="white" opacity="${0.4+(i%5)*0.1}"/>`).join('')}
  ${[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
    const x = i * 110;
    const h = 200 + (i * 37) % 300;
    const windows = [];
    for (let r = 0; r < Math.floor(h/30); r++) {
      for (let c = 0; c < 3; c++) {
        if ((i+r+c) % 3 !== 0) windows.push(`<rect x="${x+15+c*30}" y="${720-h+20+r*30}" width="18" height="18" fill="${(i+r)%2?'#fdcb6e':'#74b9ff'}" opacity="0.8"/>`);
      }
    }
    return `<rect x="${x}" y="${720-h}" width="100" height="${h}" fill="#1e1e2f"/>${windows.join('')}`;
  }).join('')}
`));

// 16. City Skyline Day
add('city-day', 'City Skyline Day', 'urban', svg(W, H, `
  <defs>${grad('cdsky', [['0%','#74b9ff'],['100%','#dfe6e9']])}</defs>
  <rect width="100%" height="100%" fill="url(#cdsky)"/>
  <ellipse cx="200" cy="100" rx="100" ry="40" fill="white" opacity="0.7"/>
  <ellipse cx="900" cy="80" rx="120" ry="45" fill="white" opacity="0.6"/>
  ${[0,1,2,3,4,5,6,7,8,9,10].map(i => {
    const x = 20 + i * 120;
    const h = 250 + (i * 53) % 280;
    return `<rect x="${x}" y="${720-h}" width="100" height="${h}" fill="#636e72"/>
    <rect x="${x+5}" y="${720-h}" width="90" height="15" fill="#b2bec3"/>
    ${[0,1,2,3,4].map(r => `<rect x="${x+15}" y="${720-h+40+r*50}" width="25" height="30" fill="#74b9ff" opacity="0.5"/>
    <rect x="${x+55}" y="${720-h+40+r*50}" width="25" height="30" fill="#74b9ff" opacity="0.5"/>`).join('')}`;
  }).join('')}
`));

// 17. Coffee Shop
add('coffee-shop', 'Hip Coffee Shop', 'urban', svg(W, H, `
  <defs>${grad('cswall', [['0%','#f5e6d3'],['100%','#e8d5b7']])}
  ${grad('cwood', [['0%','#8b6914'],['100%','#5c4010']])}</defs>
  <rect width="100%" height="100%" fill="url(#cswall)"/>
  <rect x="0" y="480" width="1280" height="240" fill="url(#cwood)"/>
  <rect x="50" y="100" width="500" height="350" fill="#6b4423"/>
  <rect x="70" y="120" width="460" height="310" fill="#c4a574"/>
  ${[0,1,2].map(r => [0,1,2,3].map(c =>
    `<rect x="${100+c*110}" y="${150+r*90}" width="90" height="70" fill="#8b6914" rx="4"/>
     <rect x="${110+c*110}" y="${160+r*90}" width="70" height="50" fill="${['#e17055','#6c5ce7','#00b894','#fdcb6e'][(r+c)%4]}" opacity="0.3"/>`
  ).join('')).join('')}
  <circle cx="800" cy="400" r="60" fill="#2d3436"/>
  <circle cx="800" cy="400" r="45" fill="#dfe6e9"/>
  <rect x="780" y="445" width="40" height="80" fill="#2d3436"/>
  <ellipse cx="800" cy="350" rx="20" ry="8" fill="#fdcb6e" opacity="0.4"/>
  <rect x="950" y="300" width="200" height="180" rx="10" fill="#a29bfe" opacity="0.4"/>
  <circle cx="1050" cy="390" r="30" fill="#e17055"/>
`));

// 18. Coworking Space
add('coworking', 'Coworking Space', 'office', svg(W, H, `
  <defs>${grad('cowall', [['0%','#ffffff'],['100%','#f1f2f6']])}</defs>
  <rect width="100%" height="100%" fill="url(#cowall)"/>
  <rect x="0" y="500" width="1280" height="220" fill="#dfe6e9"/>
  ${[0,1,2].map(i => {
    const x = 80 + i * 400;
    return `<rect x="${x}" y="200" width="320" height="20" fill="#b2bec3"/>
    <rect x="${x}" y="220" width="320" height="200" fill="#ffffff" stroke="#dfe6e9" stroke-width="2"/>
    <rect x="${x+20}" y="240" width="140" height="90" fill="#2d3436" rx="4"/>
    <rect x="${x+30}" y="250" width="120" height="70" fill="#00cec9"/>
    <rect x="${x+180}" y="250" width="100" height="60" fill="#fd79a8" opacity="0.3" rx="8"/>
    <circle cx="${x+100}" cy="400" r="25" fill="#636e72"/>
    <rect x="${x+70}" y="425" width="60" height="50" fill="#2d3436"/>`;
  }).join('')}
  <rect x="50" y="50" width="300" height="100" fill="#6c5ce7" opacity="0.2" rx="8"/>
  <text x="200" y="110" text-anchor="middle" fill="#6c5ce7" font-family="sans-serif" font-size="24" font-weight="bold">CREATIVE HUB</text>
`));

// 19. Conference Room
add('conference', 'Conference Room', 'office', svg(W, H, `
  <defs>${grad('confwall', [['0%','#dfe6e9'],['100%','#b2bec3']])}</defs>
  <rect width="100%" height="100%" fill="url(#confwall)"/>
  <rect x="200" y="350" width="880" height="40" fill="#2d3436" rx="4"/>
  <rect x="220" y="300" width="840" height="50" fill="#636e72" rx="4"/>
  ${[0,1,2,3,4,5].map(i => `<rect x="${250+i*140}" y="400" width="50" height="60" fill="#2d3436" rx="4"/>
  <circle cx="${275+i*140}" cy="480" r="20" fill="#636e72"/>`).join('')}
  <rect x="400" y="80" width="480" height="200" rx="8" fill="#2d3436"/>
  <rect x="420" y="100" width="440" height="160" fill="#0984e3"/>
  <text x="640" y="190" text-anchor="middle" fill="white" font-family="sans-serif" font-size="28">STRATEGY 2026</text>
  <rect x="50" y="100" width="120" height="180" fill="#74b9ff" opacity="0.3"/>
  <rect x="1110" y="100" width="120" height="180" fill="#74b9ff" opacity="0.3"/>
`));

// 20. Rooftop Terrace
add('rooftop', 'Rooftop Terrace', 'urban', svg(W, H, `
  <defs>${grad('rsky', [['0%','#fd79a8'],['40%','#a29bfe'],['100%','#74b9ff']])}</defs>
  <rect width="100%" height="450" fill="url(#rsky)"/>
  <circle cx="900" cy="150" r="50" fill="#ffeaa7"/>
  ${[0,1,2,3,4,5,6,7].map(i => {
    const x = i * 160;
    const h = 80 + (i % 3) * 40;
    return `<rect x="${x}" y="${450-h}" width="150" height="${h}" fill="#2d3436" opacity="0.6"/>`;
  }).join('')}
  <rect y="450" width="1280" height="270" fill="#636e72"/>
  <rect x="100" y="480" width="200" height="80" rx="8" fill="#00b894"/>
  <rect x="400" y="480" width="200" height="80" rx="8" fill="#e17055"/>
  <rect x="700" y="500" width="400" height="20" fill="#b2bec3"/>
  <rect x="700" y="480" width="15" height="40" fill="#b2bec3"/>
  <rect x="1085" y="480" width="15" height="40" fill="#b2bec3"/>
  <ellipse cx="200" cy="200" rx="60" ry="25" fill="white" opacity="0.5"/>
`));

// 21. Park Picnic
add('park', 'Sunny Park', 'nature', svg(W, H, `
  <defs>${grad('psky', [['0%','#74b9ff'],['100%','#81ecec']])}
  ${grad('grass', [['0%','#00b894'],['100%','#26de81']])}</defs>
  <rect width="100%" height="400" fill="url(#psky)"/>
  <circle cx="1100" cy="100" r="55" fill="#fdcb6e"/>
  <rect y="400" width="1280" height="320" fill="url(#grass)"/>
  <rect x="200" y="250" width="40" height="200" fill="#6b4423"/>
  <ellipse cx="220" cy="220" rx="100" ry="80" fill="#00b894"/>
  <ellipse cx="180" cy="200" rx="70" ry="60" fill="#55efc4"/>
  <rect x="900" y="280" width="35" height="170" fill="#6b4423"/>
  <ellipse cx="917" cy="250" rx="90" ry="70" fill="#00cec9"/>
  <ellipse cx="640" cy="500" rx="120" ry="40" fill="#e17055" opacity="0.6"/>
  <ellipse cx="640" cy="490" rx="80" ry="25" fill="#fdcb6e" opacity="0.5"/>
  <ellipse cx="400" cy="150" rx="80" ry="30" fill="white" opacity="0.8"/>
  <ellipse cx="700" cy="100" rx="100" ry="35" fill="white" opacity="0.7"/>
`));

// 22. Lake View
add('lake', 'Serene Lake', 'nature', svg(W, H, `
  <defs>${grad('lsky', [['0%','#a29bfe'],['50%','#74b9ff'],['100%','#81ecec']])}
  ${grad('water', [['0%','#0984e3'],['100%','#00cec9']])}</defs>
  <rect width="100%" height="350" fill="url(#lsky)"/>
  <polygon points="0,350 100,200 300,320 500,180 700,300 900,150 1100,280 1280,200 1280,350" fill="#636e72"/>
  <polygon points="500,180 560,250 440,250" fill="white" opacity="0.7"/>
  <polygon points="900,150 960,230 840,230" fill="white" opacity="0.7"/>
  <rect y="350" width="1280" height="370" fill="url(#water)"/>
  <ellipse cx="400" cy="450" rx="200" ry="10" fill="white" opacity="0.3"/>
  <ellipse cx="800" cy="500" rx="150" ry="8" fill="white" opacity="0.25"/>
  <ellipse cx="200" cy="120" rx="70" ry="25" fill="white" opacity="0.6"/>
`));

// 23. Desert Dunes
add('desert', 'Desert Dunes', 'nature', svg(W, H, `
  <defs>${grad('desky', [['0%','#fd79a8'],['40%','#fdcb6e'],['100%','#ffeaa7']])}
  ${grad('dune', [['0%','#e17055'],['100%','#fdcb6e']])}</defs>
  <rect width="100%" height="100%" fill="url(#desky)"/>
  <circle cx="900" cy="180" r="70" fill="#fdcb6e"/>
  <ellipse cx="300" cy="550" rx="400" ry="150" fill="url(#dune)"/>
  <ellipse cx="800" cy="600" rx="500" ry="180" fill="#e17055" opacity="0.7"/>
  <ellipse cx="100" cy="650" rx="300" ry="120" fill="#fdcb6e" opacity="0.8"/>
  <ellipse cx="1100" cy="580" rx="350" ry="140" fill="#d63031" opacity="0.4"/>
`));

// 24. Space Nebula
add('space', 'Space Nebula', 'fun', svg(W, H, `
  <defs>${grad('spacebg', [['0%','#0a0a1a'],['50%','#2d1b4e'],['100%','#0a0a1a']])}
  ${radial('nebula', [['0%','#6c5ce7'],['50%','#e17055'],['100%','transparent']], '40%', '50%', '50%')}
  ${radial('nebula2', [['0%','#00cec9'],['100%','transparent']], '70%', '40%', '40%')}</defs>
  <rect width="100%" height="100%" fill="url(#spacebg)"/>
  <circle cx="500" cy="360" r="300" fill="url(#nebula)" opacity="0.6"/>
  <circle cx="900" cy="280" r="250" fill="url(#nebula2)" opacity="0.5"/>
  ${[...Array(60)].map((_,i) => `<circle cx="${(i*97)%1280}" cy="${(i*53)%720}" r="${0.5+(i%4)*0.8}" fill="white" opacity="${0.3+(i%7)*0.1}"/>`).join('')}
  <circle cx="200" cy="150" r="30" fill="#fdcb6e" opacity="0.8"/>
  <circle cx="200" cy="150" r="40" fill="#fdcb6e" opacity="0.2"/>
`));

// 25. Underwater
add('underwater', 'Under the Sea', 'fun', svg(W, H, `
  <defs>${grad('uw', [['0%','#0984e3'],['50%','#00cec9'],['100%','#006266']])}
  ${radial('light', [['0%','#81ecec'],['100%','transparent']], '50%', '0%', '60%')}</defs>
  <rect width="100%" height="100%" fill="url(#uw)"/>
  <circle cx="640" cy="0" r="400" fill="url(#light)" opacity="0.4"/>
  ${[0,1,2,3,4].map(i => {
    const x = 100 + i * 250;
    return `<path d="M${x},720 Q${x-20},600 ${x},500 Q${x+30},550 ${x+20},450 Q${x-10},500 ${x},720" fill="#00b894" opacity="0.7"/>
    <ellipse cx="${x+10}" cy="440" rx="40" ry="15" fill="#55efc4" opacity="0.6"/>
    <circle cx="${x+50+(i%2)*30}" cy="${300+i*50}" r="${4+i}" fill="#fdcb6e" opacity="0.5"/>`;
  }).join('')}
  <ellipse cx="400" cy="300" rx="40" ry="25" fill="#fd79a8" opacity="0.6"/>
  <ellipse cx="900" cy="400" rx="50" ry="30" fill="#a29bfe" opacity="0.5"/>
  ${[0,1,2,3,4,5,6,7].map(i => `<circle cx="${150+i*150}" cy="${100+i*30}" r="${3+i%3}" fill="white" opacity="0.3"/>`).join('')}
`));

// 26. Retro Arcade
add('arcade', 'Retro Arcade', 'fun', svg(W, H, `
  <defs>${grad('arcbg', [['0%','#2d3436'],['100%','#000000']])}</defs>
  <rect width="100%" height="100%" fill="url(#arcbg)"/>
  ${[0,1,2,3].map(i => {
    const x = 100 + i * 300;
    const colors = ['#e17055','#6c5ce7','#00b894','#fdcb6e'];
    return `<rect x="${x}" y="200" width="220" height="400" rx="10" fill="#1a1a2e"/>
    <rect x="${x+20}" y="220" width="180" height="140" fill="${colors[i]}" opacity="0.8"/>
    <rect x="${x+60}" y="400" width="40" height="40" rx="20" fill="${colors[i]}"/>
    <rect x="${x+120}" y="400" width="40" height="40" rx="20" fill="${colors[(i+1)%4]}"/>
    <rect x="${x+40}" y="480" width="140" height="20" fill="#636e72" rx="4"/>
    <text x="${x+110}" y="300" text-anchor="middle" fill="white" font-family="monospace" font-size="20">INSERT</text>
    <text x="${x+110}" y="325" text-anchor="middle" fill="white" font-family="monospace" font-size="20">COIN</text>`;
  }).join('')}
  ${[...Array(20)].map((_,i) => `<circle cx="${(i*64)%1280}" cy="${20+(i*13)%80}" r="2" fill="${['#e17055','#6c5ce7','#00b894','#fdcb6e'][i%4]}" opacity="0.6"/>`).join('')}
`));

// 27. Zen Garden
add('zen-garden', 'Zen Garden', 'fun', svg(W, H, `
  <defs>${grad('zenbg', [['0%','#dfe6e9'],['100%','#b2bec3']])}</defs>
  <rect width="100%" height="100%" fill="url(#zenbg)"/>
  <ellipse cx="640" cy="500" rx="500" ry="200" fill="#c4a574" opacity="0.5"/>
  ${[0,1,2,3,4,5,6,7,8].map(i => `<path d="M${100+i*120},400 Q${160+i*120},450 ${100+i*120},500 Q${160+i*120},550 ${100+i*120},600" fill="none" stroke="#a08b6a" stroke-width="2" opacity="0.4"/>`).join('')}
  <circle cx="400" cy="450" r="40" fill="#636e72"/>
  <circle cx="700" cy="480" r="60" fill="#2d3436"/>
  <circle cx="900" cy="420" r="30" fill="#636e72"/>
  <rect x="1000" y="200" width="30" height="300" fill="#6b4423"/>
  <ellipse cx="1015" cy="180" rx="60" ry="50" fill="#00b894" opacity="0.6"/>
  <circle cx="200" cy="150" r="80" fill="#74b9ff" opacity="0.2"/>
`));

// 28. Abstract Gradient
add('abstract-waves', 'Abstract Waves', 'fun', svg(W, H, `
  <defs>
    ${grad('aw1', [['0%','#6c5ce7'],['100%','#a29bfe']])}
    ${grad('aw2', [['0%','#e17055'],['100%','#fd79a8']])}
    ${grad('aw3', [['0%','#00b894'],['100%','#55efc4']])}
  </defs>
  <rect width="100%" height="100%" fill="#2d3436"/>
  <path d="M0,200 Q320,100 640,250 T1280,200 L1280,0 L0,0 Z" fill="url(#aw1)" opacity="0.8"/>
  <path d="M0,400 Q320,300 640,450 T1280,400 L1280,200 Q960,350 640,250 T0,200 Z" fill="url(#aw2)" opacity="0.7"/>
  <path d="M0,720 Q320,500 640,650 T1280,550 L1280,400 Q960,550 640,450 T0,400 Z" fill="url(#aw3)" opacity="0.6"/>
`));

// 29. Bookshelf Wall
add('bookshelf', 'Bookshelf Wall', 'home', svg(W, H, `
  <defs>${grad('bswall', [['0%','#5c3d1e'],['100%','#3d2914']])}</defs>
  <rect width="100%" height="100%" fill="url(#bswall)"/>
  ${[0,1,2,3,4].map(row => {
    const y = 20 + row * 140;
    return `<rect x="20" y="${y}" width="1240" height="20" fill="#8b6914"/>
    ${[0,1,2,3,4,5,6,7,8,9,10,11].map(col => {
      const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e','#e91e63','#00bcd4','#8bc34a','#ff5722'];
      const h = 80 + (col * 7 + row * 11) % 40;
      return `<rect x="${40+col*100}" y="${y+20+(100-h)}" width="${30+(col%3)*10}" height="${h}" fill="${colors[(col+row)%12]}"/>`;
    }).join('')}`;
  }).join('')}
`));

// 30. Marble Lobby
add('marble-lobby', 'Marble Lobby', 'office', svg(W, H, `
  <defs>${grad('mlwall', [['0%','#f8f9fa'],['100%','#e9ecef']])}
  ${grad('marble', [['0%','#ffffff'],['50%','#f1f3f5'],['100%','#e9ecef']])}</defs>
  <rect width="100%" height="100%" fill="url(#mlwall)"/>
  <rect x="0" y="500" width="1280" height="220" fill="url(#marble)"/>
  <path d="M0,520 Q200,510 400,530 T800,515 T1280,525" fill="none" stroke="#ced4da" stroke-width="2"/>
  <path d="M0,580 Q300,560 600,590 T1280,570" fill="none" stroke="#adb5bd" stroke-width="1.5"/>
  <rect x="500" y="100" width="280" height="400" fill="#dee2e6"/>
  <rect x="520" y="120" width="240" height="360" fill="#74b9ff" opacity="0.15"/>
  <rect x="100" y="150" width="150" height="250" fill="#adb5bd" opacity="0.4"/>
  <rect x="1030" y="150" width="150" height="250" fill="#adb5bd" opacity="0.4"/>
  <circle cx="640" cy="80" r="40" fill="#fdcb6e" opacity="0.6"/>
  <rect x="200" y="400" width="100" height="100" fill="#636e72" opacity="0.3" rx="8"/>
  <ellipse cx="250" cy="380" rx="40" ry="30" fill="#00b894" opacity="0.5"/>
  <rect x="980" y="400" width="100" height="100" fill="#636e72" opacity="0.3" rx="8"/>
  <ellipse cx="1030" cy="380" rx="40" ry="30" fill="#e17055" opacity="0.5"/>
`));

const manifest = { scenes, generated: new Date().toISOString() };
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Generated ${scenes.length} backgrounds in ${outDir}`);
scenes.forEach(s => console.log(`  ${s.id}: ${s.name} [${s.category}]`));
