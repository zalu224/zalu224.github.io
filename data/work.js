(function (global) {
  'use strict';

  global.WORK = [
    {
      company: 'AlphaBiz',
      role: 'AI Intern',
      period: 'Jul 2025 – Dec 2025',
      location: null,
      bullets: [
        'Integrated AI confidential information memorandum (CIM) enhancement into an M&A platform supporting business evaluation and valuation workflows.',
        'Built secure, event-driven AI processing workflows using AWS Lambda and Kinesis.',
        'Collaborated on translating business requirements into product functionality.'
      ]
    },
    {
      company: 'Interesting World',
      role: 'Machine Learning Intern',
      period: 'Jun 2024 – Aug 2024',
      location: 'Hangzhou, Zhejiang',
      bullets: [
        'Developed a 7-class NLP classification system for automated user-generated content moderation, achieving 88% accuracy.',
        'Experimented with BERT, LoRA, FastText, Word2Vec and Hugging Face Transformers to compare approaches to text representation and classification.',
        'Built preprocessing and tokenization pipelines for multilingual and emoji-rich text, reducing model training time by 50% through dynamic padding and LoRA.'
      ]
    },
    {
      company: 'Rivera Food Service Inc.',
      role: 'Project Manager, part-time',
      period: 'Sep 2021 – Jul 2026',
      location: null,
      bullets: [
        'Worked with vendors and engineers to define technical requirements for business systems integrating sales, pricing, inventory and replenishment data.',
        'Coordinated data integration and analytics requirements between business stakeholders and developers.'
      ]
    }
  ];

  global.EDUCATION = [
    {
      school: 'University of Southern California',
      division: 'Viterbi School of Engineering',
      degree: 'M.S. Computer Science — Artificial Intelligence',
      period: '2026 – Present'
    },
    {
      school: 'Boston University',
      division: 'College of Arts and Sciences',
      degree: 'B.A. Computer Science',
      period: 'Graduated May 2025'
    }
  ];

  global.SKILLS = {
    product: ['Product Requirements', 'Cross-functional Collaboration', 'Stakeholder Management', 'Vendor Coordination', 'Technical Roadmapping', 'Data-Informed Decisions'],
    languages: ['Java', 'Python', 'JavaScript', 'C', 'HTML', 'SQL'],
    ml: ['PyTorch', 'Scikit-learn', 'BERT', 'LoRA', 'Transformers', 'NLTK', 'Vectorization', 'Q-Learning'],
    data: ['React', 'Node.js', 'Next.js', 'MongoDB', 'MySQL', 'XML', 'AWS', 'Google APIs']
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
