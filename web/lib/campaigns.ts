export type ChannelAsset = {
  platform: "Instagram" | "TikTok";
  format: string;
  hook: string;
  copy: string;
};

export type CampaignAngle = {
  name: string;
  newsletterSubject: string;
  newsletterPreview: string;
  newsletterBody: string;
  assets: ChannelAsset[];
};

export type PersonaCampaign = {
  id: string;
  name: string;
  priority: "high" | "medium" | "low";
  targetingSignal: string;
  opportunity: string;
  angles: CampaignAngle[];
};

export const PERSONA_CAMPAIGNS: PersonaCampaign[] = [
  {
    id: "gifter",
    name: "Gifter",
    priority: "high",
    targetingSignal: "Engraving, gift wrap, delivery deadline, birthday, wedding, Father's Day, and personalisation questions.",
    opportunity: "Turn gift intent into a premium conversion path with engraving, packaging, and occasion-led deadlines.",
    angles: [
      {
        name: "Personalized caseback story",
        newsletterSubject: "Make the caseback mean something",
        newsletterPreview: "Engraving turns a Boldr watch into a keepsake for the person who is hard to shop for.",
        newsletterBody:
          "Add a name, date, or short message to the caseback and make the gift feel built for one person. Pair engraving with gift-ready packaging and a delivery window that works for the occasion.",
        assets: [
          {
            platform: "Instagram",
            format: "Carousel",
            hook: "A gift they can wear every day.",
            copy: "Show gift box, engraving close-up, wrist shot, and final slide with the order deadline.",
          },
          {
            platform: "TikTok",
            format: "Packing video",
            hook: "Pack a personalized watch gift with us.",
            copy: "Film engraving preview, gift wrap, box close, and handwritten-card moment with delivery timing overlay.",
          },
        ],
      },
      {
        name: "Last-minute gift confidence",
        newsletterSubject: "Still need a gift that feels considered?",
        newsletterPreview: "A clean engraving path, gift wrap, and clear delivery timing for high-intent gifters.",
        newsletterBody:
          "When the date is close, clarity matters. Choose the model, add a personal message, and check the delivery window before checkout so the gift arrives with the right details.",
        assets: [
          {
            platform: "Instagram",
            format: "Story sequence",
            hook: "Gift checklist: model, message, delivery.",
            copy: "Three-frame checklist with links to bestsellers, engraving, and delivery FAQ.",
          },
          {
            platform: "TikTok",
            format: "30s decision guide",
            hook: "How to choose a watch gift in under a minute.",
            copy: "Compare two models, show engraving text examples, and close with a delivery deadline prompt.",
          },
        ],
      },
    ],
  },
  {
    id: "health_conscious",
    name: "Health-Conscious Buyer",
    priority: "high",
    targetingSignal: "BPA-free, nickel-free, hypoallergenic, allergy, sensitive skin, kids, dye safety, and certification questions.",
    opportunity: "Build trust with safety proof, material certifications, and clear strap-composition claims.",
    angles: [
      {
        name: "Hypoallergenic strap reassurance",
        newsletterSubject: "A strap built for sensitive skin",
        newsletterPreview: "Hypoallergenic materials, BPA-free silicone, and nickel-conscious hardware for everyday confidence.",
        newsletterBody:
          "Your watch should feel as good as it looks. Boldr straps are designed for daily wear with skin-conscious materials, including BPA-free silicone options and nickel-conscious hardware on selected configurations.",
        assets: [
          {
            platform: "Instagram",
            format: "Carousel",
            hook: "Sensitive skin? Start with the strap.",
            copy: "Slide 1: Hypoallergenic comfort. Slide 2: BPA-free silicone options. Slide 3: Nickel-conscious hardware choices.",
          },
          {
            platform: "TikTok",
            format: "15s product demo",
            hook: "Three material checks before you buy a watch strap.",
            copy: "Show strap flex, buckle close-up, and wrist test while calling out BPA-free and hypoallergenic wear.",
          },
        ],
      },
      {
        name: "Family-safe everyday wear",
        newsletterSubject: "Made for daily wear, checked for peace of mind",
        newsletterPreview: "A quick guide to strap materials for parents, active users, and sensitive-skin buyers.",
        newsletterBody:
          "Material questions matter when a watch becomes part of your daily routine. Use this guide to choose a strap by comfort, care, and safety profile.",
        assets: [
          {
            platform: "Instagram",
            format: "Reel",
            hook: "What makes a strap daily-wear friendly?",
            copy: "Quick cuts: rinse test, wrist movement, buckle close-up, and a final product shot with safety badges.",
          },
          {
            platform: "TikTok",
            format: "Q&A",
            hook: "Is the strap safe for sensitive skin?",
            copy: "Answer directly, show material details, and invite buyers to ask support for model-specific hardware guidance.",
          },
        ],
      },
    ],
  },
  {
    id: "enthusiast",
    name: "Enthusiast / Collector",
    priority: "medium",
    targetingSignal: "Titanium grade, movements, lug width, NATO straps, sapphire, accuracy, servicing, limited editions, and resale questions.",
    opportunity: "Use detailed spec content to convert high-intent buyers and drive accessory attachment.",
    angles: [
      {
        name: "Spec deep dive",
        newsletterSubject: "The details collectors ask us about",
        newsletterPreview: "Titanium, sapphire, movement accuracy, and strap compatibility in one technical guide.",
        newsletterBody:
          "For buyers who compare every detail, the spec sheet is part of the experience. This guide breaks down case material, movement behavior, crystal choice, and strap compatibility.",
        assets: [
          {
            platform: "Instagram",
            format: "Carousel",
            hook: "The spec sheet, translated.",
            copy: "Dedicate each slide to case, crystal, movement, strap width, and accessory pairings.",
          },
          {
            platform: "TikTok",
            format: "Macro detail video",
            hook: "Tiny details watch collectors notice first.",
            copy: "Macro shots of case finishing, lugs, dial, and strap swap with technical callouts.",
          },
        ],
      },
      {
        name: "Strap ecosystem",
        newsletterSubject: "Build your Boldr strap rotation",
        newsletterPreview: "A compatibility guide for NATO, rubber, leather, and mesh strap swaps.",
        newsletterBody:
          "A good tool watch changes character with the right strap. Use lug width and case pairing guidance to build a rotation for work, travel, and weekends.",
        assets: [
          {
            platform: "Instagram",
            format: "Reel",
            hook: "One watch, four strap personalities.",
            copy: "Fast strap-change cuts with labels for field, office, swim, and travel setups.",
          },
          {
            platform: "TikTok",
            format: "Tutorial",
            hook: "How to check whether a third-party strap fits.",
            copy: "Show lug-width measurement, spring bar fit, and final wrist checks.",
          },
        ],
      },
    ],
  },
  {
    id: "active",
    name: "Active Buyer",
    priority: "high",
    targetingSignal: "Outdoor, swimming, diving, trail running, climbing, altitude, shock resistance, rugged use, sizing, fit, and delivery-readiness questions.",
    opportunity: "Position Boldr as a rugged daily companion through use-case guides and fit confidence content.",
    angles: [
      {
        name: "Rugged use-case selector",
        newsletterSubject: "Choose the Boldr for how you move",
        newsletterPreview: "A practical guide for swimming, trails, travel, and everyday durability.",
        newsletterBody:
          "Different routines need different watch details. Compare water resistance, strap choice, case size, and rugged-use specs so active buyers can choose the right setup before checkout.",
        assets: [
          {
            platform: "Instagram",
            format: "Carousel",
            hook: "Pick your Boldr by activity.",
            copy: "Slides for swimming, trail, commute, travel, and daily wear with a recommended setup for each.",
          },
          {
            platform: "TikTok",
            format: "Decision tree",
            hook: "Answer three questions and choose your field watch.",
            copy: "Use prompts for water use, wrist size, and activity level, then show the recommended strap/model combo.",
          },
        ],
      },
      {
        name: "Fit confidence",
        newsletterSubject: "Will this case fit your wrist?",
        newsletterPreview: "Case diameter is only part of the fit. Here is what to check before ordering.",
        newsletterBody:
          "A comfortable fit comes from more than case size. Check lug-to-lug length, strap adjustment range, and how the watch sits on your wrist profile before you buy.",
        assets: [
          {
            platform: "Instagram",
            format: "Reel",
            hook: "The wrist-fit check most buyers miss.",
            copy: "Show case diameter, lug-to-lug, side profile, and strap fit in four quick shots.",
          },
          {
            platform: "TikTok",
            format: "Fit explainer",
            hook: "Small wrist? Do this before choosing a watch.",
            copy: "Demonstrate measuring wrist circumference and comparing it with case proportions.",
          },
        ],
      },
    ],
  },
  {
    id: "sustainable",
    name: "Sustainable Buyer",
    priority: "medium",
    targetingSignal: "Vegan materials, recycling, strap take-back, carbon-neutral shipping, ethical sourcing, and responsible packaging questions.",
    opportunity: "Create honest sustainability content that explains current capabilities and turns repeated gaps into roadmap signals.",
    angles: [
      {
        name: "Responsible materials roadmap",
        newsletterSubject: "What responsible watch ownership can look like",
        newsletterPreview: "Recycling, strap take-back interest, packaging questions, and where Boldr is focusing next.",
        newsletterBody:
          "Customers are asking sharper questions about what happens after purchase. This update explains current material choices, responsible care, and the customer signals shaping future sustainability work.",
        assets: [
          {
            platform: "Instagram",
            format: "Carousel",
            hook: "The sustainability questions we hear most.",
            copy: "Frame each slide as a customer question, then answer with current status and what is being explored.",
          },
          {
            platform: "TikTok",
            format: "Q&A",
            hook: "Do watch straps have a second life?",
            copy: "Answer with disposal guidance, care tips, and an invitation to register interest in take-back programs.",
          },
        ],
      },
      {
        name: "Packaging and shipping clarity",
        newsletterSubject: "Before you check out: packaging and shipping impact",
        newsletterPreview: "A clear answer for buyers comparing recyclable packaging and carbon-conscious shipping.",
        newsletterBody:
          "Sustainable buyers want direct answers, not vague claims. This guide explains packaging, shipping-impact questions, and how customer demand feeds the next round of operational improvements.",
        assets: [
          {
            platform: "Instagram",
            format: "Guide post",
            hook: "Four sustainability checks before checkout.",
            copy: "Packaging, shipping, strap material, and end-of-life disposal with a clear FAQ CTA.",
          },
          {
            platform: "TikTok",
            format: "Checklist video",
            hook: "Trying to buy more responsibly? Check this first.",
            copy: "Cut between packaging, strap materials, checkout, and support Q&A prompts.",
          },
        ],
      },
    ],
  },
];
