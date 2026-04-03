export const MOCK_LEVELS = [
  { id: 'new', name: 'Novo', color: '#6366f1' },
  { id: 'learning', name: 'Aprendendo', color: '#0ea5e9' },
  { id: 'forgot', name: 'Esqueci', color: '#ef4444' },
  { id: 'partial', name: 'Parcial', color: '#f97316' },
  { id: 'almost', name: 'Quase lá', color: '#eab308' },
  { id: 'mastered', name: 'Dominado', color: '#22c55e' },
  { id: 'maintenance', name: 'Manutenção', color: '#8b5cf6' },
  { id: 'unknown', name: 'Desconhecido', color: '#64748b' }
];

export const MOCK_DECKS = [
  { id: 'd1', name: 'Ciências da Computação', parentId: null },
  { id: 'd2', name: 'Algoritmos', parentId: 'd1' },
  { id: 'd3', name: 'Estrutura de Dados', parentId: 'd1' },
  { id: 'd4', name: 'Línguas', parentId: null },
  { id: 'd5', name: 'Inglês', parentId: 'd4' },
  { id: 'd6', name: 'Psicologia', parentId: null },
  { id: 'd7', name: 'Atenção e Memória', parentId: 'd6' }
];

export const MOCK_NOTES = [
  { id: 'n1', front: 'Qual é a diferença entre Listas Ligadas e Arrays?', back: 'Arrays tem tamanho fixo e contíguo. Listas ligadas são nós dispersos apontando para o próximo.' },
  { id: 'n2', front: 'O que é O(1) na notação Big O?', back: 'Complexidade de tempo constante, não importa o tamanho da entrada.' },
  { id: 'n3', front: 'Como se diz "Maçã" em Inglês?', back: 'Apple' },
  { id: 'n4', front: 'What is the Stroop Effect?', back: 'A demonstration of cognitive interference where a delay in the reaction time of a task occurs due to a mismatch in stimuli.' },
  { id: 'n5', front: 'What is Myelin?', back: 'Myelin is an insulating fatty sheath that speeds up nerve impulses.' }
];

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const lastWeek = new Date(today);
lastWeek.setDate(lastWeek.getDate() - 7);

export const MOCK_FLASHCARDS = [
  { id: 'f1', noteId: 'n1', deckId: 'd3', levelId: 'effortful', nextReview: today.toISOString(), subject: 'Computer Science', topic: 'Data Structures', diff: 2 },
  { id: 'f2', noteId: 'n2', deckId: 'd2', levelId: 'knowing', nextReview: tomorrow.toISOString(), subject: 'Computer Science', topic: 'Algorithms', diff: 1 },
  { id: 'f3', noteId: 'n3', deckId: 'd5', levelId: 'fluent', nextReview: tomorrow.toISOString(), subject: 'Languages', topic: 'Vocabulary', diff: 1 },
  { id: 'f4', noteId: 'n4', deckId: 'd7', levelId: 'forgot', nextReview: lastWeek.toISOString(), subject: 'Psychology', topic: 'Attention', diff: 3 },
  { id: 'f5', noteId: 'n5', deckId: 'd7', levelId: 'unknown', nextReview: today.toISOString(), subject: 'Psychology', topic: 'Neuroscience', diff: 2 },
];

export const MOCK_REVLOG = [
  { id: 'r1', flashcardId: 'f1', date: lastWeek.toISOString(), evaluation: 'forgot' },
  { id: 'r2', flashcardId: 'f4', date: yesterday.toISOString(), evaluation: 'knowing' }
];
