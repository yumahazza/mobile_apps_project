import { createSentimentClassifier } from '../../../ai/sentiment.js';
import model from '../../../ai/model-edom.json';

// Model dibuat sekali di luar komponen agar tidak dibuat ulang setiap render.
const classify = createSentimentClassifier(model);

const prediction = classify('komentar untuk dianalisis');
// prediction.label berisi sentimen hasil analisis