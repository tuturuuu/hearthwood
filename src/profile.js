// Everything shown in the portfolio clearing behind the Reading Grove. Edit freely.
export const PROFILE = {
  name: 'VIET PHAM',
  fullName: 'Việt Phạm Minh',
  role: 'AI Engineer · Software Engineer',
  location: 'Hanoi, Vietnam',
  now: 'DS&AI @ VinSmart Future',
  about: 'Computer Science graduate (Swinburne) focused on AI & ML systems. Self-taught since 2021: computer vision, deep learning, end-to-end ML pipelines and full-stack development.',
  links: {
    github: 'https://github.com/tuturuuu',
    linkedin: 'https://www.linkedin.com/in/vi%E1%BB%87t-ph%E1%BA%A1m-minh-aaa14a335/',
  },
};

export const PROJECTS = [
  { title: 'AT-YOLO', kind: 'Research · published at SPIE', color: '#e07a5f',
    text: 'Traffic-light and countdown-timer detection: YOLOv8 with CBAM attention and tiled inference for tiny objects in real driving scenes.',
    tags: ['YOLOv8', 'CBAM', 'PyTorch'], url: 'https://github.com/tuturuuu/TrafficLightDetectionVN' },
  { title: 'Adaptive Tiling', kind: 'Research · phase 2', color: '#4d908e',
    text: 'GridNet looks at the whole image once and picks which tiles are worth running YOLO on, making tiled detection much faster at the same accuracy.',
    tags: ['GridNet', 'YOLO', 'Speed-up'], url: 'https://github.com/tuturuuu/TrafficLightDetectionVNDev' },
  { title: 'Ranking & Retrieval', kind: 'AI Engineer internship', color: '#6d597a',
    text: 'Research prototype for recommendation: retrieval, learned ranking and LLM-based re-ranking, with tooling to evaluate ranking strategies.',
    tags: ['LLM', 'Ranking', 'Python'], url: 'https://github.com/tuturuuu/internProject' },
  { title: 'Face Verification', kind: 'Computer vision', color: '#355070',
    text: 'Streamlit app combining anti-spoofing, emotion recognition (ViT) and identity verification with on-the-fly face registration.',
    tags: ['Anti-spoof', 'ViT', 'Streamlit'], url: 'https://github.com/tuturuuu/faceVerificationShowCase' },
  { title: 'Agriculture 3.0', kind: 'Web3 marketplace', color: '#81b29a',
    text: 'Decentralised agriculture supply chain: blockchain tracking, secure purchases and shipment smart contracts.',
    tags: ['React', 'FastAPI', 'Solidity'], url: 'https://github.com/tuturuuu/Agriculture3.0' },
  { title: 'Social Media App', kind: 'Full-stack', color: '#b56576',
    text: 'Feed, follows, JWT auth, real-time chat and 1:1 video calls. Where my frontend journey started.',
    tags: ['Vue', 'Socket.IO', 'WebRTC'], url: 'https://github.com/tuturuuu/socialMedia' },
  { title: 'Hearthwood', kind: 'You are standing in it', color: '#c48a5a',
    text: 'This cozy 3D reading village: a local PDF reader with three.js, physics, shaders, procedural music and a real-time sky.',
    tags: ['three.js', 'cannon-es', 'GLSL'], url: 'https://github.com/tuturuuu/hearthwood' },
  { title: 'Pop the Lock', kind: 'Little WebGL game', color: '#f2a65a',
    text: 'A timing game inspired by Pop the Lock, built to learn WebGL and game loops.',
    tags: ['WebGL', 'Game'], url: 'https://github.com/tuturuuu/PopTheLockWebGL' },
];

// Each role gets its own themed area around Việt's Garden (see experience.js).
export const EXPERIENCE = {
  frontend: {
    area: 'UI Plaza', title: 'Frontend Engineer', org: '44+ Inc · Internship', when: 'Dec 2025 – Mar 2026', where: 'Hanoi · Hybrid',
    color: '#5b8fb9',
    points: ['Responsive frontend features with React, SCSS and Redux', 'Real-time map and marker rendering to track vehicle locations',
      'Live data updates and real-time communication over Socket.IO'],
    tags: ['React', 'Redux', 'SCSS', 'Socket.IO', 'Maps'],
  },
  ai: {
    area: 'Agent Lab', title: 'AI Engineer', org: 'VinSmart Future', when: 'May – Jul 2026', where: 'Hanoi',
    color: '#8a6fd1',
    points: ['Research / prototype codebase for retrieval, ranking and LLM-based re-ranking for recommendation',
      'Evaluated the performance of different ranking strategies', 'Worked closely with the team with clear communication to hit project goals'],
    tags: ['LLMs', 'Retrieval', 'Re-ranking', 'Agents', 'Python'],
  },
  data: {
    area: 'Data Observatory', title: 'DS&AI', org: 'VinSmart Future', when: 'Jul 2026 – now', where: 'Hanoi',
    color: '#4d908e',
    points: ['Fraud detection: finding the anomalies hidden in transaction data', 'Data engineering: pipelines and warehouses that feed the models',
      'Machine learning from features to production'],
    tags: ['Fraud detection', 'Data engineering', 'ML', 'SQL'],
  },
  origin: {
    area: 'Origins', title: 'B.Sc. Computer Science', org: 'Swinburne University of Technology', when: 'Self-taught since 2021', where: 'GPA 3.58 / 4.0',
    color: '#e07a5f',
    points: ['Best Unit Performance: Interface Design and Development', 'Best Unit Performance: AI for Engineers',
      'Coursework: software testing, mobile development, OOP, cloud computing architecture'],
    tags: ['Computer vision', 'Deep learning', 'Full-stack'],
  },
};

// Orbiting the fountain in Việt's Garden. Each ring is one group; edit freely.
export const SKILLS = [
  { group: 'AI & ML', color: '#8a6fd1', items: ['Python', 'PyTorch', 'YOLOv8', 'Computer vision', 'LLMs', 'Re-ranking'] },
  { group: 'Data', color: '#4d908e', items: ['SQL', 'Data pipelines', 'Fraud detection', 'Machine learning'] },
  { group: 'Web & apps', color: '#5b8fb9', items: ['React', 'Redux', 'Vue', 'three.js', 'FastAPI', 'Socket.IO', 'Streamlit', 'Solidity', 'Java'] },
];
