import { PresetSample } from "../types";

export const PRESET_SAMPLES: PresetSample[] = [
  {
    id: "toronto_story",
    title: "Mon Arrivée à Toronto",
    description: "A short personal narrative about moving to Toronto for university studies.",
    transcriptRaw: `Je vis actuellement à Toronto, où je me suis installé pour mes études et où j'habite depuis mon arrivée au Canada.

C'est une ville dynamique et multiculturelle, à laquelle je me suis rapidement attaché.

Chaque matin, je prends un café au centre-ville avant d'aller à la bibliothèque.

Apprendre le français avec l'audio est une excellente méthode pour améliorer son accent.`,
    sentences: [
      {
        frenchText: "Je vis actuellement à Toronto, où je me suis installé pour mes études et où j'habite depuis mon arrivée au Canada.",
        englishTranslation: "I currently live in Toronto, where I moved for my studies and where I have been living since my arrival in Canada.",
        startTime: 0.5,
        endTime: 8.2,
        keyVocab: [
          { word: "actuellement", meaning: "currently / right now" },
          { word: "s'installer", meaning: "to settle down / move in" },
          { word: "arrivée", meaning: "arrival" }
        ],
        grammarNotes: "Use 'depuis' + present tense ('j'habite depuis...') to indicate an action that started in the past and continues in the present."
      },
      {
        frenchText: "C'est une ville dynamique et multiculturelle, à laquelle je me suis rapidement attaché.",
        englishTranslation: "It's a dynamic and multicultural city, to which I quickly became attached.",
        startTime: 9.8,
        endTime: 16.5,
        keyVocab: [
          { word: "ville", meaning: "city / town" },
          { word: "à laquelle", meaning: "to which (feminine relative pronoun)" },
          { word: "s'attacher", meaning: "to become attached to" }
        ],
        grammarNotes: "'À laquelle' agrees in gender and number with the feminine noun 'une ville'."
      },
      {
        frenchText: "Chaque matin, je prends un café au centre-ville avant d'aller à la bibliothèque.",
        englishTranslation: "Every morning, I grab a coffee downtown before going to the library.",
        startTime: 18.0,
        endTime: 23.5,
        keyVocab: [
          { word: "chaque matin", meaning: "every morning" },
          { word: "centre-ville", meaning: "downtown / city center" },
          { word: "avant de", meaning: "before (followed by infinitive verb)" }
        ],
        grammarNotes: "'Avant de' is always followed by an infinitive verb (e.g., 'avant d'aller')."
      },
      {
        frenchText: "Apprendre le français avec l'audio est une excellente méthode pour améliorer son accent.",
        englishTranslation: "Learning French with audio is an excellent method to improve one's accent.",
        startTime: 25.0,
        endTime: 31.8,
        keyVocab: [
          { word: "apprendre", meaning: "to learn" },
          { word: "améliorer", meaning: "to improve" },
          { word: "son accent", meaning: "one's accent" }
        ],
        grammarNotes: "Infinitive verbs like 'Apprendre' can act as the subject of a French sentence."
      }
    ]
  },
  {
    id: "paris_cafe",
    title: "Commande au Café Parisien",
    description: "Ordering pastries and coffee at a French bistro in Paris.",
    transcriptRaw: `Bonjour monsieur, je voudrais un croissant et un café au lait, s'il vous plaît.

Est-ce que vous avez des options sans gluten pour la pâtisserie?

Parfait, je vais m'installer en terrasse pour profiter du soleil.`,
    sentences: [
      {
        frenchText: "Bonjour monsieur, je voudrais un croissant et un café au lait, s'il vous plaît.",
        englishTranslation: "Hello sir, I would like a croissant and a coffee with milk, please.",
        startTime: 0.5,
        endTime: 6.8,
        keyVocab: [
          { word: "je voudrais", meaning: "I would like (polite request)" },
          { word: "café au lait", meaning: "coffee with milk" },
          { word: "s'il vous plaît", meaning: "please" }
        ],
        grammarNotes: "'Je voudrais' uses the conditional mood for polite ordering instead of 'Je veux'."
      },
      {
        frenchText: "Est-ce que vous avez des options sans gluten pour la pâtisserie?",
        englishTranslation: "Do you have any gluten-free options for the pastry?",
        startTime: 8.0,
        endTime: 13.2,
        keyVocab: [
          { word: "est-ce que", meaning: "question marker (is it that)" },
          { word: "sans gluten", meaning: "gluten-free" },
          { word: "pâtisserie", meaning: "pastry / bakery item" }
        ],
        grammarNotes: "'Est-ce que' is the standard spoken phrase to turn any statement into a question."
      },
      {
        frenchText: "Parfait, je vais m'installer en terrasse pour profiter du soleil.",
        englishTranslation: "Perfect, I will sit on the terrace to enjoy the sunshine.",
        startTime: 14.5,
        endTime: 20.0,
        keyVocab: [
          { word: "en terrasse", meaning: "outdoor patio / terrace seating" },
          { word: "profiter de", meaning: "to take advantage of / enjoy" },
          { word: "soleil", meaning: "sun / sunshine" }
        ],
        grammarNotes: "'Je vais + infinitive' forms the futur proche (near future tense)."
      }
    ]
  }
];
