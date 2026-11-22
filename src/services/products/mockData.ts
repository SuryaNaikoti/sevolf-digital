import { Product, Collection } from "@/types/commerce";

export const COLLECTIONS: Collection[] = [
  {
    id: "col-home-living",
    name: "Home & Living",
    slug: "home-living",
    tagline: "Order, warmth, and deliberate routines for modern spaces.",
    description: "Curated room-by-room guides, decluttering systems, and printable household audits designed to bring calm clarity to your daily sanctuary.",
    image: "/images/collections/home-living/cover.jpg",
    featuredProductCount: 4,
  },
  {
    id: "col-kids-education",
    name: "SEVOLF Little",
    slug: "kids-education",
    tagline: "Wonder, foundation, and playful discovery for young minds.",
    description: "Montessori-informed early childhood workbooks, tactile phonics tracing sheets, and earth-toned activity companions free from screen fatigue.",
    image: "/images/collections/sevolf-little/cover.jpg",
    featuredProductCount: 6,
  },
  {
    id: "col-productivity",
    name: "Productivity & Planning",
    slug: "productivity",
    tagline: "Intentional systems for focus, reflection, and quiet mastery.",
    description: "Hyperlinked tablet planners, unhurried 90-day review canvases, and deep-work systems built for deliberate, high-leverage execution.",
    image: "/images/collections/productivity/cover.jpg",
    featuredProductCount: 5,
  },
  {
    id: "col-business",
    name: "Business & Entrepreneurship",
    slug: "business",
    tagline: "Distilled frameworks and operating assets for independent founders.",
    description: "Venture-grade financial models, minimal pitch deck templates, and modular founder agreements formatted for clarity and execution.",
    image: "/images/collections/business/cover.jpg",
    featuredProductCount: 4,
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "prod-001",
    name: "14-Day Home Reset Kit",
    slug: "14-day-home-reset-kit",
    tagline: "A restorative step-by-step system for reclaiming serenity in your home.",
    shortDescription: "An intentional 22-page editorial workbook and daily room-by-room audit system to declutter and refresh your living environment. Includes both A4 and US Letter editions.",
    fullDescription: `The 14-Day Home Reset Kit is designed for individuals seeking intentional order in their physical surroundings without the stress of overwhelming overhauls. 

Structured into fourteen distinct daily sequences, the guide walks you through entryway curation, kitchen functional zones, wardrobe moderation, and quiet evening retreats. Each day contains a concise intentionality essay, an actionable checklist, and storage layout diagrams.

Includes both international A4 and North American US Letter standard printable editions, calibrated with binder margins for physical printing or tablet annotation.`,
    category: "home-living",
    categoryLabel: "Home & Living",
    productType: "Comprehensive Guide & Workbook",
    format: "pdf",
    formatLabel: "Downloadable PDF (A4 & US Letter Editions)",
    price: 0,
    compareAtPrice: undefined,
    currency: "INR",
    coverImage: "/images/products/home-reset-kit/cover.jpg",
    galleryImages: [
      "/images/products/home-reset-kit/interior-1.jpg",
      "/images/products/home-reset-kit/interior-2.jpg",
    ],
    mockupImages: [
      "/images/products/home-reset-kit/spotlight-mockup.jpg",
    ],
    features: [
      "Manageable 30 to 60-minute daily micro-interventions.",
      "Includes calibrated A4 and US Letter editions with 20mm binder margins.",
      "Sustainable seasonal framework based on the 30-Day Pause Box method."
    ],
    whatsIncluded: [
      "14-Day Home Reset Kit A4 Edition (PDF - 22 Pages)",
      "14-Day Home Reset Kit US Letter Edition (PDF - 22 Pages)",
      "Room Zoning & Daily Micro-Intervention Checklists"
    ],
    requirements: [
      "Any standard PDF reader or tablet annotation application",
      "Standard home printer for printable physical sheets"
    ],
    licenceType: "personal",
    licenceDescription: "Single-household personal licence. For personal use only. Redistribution or commercial resale is strictly prohibited.",
    status: "draft",
    isFeatured: true,
    isBestseller: true,
    isNewArrival: false,
    tags: ["home", "declutter", "organisation", "minimalism", "lifestyle"],
    seoTitle: "14-Day Home Reset Kit | SEVOLF Digital Home & Living",
    seoDescription: "An intentional 22-page digital guide and workbook to declutter and organize your living spaces. Includes A4 & US Letter printable editions.",
    keyBenefits: [
      "Manageable 30 to 60-minute daily micro-interventions.",
      "Includes calibrated A4 and US Letter editions with 20mm binder margins.",
      "Sustainable seasonal framework based on the 30-Day Pause Box method."
    ],
    specifications: {
      "Page Count": "22 Pages per Edition",
      "Editions Included": "A4 (210 × 297 mm) and US Letter (8.5 × 11 in)",
      "Total File Size": "12.24 MB combined",
      "Version": "v1.2.3 (Edition No. 04)"
    },
    createdAt: "2026-01-10T10:00:00Z",
    updatedAt: "2026-02-14T10:00:00Z",
  },
  {
    id: "prod-002",
    name: "Mitthu's Fun Learning Book",
    slug: "mitthus-fun-learning-book",
    tagline: "Early literacy, phonics, and curiosity activities for toddler discovery.",
    shortDescription: "An authentic 50-page printable A4 activity workbook designed for early learning (ages 2–3), combining foundational tracing with gentle bilingual cues.",
    fullDescription: `Crafted with gentle earth tones and purposeful illustrations, Mitthu's Fun Learning Book introduces young toddlers to foundational motor control and observation without sensory overload.

Spanning 50 structured A4 pages, the book guides children through tactile line tracing, object association, and early vocabulary in a calm, screen-free format.`,
    category: "kids-education",
    categoryLabel: "SEVOLF Little",
    productType: "Printable Activity Workbook",
    format: "pdf",
    formatLabel: "Printable A4 PDF Activity Book",
    price: 0,
    compareAtPrice: undefined,
    currency: "INR",
    coverImage: "/images/products/mitthus-fun-learning/cover.jpg",
    galleryImages: [
      "/images/products/mitthus-fun-learning/sample-pages.jpg",
      "/images/products/mitthus-fun-learning/flashcards.jpg",
    ],
    mockupImages: [
      "/images/products/mitthus-fun-learning/sample-pages.jpg",
    ],
    features: [
      "Authentic 50-page tactile activity sequence.",
      "Calibrated specifically for ages 2–3 early childhood development.",
      "Zero sensory overload or screen fatigue."
    ],
    whatsIncluded: [
      "Mitthu's Fun Learning Book (50 Pages - A4 PDF)",
      "Pre-writing pencil grip & stroke guide",
      "Animal & Nature observation flashcards"
    ],
    requirements: [
      "Standard PDF reader",
      "Standard A4 printer (80-100 gsm paper recommended)"
    ],
    licenceType: "personal",
    licenceDescription: "Personal household licence. Unlimited personal prints for children in your home.",
    status: "draft",
    isFeatured: true,
    isBestseller: true,
    isNewArrival: false,
    tags: ["kids", "learning", "phonics", "montessori", "activity book", "toddler"],
    seoTitle: "Mitthu's Fun Learning Book | SEVOLF Little Education",
    seoDescription: "Gentle 50-page early learning activity workbook for ages 2–3. Phonics, tracing, and nature counting without screen time.",
    educationalMeta: {
      ageRange: "2 – 3 Years",
      learningObjectives: [
        "Early pencil grip and pre-writing motor control",
        "Basic shape and object recognition",
        "Gentle bilingual vocabulary elements"
      ],
      pagesIncluded: 50,
      language: "English with Hindi vocabulary cues",
      printingInstructions: "Standard A4 paper (80–100 gsm recommended)"
    },
    keyBenefits: [
      "Authentic 50-page tactile activity sequence.",
      "Calibrated specifically for ages 2–3 early childhood development.",
      "Zero sensory overload or screen fatigue."
    ],
    specifications: {
      "Target Age": "2 to 3 Years",
      "Format": "Standard A4 PDF (595 × 842 pt)",
      "Page Count": "50 Pages",
      "File Size": "615.8 KB",
      "Version": "v1.0.0"
    },
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-02-18T10:00:00Z",
  },
  {
    id: "prod-003",
    name: "The Focused Life: Productivity Toolkit",
    slug: "productivity-toolkit",
    tagline: "An unhurried operating framework for high-leverage intellectual output.",
    shortDescription: "A comprehensive digital planning ecosystem combining quarterly retrospectives, weekly time-blocking canvases, and Notion dashboard architecture.",
    fullDescription: `The Focused Life is an architectural operating system for professionals, writers, and makers who reject hustle noise in favor of measured, high-leverage execution.

Rather than cramming every minute into reactive tasks, this toolkit guides you through setting 90-day focal arcs, protecting 3-hour deep work blocks, and conducting weekly debriefs.

Includes both hyperlinked GoodNotes/Notability interactive planner editions and an instantly duplicable Notion workspace.`,
    category: "productivity",
    categoryLabel: "Productivity & Planning",
    productType: "Digital Planner & Operating System",
    format: "template",
    formatLabel: "Interactive Digital Planner + Notion Workspace",
    price: 1899,
    compareAtPrice: 2499,
    currency: "INR",
    coverImage: "/images/products/productivity-toolkit/cover.jpg",
    galleryImages: [
      "/images/products/productivity-toolkit/planner-screen.jpg",
      "/images/products/productivity-toolkit/time-blocking.jpg",
    ],
    mockupImages: [
      "/images/products/productivity-toolkit/planner-screen.jpg",
    ],
    features: [
      "Hyperlinked interactive tabs for quick index jumps across 180+ pages",
      "Quarterly review canvases and intentional milestone planners",
      "Weekly time-blocking sheets aligned with energy management",
      "1-click duplication into Notion with relational databases",
      "Undated architecture: start anytime without wasting pages"
    ],
    whatsIncluded: [
      "The Focused Life Digital Planner (Interactive PDF - 186 Pages)",
      "Direct Notion Workspace One-Click Duplicate Link",
      "Quick-Start Video Setup Guide (12-minute walkthrough)",
      "10 Minimalist Desktop & Tablet Wallpaper Canvases"
    ],
    requirements: [
      "For PDF planner: iPad / Android Tablet with GoodNotes, Notability, or Noteshelf",
      "For Notion: Free or Plus Notion Account",
      "Stylus recommended for tablet handwritten notes"
    ],
    licenceType: "personal",
    licenceDescription: "Single-user personal licence. Includes updates for all upcoming calendar version releases.",
    status: "published",
    isFeatured: true,
    isBestseller: true,
    isNewArrival: false,
    tags: ["productivity", "notion", "planner", "deep work", "journal"],
    seoTitle: "The Focused Life Productivity Toolkit | SEVOLF Digital",
    seoDescription: "A minimalist digital planning and focus system for high-leverage intellectual execution. Includes Notion and GoodNotes editions.",
    keyBenefits: [
      "Shift from reactive fire-fighting to intentional daily focus blocks.",
      "Dual system: write by hand on your tablet or organize digitally in Notion.",
      "Undated structure eliminates the guilt of missed weeks."
    ],
    specifications: {
      "System Format": "Interactive PDF (GoodNotes) + Notion Workspace",
      "Pages": "186 Hyperlinked Pages",
      "Navigation": "Over 800 indexed internal links",
      "Notion Compatibility": "Free & Paid Notion accounts"
    },
    createdAt: "2026-02-01T10:00:00Z",
    updatedAt: "2026-02-17T10:00:00Z",
  },
  {
    id: "prod-004",
    name: "Founder's Operating Suite",
    slug: "founders-operating-suite",
    tagline: "The essential documentation, pitch, and governance suite for modern startups.",
    shortDescription: "32 polished business documents, financial models, investor pitch deck templates, and advisor agreements created for independent founders.",
    fullDescription: `The Founder's Operating Suite eliminates weeks of administrative friction for entrepreneurs. Cleanly formatted in modern typography with comprehensive clause annotations, this toolkit provides everything necessary to incorporate, present, and scale.

Includes clean Google Docs and Microsoft Word contract templates, pitch decks in Figma & Keynote, and a 3-statement dynamic financial forecast model in Google Sheets and Excel.`,
    category: "business",
    categoryLabel: "Business & Entrepreneurship",
    productType: "Business Document Kit",
    format: "zip",
    formatLabel: "ZIP Archive (Figma, Notion, Word, Sheets)",
    price: 3499,
    compareAtPrice: 4999,
    currency: "INR",
    coverImage: "/images/products/founders-operating-suite/cover.jpg",
    galleryImages: [
      "/images/products/founders-operating-suite/financial-model.jpg",
      "/images/products/founders-operating-suite/pitch-deck.jpg",
    ],
    mockupImages: [
      "/images/products/founders-operating-suite/financial-model.jpg",
    ],
    features: [
      "32 modular legal agreements & founder contracts",
      "Dynamic 3-year financial model with unit economic projections",
      "Minimalist 16-slide investor presentation in Figma, Keynote, & PowerPoint",
      "Hiring rubrics and standard offer letter frameworks"
    ],
    whatsIncluded: [
      "Founder Suite ZIP containing all source files (.fig, .key, .xlsx, .docx)",
      "Access to living cloud document links (Google Drive & Notion)",
      "Video overview on adapting models for seed fundraising"
    ],
    requirements: [
      "Microsoft Office, Google Workspace, or Apple iWork",
      "Optional Figma account for pitch deck customizations"
    ],
    licenceType: "commercial",
    licenceDescription: "Commercial licence: use within your single commercial company or entity. Re-licensing the base templates is prohibited.",
    status: "published",
    isFeatured: true,
    isBestseller: false,
    isNewArrival: true,
    tags: ["business", "startup", "pitch deck", "financial model", "founder"],
    seoTitle: "Founder's Operating Suite | SEVOLF Business Resources",
    seoDescription: "32 essential startup contracts, financial models, and pitch decks designed for high-growth modern ventures.",
    keyBenefits: [
      "Save thousands in legal and advisory documentation drafting fees.",
      "Deliver cohesive, investor-ready presentations built on proven venture structures.",
      "Ready-to-use plug-and-play formulas with zero convoluted macro dependencies."
    ],
    specifications: {
      "Included Assets": "32 Document Templates",
      "File Types": "Figma, Keynote, PPTX, Excel, Google Docs",
      "Download Format": "Instant ZIP (42 MB)",
      "Licence": "Commercial (Single Business)"
    },
    createdAt: "2026-02-10T10:00:00Z",
    updatedAt: "2026-02-18T10:00:00Z",
  },
  {
    id: "prod-005",
    name: "The Complete Mindful Living Bundle",
    slug: "complete-mindful-living-bundle",
    tagline: "The all-in-one digital collection for personal harmony and home clarity.",
    shortDescription: "Combines our 14-Day Home Reset Kit, The Focused Life Productivity Suite, and Seasonal Meal & Pantry Planner at a curated bundle value.",
    fullDescription: `The Mindful Living Bundle represents SEVOLF's philosophy in its purest expression: that quiet order in our spaces and deliberate systems in our work cultivate a deeper sense of contentment.

This bundle unites our top three personal lifestyle frameworks into one unified digital asset library.`,
    category: "home-living",
    categoryLabel: "Bundles & Suites",
    productType: "Curated Bundle",
    format: "bundle",
    formatLabel: "Digital Bundle (3 Comprehensive Systems)",
    price: 2799,
    compareAtPrice: 4198,
    currency: "INR",
    coverImage: "/images/products/mindful-living-bundle/cover.jpg",
    galleryImages: [
      "/images/products/home-reset-kit/cover.jpg",
      "/images/products/productivity-toolkit/cover.jpg",
    ],
    mockupImages: [
      "/images/products/mindful-living-bundle/cover.jpg",
    ],
    features: [
      "Everything in the 14-Day Home Reset Kit",
      "Everything in The Focused Life Productivity Toolkit",
      "Includes exclusive Seasonal Kitchen & Pantry Guide",
      "Over 260 pages of curated digital tools and printable formats"
    ],
    whatsIncluded: [
      "14-Day Home Reset Kit (Full Edition)",
      "The Focused Life Toolkit (GoodNotes + Notion)",
      "Seasonal Kitchen & Pantry System (Bonus Edition)",
      "Curated Audio Meditation Guide (MP3 Companion)"
    ],
    requirements: [
      "Standard PDF reader, Tablet device, or Notion account"
    ],
    licenceType: "personal",
    licenceDescription: "Single-household personal licence.",
    status: "published",
    isFeatured: true,
    isBestseller: true,
    isNewArrival: true,
    isBundle: true,
    tags: ["bundle", "lifestyle", "productivity", "home", "mindfulness"],
    seoTitle: "The Complete Mindful Living Bundle | SEVOLF Digital",
    seoDescription: "The flagship lifestyle bundle combining home curation, digital planning, and mindful kitchen systems.",
    createdAt: "2026-02-12T10:00:00Z",
    updatedAt: "2026-02-18T10:00:00Z",
  },
  {
    id: "prod-006",
    name: "Curiosity & Nature: Science Explorers Workbook",
    slug: "curiosity-nature-science-explorers",
    tagline: "Botanical observation and foundational earth science for children aged 5-8.",
    shortDescription: "A 52-page tactile nature journal featuring leaf identification diagrams, weather observation logs, and gentle backyard experiments.",
    fullDescription: `Inspire gentle scientific inquiry with Curiosity & Nature. Designed with vintage botanical engravings and clear, friendly prompts, this journal encourages young explorers to observe outdoor surroundings with focus and wonder.

Features weather tracking wheels, cloud shape identification, insect morphology anatomy pages, and simple backyard soil percolation tests that require no specialized lab tools.`,
    category: "kids-education",
    categoryLabel: "SEVOLF Little",
    productType: "Printable Science Journal",
    format: "pdf",
    formatLabel: "High-Resolution Printable PDF",
    price: 899,
    compareAtPrice: 1299,
    currency: "INR",
    coverImage: "/images/products/curiosity-nature/cover.jpg",
    galleryImages: [
      "/images/products/mitthus-fun-learning/sample-pages.jpg",
      "/images/products/curiosity-nature/cover.jpg",
    ],
    mockupImages: [
      "/images/products/curiosity-nature/cover.jpg",
    ],
    features: [
      "52 high-resolution botanical and earth-science activity pages",
      "Weather wheel and cloud identification cut-outs",
      "Backyard specimen observation logs",
      "Safe, kitchen-pantry friendly science experiments"
    ],
    whatsIncluded: [
      "Curiosity & Nature Science Explorers Guide (52 Pages PDF)",
      "Printable Observation Diary Sheets",
      "Educator/Parent Exploration Prompt Cards"
    ],
    requirements: [
      "Standard PDF reader and home printer"
    ],
    licenceType: "personal",
    licenceDescription: "Personal household licence.",
    status: "published",
    isFeatured: false,
    isBestseller: false,
    isNewArrival: true,
    tags: ["kids", "science", "nature", "botany", "education", "activity book"],
    seoTitle: "Curiosity & Nature: Science Explorers Workbook | SEVOLF Little",
    seoDescription: "Botanical and natural sciences workbook for young explorers. Printable worksheets for observing trees, clouds, and ecosystems.",
    educationalMeta: {
      ageRange: "5 – 8 Years",
      learningObjectives: [
        "Scientific observation and hypothesis recording",
        "Basic botanical classification and leaf anatomy",
        "Meteorology basics: cloud types and rainfall observation",
        "Environmental respect and outdoor biodiversity awareness"
      ],
      pagesIncluded: 52,
      language: "English",
      printingInstructions: "Standard A4 or US Letter. Suitable for spiral binding or ring-binder presentation."
    },
    createdAt: "2026-02-14T10:00:00Z",
    updatedAt: "2026-02-18T10:00:00Z",
  }
];
