(function (global) {
  'use strict';

  global.PROJECTS = [
    {
      id: 'pokecha',
      kind: 'product',
      featured: true,
      title: 'Pokécha',
      tagline: 'Real graded cards. Published odds. Verifiable openings.',
      url: 'https://pokecha.xyz',
      period: '2026',
      role: 'Product & engineering',
      stack: ['Next.js', 'TypeScript', 'Supabase'],
      bullets: [
        'Built a pack-opening platform backed by real graded trading-card slabs, where every opening resolves to a listed prize tier.',
        'Published full odds and tier tables before purchase, and committed a server seed hash per opening so a user can verify the draw afterward.',
        'Shipped collection browsing, per-pack vault pages, an authenticated opening flow, and a fallback path for when a specific slab is unavailable.'
      ],
      caseStudy: null
    },
    {
      id: 'ofye',
      kind: 'product',
      featured: true,
      title: 'OFYE Group',
      tagline: 'Crypto education and tiered community access.',
      url: 'https://ofye.org',
      period: '2026',
      role: 'Product & engineering',
      stack: ['Next.js', 'Stripe'],
      bullets: [
        'Built a membership platform with four one-time-purchase tiers and Stripe checkout.',
        'Gated educational content and community access per tier, with Telegram provisioning triggered on successful purchase.',
        'Designed the tier comparison and checkout flow around a single-purchase model rather than recurring subscriptions.'
      ],
      caseStudy: null
    },
    {
      id: 'nyc-air-quality',
      kind: 'project',
      featured: false,
      title: 'NYC Urban Air Quality Analysis',
      tagline: null,
      url: null,
      period: '2024',
      role: 'Data analysis',
      stack: ['Python', 'Pandas', 'Scikit-learn', 'Flask'],
      bullets: [
        'Processed 650,000+ records from NYC’s street-tree dataset alongside pollution data to analyze the relationship between urban forestry and air quality.',
        'Engineered features and built heat maps and correlation graphs to identify relationships between environmental variables.',
        'Built a Flask application with interactive geographic visualization, finding that trees with diameters of 60 inches or more correlate with 30% lower PM2.5 levels.'
      ],
      caseStudy: null
    },
    {
      id: 'fake-news',
      kind: 'project',
      featured: false,
      title: 'Fake News Detection',
      tagline: null,
      url: null,
      period: '2024',
      role: 'Machine learning',
      stack: ['Python', 'Pandas', 'Scikit-learn', 'NLTK', 'Flask'],
      bullets: [
        'Built an NLP classification system trained on 20,000+ real-world news articles using TF-IDF and logistic regression.',
        'Implemented preprocessing, normalization, feature extraction and model evaluation pipelines.',
        'Achieved 96% accuracy, with 97% recall and 97% F1.'
      ],
      caseStudy: null
    },
    {
      id: 'battleship',
      kind: 'project',
      featured: false,
      title: 'Probabilistic AI Agent for Battleship',
      tagline: null,
      url: null,
      period: 'Jan 2024 – May 2024',
      role: 'Game AI',
      stack: ['Java'],
      bullets: [
        'Built an agent that maintains a heat map of ship-placement probabilities and updates it after every shot based on the remaining fleet and board state.',
        'Implemented targeting that reasons over adjacency, cardinal directions and prior outcomes to prioritize high-probability coordinates.',
        'Adapted probability weights across possible ship configurations while continuing to explore unsearched regions of the board.'
      ],
      caseStudy: null
    },
    {
      id: 'tetris-q-learning',
      kind: 'project',
      featured: false,
      title: 'Tetris with a Q-Learning Bot',
      tagline: null,
      url: null,
      period: 'Jan 2024 – May 2024',
      role: 'Reinforcement learning',
      stack: ['Java'],
      bullets: [
        'Implemented a Q-learning agent that predicts the best action for a given board state.',
        'Designed a two-hidden-layer network that outputs a Q-value scoring each action from a feature vector of the game state.',
        'Built a reward function over stack height, line completions, holes and blockades to balance exploration against exploitation.'
      ],
      caseStudy: null
    },
    {
      id: 'tsp-3d-model',
      kind: 'project',
      featured: false,
      title: 'Traveling Salesman Problem 3D Model',
      tagline: null,
      url: 'https://github.com/zalu224/tsp-3d-model',
      period: '2026',
      role: 'Algorithms & visualization',
      stack: ['Python', 'JavaScript', 'Three.js'],
      bullets: [
        'Built a nearest-neighbor greedy search and a 2-opt hill-climbing solver for the traveling salesman problem over 3D points.',
        'Animated every search step in an interactive Three.js viewer served by a dependency-free Python backend, with play, step, reset and speed controls and a timeline that doubles as the tour-length curve.',
        'Hill climbing shortens the greedy tour by 4–12% across eight point sets of 50 to 500 points.'
      ],
      caseStudy: null
    },
    {
      id: 'nutrisistant',
      kind: 'project',
      featured: false,
      title: 'Nutrisistant',
      tagline: null,
      url: null,
      period: 'Sep 2023 – Dec 2023',
      role: 'Full stack, group project',
      stack: ['React', 'Node.js', 'MongoDB'],
      bullets: [
        'Built an app that reports nutritional facts for a food item, sourcing data from the Spoonacular API.',
        'Implemented the backing database, Google authentication and the API routes from front to back.',
        'Built the frontend in React and the backend in Node.js with Axios for API calls and data transfer.'
      ],
      caseStudy: null
    }
  ];

  global.COURSEWORK = [
    { index: 'A0', title: 'Python warm-up: summing two numbers', url: 'https://github.com/zalu224/zlu224-assignment-0' },
    { index: 'A1', title: 'Elevators analysis with Python', url: 'https://github.com/zalu224/zlu224-assignment-1' },
    { index: 'A2', title: 'K-means clustering visualizer', url: 'https://github.com/zalu224/zlu224-assignment-2' },
    { index: 'A3', title: 'SVD preprocessing on MNIST with logistic regression', url: 'https://github.com/zalu224/zlu224-assignment-3' },
    { index: 'A4', title: 'Latent semantic analysis search engine, 20 Newsgroups', url: 'https://github.com/zalu224/zlu224-assignment-4' },
    { index: 'A5', title: 'K-nearest neighbors Kaggle competition', url: 'https://github.com/zalu224/zlu224-assignment-5' },
    { index: 'MID', title: 'Amazon movie review rating prediction', url: 'https://github.com/zalu224/CS506-Midterm' },
    { index: 'A6', title: 'Interactive linear regression assumptions', url: 'https://github.com/zalu224/zlu224-assignment-6' },
    { index: 'A7', title: 'Linear regression simulations with hypothesis tests', url: 'https://github.com/zalu224/zlu224-assignment-7' },
    { index: 'A8', title: 'Logistic regression with shifting clusters', url: 'https://github.com/zalu224/zlu224-assignment-8' },
    { index: 'A9', title: 'Neural networks', url: 'https://github.com/zalu224/zlu224-assignment-9' },
    { index: 'A10', title: 'Image search', url: 'https://github.com/zalu224/zlu224-assignment-10' }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
