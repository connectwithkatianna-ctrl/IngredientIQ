/**
 * IngredientIQ Content Script v1.0.0
 * Intercepts food-log events across nutrition tracking apps and
 * shows safety warnings before items are added to the diary.
 *
 * Supported apps:
 *   - MyFitnessPal  (www.myfitnesspal.com)
 *   - MacrosFirst   (app.macrosfirst.com)
 *   - Cronometer    (cronometer.com)
 *   - Lose It!      (loseit.com)
 */

(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────

  // IngredientIQ backend (see ingredientiq-api/). Point this at your deployed
  // API once you have one; defaults to a local dev server.
  const DEFAULT_API_BASE_URL = 'http://localhost:8787/v1';
  const IIQ_VERSION   = '1.0.0';

  // Site-specific selectors — each app has different DOM patterns
  const SITE_PROFILES = {
    'myfitnesspal.com': {
      name: 'MyFitnessPal',
      foodNameSelectors: [
        '.main-title-2',
        '.food-name',
        'h1.title',
        '.food-log-header .food-name',
        '[data-testid="food-name"]',
        '.food-panel .main-title-2',
        '.log-it-header .food-name',
        '.food-detail-header h1',
        '.tracking-recipe-title',
        '.food-name-header',
      ],
      logButtonSelectors: [
        '.js-confirm-food-add',
        'input[value="Add to Diary"]',
        'input[value="Save"]',
        'button[data-action="add-food"]',
        '.add-to-diary-button',
        '.log-it-btn',
        'button.primary[type="submit"]',
        '.btn-confirm',
        '[data-testid="log-food-btn"]',
        'input.button-primary[type="submit"]',
      ],
      ingredientSelectors: [
        '.ingredient-list li',
        '.ingredients-list .ingredient',
        '[data-testid="ingredients"] li',
        '.food-ingredients p',
      ],
      diaryPagePattern: /\/(food\/diary|food\/log)/,
    },

    'macrosfirst.com': {
      name: 'MacrosFirst',
      foodNameSelectors: [
        '.food-title',
        '[class*="FoodName"]',
        '[class*="food-name"]',
        '[class*="itemName"]',
        'h1[class*="title"]',
        '[data-testid="food-name"]',
        '.log-food-header h1',
        '[class*="FoodDetail"] h1',
        '[class*="FoodDetail"] h2',
      ],
      logButtonSelectors: [
        '[data-testid="log-food-button"]',
        'button[class*="LogButton"]',
        'button[class*="log-button"]',
        'button[class*="AddButton"]',
        'button[class*="Save"]',
        'button[class*="Confirm"]',
        'button.primary',
        'button[type="submit"]',
      ],
      ingredientSelectors: [
        '[class*="IngredientList"] li',
        '[class*="ingredients"] li',
        '[data-testid="ingredient"] span',
      ],
      diaryPagePattern: /\/diary|\/log|\/food/,
    },

    'cronometer.com': {
      name: 'Cronometer',
      // Cronometer runs on GWT (Google Web Toolkit) — class names are auto-generated
      // and change between builds. We combine CSS selectors with text-content matching
      // (see interceptLogButtons below) for resilience.
      foodNameSelectors: [
        // GWT dialog/panel titles that appear when a food is selected
        '.gwt-DialogBox .Caption',
        '.gwt-DialogBox .gwt-HTML',
        '[class*="food-name"]',
        '[class*="FoodName"]',
        '[class*="foodName"]',
        '.food-name',
        '.serving-header',
        '[class*="serving"] [class*="name"]',
        '[class*="FoodDetail"] h2',
        '[class*="FoodDetail"] h3',
        // GWT panel headers
        '.gwt-Label',
        // Fallback: any bold label in a GWT dialog
        '.gwt-DialogBox b',
      ],
      logButtonSelectors: [
        // GWT standard button class — most reliable CSS selector in GWT
        'button.gwt-Button',
        '.gwt-Button',
        // Cronometer-specific confirmed selectors (check DevTools if these change)
        '[class*="add-to-diary"]',
        '[class*="addToDiary"]',
        '[class*="AddToDiary"]',
        '[class*="save-serving"]',
        '[class*="SaveServing"]',
        'button[class*="primary"]',
        'button[class*="Primary"]',
        // Generic fallback
        'button[type="submit"]',
      ],
      // Text strings used to identify the correct button when CSS selectors
      // are ambiguous (GWT builds vary). Matched case-insensitively against
      // button.textContent.trim().
      logButtonTextPatterns: [
        'add to diary',
        'save serving',
        'log food',
        'add food',
        'save',
      ],
      ingredientSelectors: [
        '[class*="ingredient"] li',
        '[class*="Ingredient"] li',
        '.ingredients li',
        '.food-ingredients li',
        '[class*="ingredient-list"] span',
      ],
      // Cronometer uses GWT hash routing: cronometer.com/# or cronometer.com/#diary
      diaryPagePattern: /.*/,
    },

    'loseit.com': {
      name: 'Lose It!',
      foodNameSelectors: [
        '.food-name',
        '[class*="FoodName"]',
        '.item-name',
        '.food-title',
        'h1.title',
      ],
      logButtonSelectors: [
        'button.log-it',
        '[data-testid="log-food"]',
        '.add-food-button',
        'button[class*="Log"]',
        'button.primary',
      ],
      ingredientSelectors: [
        '.ingredients li',
      ],
      diaryPagePattern: /\/diary|\/log/,
    },
  };

  // ─── Local ingredient DB (100+ entries, no API required) ───────────────────

  const LOCAL_DB = [
    // BANNED
    { k: ['red 3','erythrosine','fd&c red no 3','red no. 3'], n: 'Red No. 3 (Erythrosine)', t: 'banned', badge: 'Banned — Jan 2025', warn: 'FDA revoked Jan 2025. Deadline Jan 2027.', dot: '#E24B4A' },
    { k: ['brominated vegetable oil','bvo'], n: 'Brominated vegetable oil (BVO)', t: 'banned', badge: 'Banned — Jul 2024', warn: 'FDA revoked Jul 2024. Phaseout Aug 2025.', dot: '#E24B4A' },
    { k: ['partially hydrogenated','hydrogenated vegetable oil','hydrogenated soybean oil','hydrogenated cottonseed','hydrogenated palm'], n: 'Partially hydrogenated oil (trans fat)', t: 'banned', badge: 'Banned — 2018', warn: 'Check for "partially hydrogenated" in any form.', dot: '#E24B4A' },
    { k: ['coumarin','tonka bean'], n: 'Coumarin', t: 'banned', badge: 'Banned — 21 CFR 189', warn: 'Hepatotoxic. Prohibited food additive.', dot: '#E24B4A' },
    { k: ['cyclamate','sodium cyclamate'], n: 'Cyclamate', t: 'banned', badge: 'Banned in US — 1969', warn: 'Still found in some imported diet foods.', dot: '#E24B4A' },
    // BIG 9 ALLERGENS
    { k: ['peanut','peanuts','groundnut','peanut butter','peanut flour'], n: 'Peanuts', t: 'allergen', badge: 'Big 9 allergen', warn: 'No safe threshold. Anaphylaxis risk.', dot: '#EF9F27' },
    { k: ['shrimp','crab','lobster','prawn','crawfish','crustacean shellfish','krill'], n: 'Crustacean shellfish', t: 'allergen', badge: 'Big 9 allergen', warn: 'Anaphylaxis. Declare specific type.', dot: '#EF9F27' },
    { k: ['nonfat milk','skim milk','whole milk','casein','whey','caseinate','lactalbumin','lactose','buttermilk','cream','cheese','milk powder','dried milk'], n: 'Milk / dairy', t: 'allergen', badge: 'Big 9 allergen', warn: 'All milk derivatives must be declared.', dot: '#EF9F27' },
    { k: ['egg white','egg yolk','whole egg','dried egg','albumin','ovalbumin','powdered egg'], n: 'Eggs', t: 'allergen', badge: 'Big 9 allergen', warn: 'In coatings, glazes, binders.', dot: '#EF9F27' },
    { k: ['anchovy','anchovies','salmon','tuna','tilapia','pollock','cod','haddock','fish sauce','fish oil'], n: 'Fish', t: 'allergen', badge: 'Big 9 allergen', warn: 'Must list specific type.', dot: '#EF9F27' },
    { k: ['almond','walnut','pecan','cashew','pistachio','hazelnut','macadamia','brazil nut','pine nut','tree nut'], n: 'Tree nuts', t: 'allergen', badge: 'Big 9 allergen', warn: 'Must list specific nut type.', dot: '#EF9F27' },
    { k: ['enriched flour','whole wheat','wheat flour','semolina','spelt','gluten','durum','wheat starch','wheat protein','bread flour'], n: 'Wheat / gluten', t: 'allergen', badge: 'Big 9 allergen + celiac', warn: 'Intestinal damage in celiac disease.', dot: '#EF9F27' },
    { k: ['soy flour','soy protein','soy lecithin','textured vegetable protein','tvp','tofu','miso','edamame','tempeh'], n: 'Soybeans', t: 'allergen', badge: 'Big 9 allergen', warn: 'Soy lecithin in release agents must be declared.', dot: '#EF9F27' },
    { k: ['sesame seed','tahini','sesame oil','sesame flour'], n: 'Sesame', t: 'allergen', badge: 'Big 9 — added 2023', warn: 'Newest Big 9 addition. Audit legacy labels.', dot: '#EF9F27' },
    // HIGH CONCERN
    { k: ['bha','butylated hydroxyanisole'], n: 'BHA', t: 'concern', badge: 'Probable carcinogen', warn: 'NTP 2021: reasonably anticipated carcinogen. FDA considering ban.', dot: '#BA7517' },
    { k: ['bht','butylated hydroxytoluene'], n: 'BHT', t: 'concern', badge: 'Endocrine disruptor', warn: 'Linked to hormone disruption. Often paired with BHA.', dot: '#BA7517' },
    { k: ['tbhq','tert-butylhydroquinone','tertiary butylhydroquinone'], n: 'TBHQ', t: 'concern', badge: 'Immune disruption', warn: 'Linked to immune system disruption. Banned in Japan.', dot: '#BA7517' },
    { k: ['potassium bromate','bromate'], n: 'Potassium bromate', t: 'concern', badge: 'IARC Group 2B carcinogen', warn: 'Possible carcinogen. California banned 2025. EU banned.', dot: '#BA7517' },
    { k: ['propyl paraben','propylparaben'], n: 'Propylparaben', t: 'concern', badge: 'Endocrine disruptor', warn: 'Endocrine disruptor. California banned 2025. EU food ban.', dot: '#BA7517' },
    { k: ['azodicarbonamide','azo '], n: 'Azodicarbonamide (ADA)', t: 'concern', badge: 'Decomposes to carcinogen', warn: 'Forms semicarbazide when baked. Banned in EU.', dot: '#BA7517' },
    { k: ['sulfite','sulfur dioxide','sodium bisulfite','potassium bisulfite','sodium metabisulfite','potassium metabisulfite','sodium sulfite'], n: 'Sulfites', t: 'concern', badge: 'FSIS-flagged intolerance', warn: 'FSIS mandates declaration ≥10 ppm. Asthma risk.', dot: '#BA7517' },
    { k: ['sodium nitrate','sodium nitrite','potassium nitrite','nitrite','celery juice powder','celery powder'], n: 'Nitrates / nitrites', t: 'concern', badge: 'FSIS curing agents', warn: 'Forms nitrosamines at high heat. FSIS strict labeling rules.', dot: '#BA7517' },
    { k: ['monosodium glutamate','msg','hydrolyzed soy protein','autolyzed yeast','yeast extract'], n: 'MSG / glutamate', t: 'concern', badge: 'FSIS-flagged', warn: 'FSIS-flagged intolerance ingredient. Often undeclared.', dot: '#BA7517' },
    { k: ['sodium benzoate','potassium benzoate'], n: 'Sodium benzoate', t: 'concern', badge: 'Benzene formation risk', warn: 'Forms benzene with vitamin C in acidic drinks.', dot: '#BA7517' },
    { k: ['high fructose corn syrup','high-fructose corn syrup','hfcs'], n: 'High-fructose corn syrup', t: 'concern', badge: 'Metabolic risk', warn: 'Linked to obesity, metabolic syndrome, fatty liver disease.', dot: '#BA7517' },
    { k: ['carrageenan'], n: 'Carrageenan', t: 'concern', badge: 'Gut inflammation', warn: 'Gut inflammation in animal studies. EU restricts in infant formula.', dot: '#BA7517' },
    { k: ['aspartame'], n: 'Aspartame', t: 'concern', badge: 'IARC Group 2B (2023)', warn: 'Classified possible carcinogen by WHO/IARC 2023. Contains phenylalanine (PKU risk).', dot: '#BA7517' },
    { k: ['acesulfame potassium','acesulfame k','ace-k'], n: 'Acesulfame potassium', t: 'concern', badge: 'Limited safety data', warn: 'Gut microbiome disruption. Methylene chloride residue.', dot: '#BA7517' },
    { k: ['caramel color','caramel colour'], n: 'Caramel coloring (4-MEI)', t: 'concern', badge: '4-MEI probable carcinogen', warn: '4-methylimidazole contaminant in Class III/IV. CA Prop 65 threshold.', dot: '#BA7517' },
    { k: ['polysorbate 80','polysorbate 60'], n: 'Polysorbate 80', t: 'concern', badge: 'Gut microbiome disruption', warn: 'Metabolic syndrome in animal studies. Gut barrier disruption.', dot: '#BA7517' },
    // UNDER FDA REVIEW
    { k: ['red 40','allura red','fd&c red 40','red #40','red#40'], n: 'Red No. 40', t: 'review', badge: 'Under FDA review 2025', warn: 'Multiple state school bans. FDA 2025 reassessment.', dot: '#378ADD' },
    { k: ['yellow 5','tartrazine','fd&c yellow 5','yellow#5'], n: 'Yellow No. 5 (Tartrazine)', t: 'review', badge: 'Under FDA review; FSIS-flagged', warn: 'FSIS mandates declaration by full name.', dot: '#378ADD' },
    { k: ['yellow 6','sunset yellow','fd&c yellow 6','yellow#6'], n: 'Yellow No. 6', t: 'review', badge: 'Under FDA review 2025', warn: 'FDA 2025 synthetic dye reassessment.', dot: '#378ADD' },
    { k: ['blue 1','brilliant blue','fd&c blue 1'], n: 'Blue No. 1', t: 'review', badge: 'Under FDA review 2025', warn: 'State school prohibition bills.', dot: '#378ADD' },
    { k: ['blue 2','indigo carmine','fd&c blue 2'], n: 'Blue No. 2', t: 'review', badge: 'Under FDA review 2025', warn: 'Part of FDA 2025 dye reassessment.', dot: '#378ADD' },
    { k: ['titanium dioxide'], n: 'Titanium dioxide', t: 'review', badge: 'Under FDA review; EU banned 2022', warn: 'EU banned 2022 (genotoxicity). FDA active review.', dot: '#378ADD' },
    // SECRET GRAS
    { k: ['green tea extract','egcg','epigallocatechin','catechin extract'], n: 'Green tea extract (EGCG)', t: 'secret', badge: 'Secret GRAS — FDA rejected twice', warn: 'FDA twice rejected safety filing. Liver/kidney toxicity at concentration.', dot: '#7F77DD' },
    { k: ['aloe vera','aloe extract'], n: 'Aloe vera', t: 'secret', badge: 'Secret GRAS 2010', warn: 'Self-affirmed safe without FDA review. FDA banned in OTC laxatives.', dot: '#7F77DD' },
    { k: ['mushroom extract','turkey tail mushroom'], n: 'Mushroom extract', t: 'secret', badge: 'Secret GRAS — one variety FDA banned', warn: 'Cannot determine from label which extract. One variety FDA banned 2024.', dot: '#7F77DD' },
  ];

  const WEIGHTS = { banned: 100, allergen: 80, concern: 60, review: 40, secret: 35, safe: 0 };
  const TIER_LABELS = { banned: 'Banned', allergen: 'Big 9 Allergen', concern: 'High Concern', review: 'Under Review', secret: 'Secret GRAS' };

  // ─── State ─────────────────────────────────────────────────────────────────

  let settings = {
    enabled: true,
    apiKey: '',                              // BYOK Anthropic key (used server-side, never called directly from here)
    apiBaseUrl: DEFAULT_API_BASE_URL,         // IngredientIQ backend base URL
    iiqApiToken: 'iiq_test_extension',        // Bearer token for the IngredientIQ backend itself
    warningStyle: 'modal',
    sensitivity: 'concern',
    allergenProfile: [],
    snoozeUntil: 0,
  };

  let interceptedButtons = new WeakSet();
  let currentWarning = null;
  let pendingCallback = null;
  let siteProfile = null;
  let overlayEl = null;
  let bannerEl = null;

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    const host = location.hostname;
    siteProfile = Object.keys(SITE_PROFILES).find(k => host.includes(k));
    if (!siteProfile) return;

    chrome.storage.sync.get([
      'enabled', 'apiKey', 'apiBaseUrl', 'iiqApiToken', 'warningStyle', 'sensitivity', 'allergenProfile', 'snoozeUntil'
    ], (stored) => {
      Object.assign(settings, stored);
      if (!settings.enabled) return;
      if (settings.snoozeUntil && Date.now() < settings.snoozeUntil) return;
      startObserver();
      injectBannerSlot();
    });
  }

  // ─── DOM Observer ──────────────────────────────────────────────────────────

  function startObserver() {
    const profile = SITE_PROFILES[siteProfile];

    // MutationObserver: re-scan for new log buttons whenever DOM changes
    const observer = new MutationObserver(() => {
      interceptLogButtons(profile);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Hash-change listener: Cronometer uses #-based routing (cronometer.com/#)
    // Navigation within the SPA doesn't reload the page, so we must re-scan
    window.addEventListener('hashchange', () => {
      console.log('[IngredientIQ] Hash change detected — re-scanning for buttons');
      setTimeout(() => interceptLogButtons(profile), 600);
    });

    // History API listener: catches pushState/replaceState navigation
    // used by React SPAs like MacrosFirst and Lose It
    const origPush    = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...a) => { origPush(...a); setTimeout(() => interceptLogButtons(profile), 600); };
    history.replaceState = (...a) => { origReplace(...a); setTimeout(() => interceptLogButtons(profile), 600); };

    // Initial scan (also covers page-load injection)
    setTimeout(() => interceptLogButtons(profile), 500);
    interceptLogButtons(profile);
  }

  function interceptLogButtons(profile) {
    // Pass 1: CSS selector matching (fast, works for MFP, MacrosFirst, Lose It)
    const selectors = profile.logButtonSelectors.join(', ');
    let cssCandidates = [];
    try { cssCandidates = Array.from(document.querySelectorAll(selectors)); } catch (e) {}

    // Pass 2: text-content matching (essential for Cronometer/GWT where
    // class names are auto-generated and change between builds)
    const textPatterns = profile.logButtonTextPatterns || [
      'add to diary', 'log food', 'save serving', 'add food',
    ];
    const allClickable = Array.from(document.querySelectorAll(
      'button, [role="button"], input[type="button"], input[type="submit"]'
    ));
    const textCandidates = allClickable.filter(el => {
      const txt = (el.textContent || el.value || '').trim().toLowerCase();
      return textPatterns.some(p => txt === p || txt.startsWith(p));
    });

    // Deduplicated merge of both passes
    const all = [...new Set([...cssCandidates, ...textCandidates])];
    all.forEach(btn => {
      if (interceptedButtons.has(btn)) return;
      interceptedButtons.add(btn);
      console.log(`[IngredientIQ] Hooked: "${(btn.textContent || btn.value || '').trim()}"`, btn);
      btn.addEventListener('click', handleLogClick, true);
    });
  }

  // ─── Click Handler ─────────────────────────────────────────────────────────

  async function handleLogClick(e) {
    const profile = SITE_PROFILES[siteProfile];

    // Extract food name from DOM
    const foodName = extractFoodName(profile);
    if (!foodName) return; // Can't identify food — allow through

    // Don't re-intercept if warning already showing
    if (currentWarning) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    pendingCallback = () => {
      // Re-fire the original event on the button
      const clone = new MouseEvent('click', { bubbles: true, cancelable: true });
      e.target.removeEventListener('click', handleLogClick, true);
      e.target.dispatchEvent(clone);
      e.target.addEventListener('click', handleLogClick, true);
    };

    showAnalyzingIndicator();

    try {
      const analysis = await analyzeFood(foodName, profile);
      hideAnalyzingIndicator();

      const shouldWarn = decideShouldWarn(analysis);
      if (!shouldWarn) {
        pendingCallback();
        pendingCallback = null;
        return;
      }

      currentWarning = analysis;

      if (settings.warningStyle === 'modal' || settings.warningStyle === 'both') {
        showModal(foodName, analysis);
      }
      if (settings.warningStyle === 'banner' || settings.warningStyle === 'both') {
        showBanner(foodName, analysis);
      }
    } catch (err) {
      console.warn('[IngredientIQ] Analysis failed:', err);
      hideAnalyzingIndicator();
      pendingCallback();
      pendingCallback = null;
    }
  }

  // ─── Food Name Extraction ──────────────────────────────────────────────────

  function extractFoodName(profile) {
    // Try profile-specific CSS selectors first
    for (const sel of profile.foodNameSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 2) {
          return el.textContent.trim().replace(/\s+/g, ' ');
        }
      } catch (_) {}
    }

    // Cronometer-specific: GWT renders food names inside DialogBox Captions
    // or as the first visible label in an open panel/dialog.
    if (siteProfile === 'cronometer.com') {
      // Look for any open GWT dialog or overlay
      const dialogs = document.querySelectorAll(
        '.gwt-DialogBox, [class*="Dialog"], [class*="dialog"], [class*="Modal"], [class*="modal"], [class*="Panel"][class*="visible"]'
      );
      for (const dlg of dialogs) {
        const labels = dlg.querySelectorAll('b, strong, h2, h3, h4, .gwt-Label, [class*="title"], [class*="Title"], [class*="name"]');
        for (const lbl of labels) {
          const txt = lbl.textContent.trim();
          if (txt.length > 3 && txt.length < 120 && !/add|diary|serving|amount|save|cancel|close/i.test(txt)) {
            return txt;
          }
        }
      }
    }

    // Generic fallback: nearest visible heading to any log button
    const headings = document.querySelectorAll('h1, h2, h3, h4');
    for (const h of headings) {
      const text = h.textContent.trim();
      if (text.length > 3 && text.length < 120
        && !/diary|log|today|breakfast|lunch|dinner|snack|add food|search/i.test(text)) {
        return text;
      }
    }

    return null;
  }

  // ─── Ingredient Extraction ─────────────────────────────────────────────────

  function extractPageIngredients(profile) {
    const ings = [];
    for (const sel of profile.ingredientSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        if (els.length) {
          els.forEach(el => {
            const text = el.textContent.trim();
            if (text) ings.push(text);
          });
          if (ings.length) break;
        }
      } catch (_) {}
    }

    // Also check for a full ingredients text block
    const allText = document.body.innerText;
    const match = allText.match(/ingredients?\s*:\s*([^\n]{20,500})/i);
    if (match && !ings.length) {
      return match[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }

    return ings;
  }

  // ─── Analysis ──────────────────────────────────────────────────────────────

  async function analyzeFood(foodName, profile) {
    // Step 1: Try extracting ingredients from the page DOM
    const pageIngredients = extractPageIngredients(profile);

    // Step 2: Prefer the IngredientIQ backend — it has the fuller, versioned
    // ingredient database and (with an Anthropic key configured, BYOK or
    // server-side) can look up foods that aren't on the page at all.
    try {
      if (pageIngredients.length >= 3) {
        const apiResult = await callBackendAnalyze(pageIngredients);
        return toLegacyAnalysis(apiResult, foodName);
      }
      if (settings.apiKey) {
        const apiResult = await callBackendNameLookup(foodName);
        return toLegacyAnalysis(apiResult, foodName);
      }
    } catch (e) {
      console.warn('[IngredientIQ] Backend analysis failed, falling back to local DB:', e);
    }

    // Step 3: Fully offline fallback — local 39-ingredient DB, no network.
    const ingredients = pageIngredients.length ? pageIngredients : [foodName];
    return runLocalAnalysis(ingredients, foodName);
  }

  function buildAnalyzeOptions() {
    // popup.js stores "tree nuts" (space) to match the allergen enum's
    // "tree_nuts" (underscore) used by the backend/OpenAPI spec.
    const ALLERGEN_KEY_MAP = { 'tree nuts': 'tree_nuts' };
    const THRESHOLD_MAP = { concern: 'concern', review: 'review', all: 'safe' };
    const options = {
      allergen_profile: (settings.allergenProfile || []).map(a => ALLERGEN_KEY_MAP[a] || a),
      flag_threshold: THRESHOLD_MAP[settings.sensitivity] || 'concern',
      include_alternatives: true,
      include_sources: true,
    };
    return options;
  }

  async function callBackendAnalyze(ingredients) {
    const res = await fetch(`${settings.apiBaseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.iiqApiToken}`,
      },
      body: JSON.stringify({ ingredients, options: buildAnalyzeOptions() }),
    });
    if (!res.ok) throw new Error('Backend /analyze error ' + res.status);
    return res.json();
  }

  async function callBackendNameLookup(foodName) {
    const options = buildAnalyzeOptions();
    options.anthropic_api_key = settings.apiKey; // BYOK — required unless the server has its own key configured
    const res = await fetch(`${settings.apiBaseUrl}/analyze/name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.iiqApiToken}`,
      },
      body: JSON.stringify({ food_name: foodName, options }),
    });
    if (!res.ok) throw new Error('Backend /analyze/name error ' + res.status);
    return res.json();
  }

  /**
   * Adapts the backend's AnalyzeResponse shape (per ingredientiq-openapi.yaml)
   * into the { filtered, allergenHits, riskScore, worst, foodName, ingredients }
   * shape showModal()/showBanner() already know how to render. Re-applies the
   * sensitivity filter and risk formula client-side because the backend
   * always returns every matched ingredient regardless of flag_threshold
   * (flag_threshold only trims summary.flags) — this keeps "Warn for"
   * behaving the way it did under the old local-only analysis.
   */
  function toLegacyAnalysis(apiResponse, foodNameFallback) {
    const TIER_ALIAS = { secret_gras: 'secret' }; // backend uses secret_gras; local color maps use secret
    const SENS_FILTER = {
      concern: t => ['banned', 'allergen', 'concern'].includes(t),
      review:  t => ['banned', 'allergen', 'concern', 'review'].includes(t),
      all:     () => true,
    };
    const sensFn = SENS_FILTER[settings.sensitivity] || SENS_FILTER.concern;

    const filtered = (apiResponse.ingredients || [])
      .map(ing => ({
        n: ing.name,
        t: TIER_ALIAS[ing.tier] || ing.tier,
        badge: ing.badge || '',
        warn: ing.warning_label || ing.health_effects || '',
        input: ing.input,
      }))
      .filter(m => sensFn(m.t));

    const allergenHits = (apiResponse.summary && apiResponse.summary.allergen_alerts) || [];

    const totalWeight = filtered.reduce((s, m) => s + (WEIGHTS[m.t] || 0), 0);
    const rawScore = filtered.length ? Math.round(totalWeight / filtered.length) : 0;
    const riskScore = Math.min(100, rawScore + (allergenHits.length ? 15 : 0));

    const worst = filtered.reduce((w, m) =>
      (WEIGHTS[m.t] || 0) > (WEIGHTS[w?.t] || 0) ? m : w, null);

    return {
      filtered,
      allergenHits,
      riskScore,
      worst,
      foodName: (apiResponse.metadata && apiResponse.metadata.product_name) || foodNameFallback,
      ingredients: (apiResponse.ingredients || []).map(i => i.input),
    };
  }

  function runLocalAnalysis(ingredients, foodName) {
    const matches = [];
    const seen = new Set();

    for (const raw of ingredients) {
      const lq = raw.toLowerCase();
      const match = LOCAL_DB.find(d => d.k.some(k => lq.includes(k) || k.includes(lq)));
      if (match && !seen.has(match.n)) {
        seen.add(match.n);
        matches.push({ ...match, input: raw });
      }
    }

    const SENS_FILTER = {
      concern: m => ['banned', 'allergen', 'concern'].includes(m.t),
      review:  m => ['banned', 'allergen', 'concern', 'review'].includes(m.t),
      all:     m => true,
    };

    const filtered = matches.filter(SENS_FILTER[settings.sensitivity] || SENS_FILTER.concern);

    const allergenHits = filtered.filter(m => {
      if (m.t !== 'allergen') return false;
      return settings.allergenProfile.some(a => m.k.some(k => k.includes(a.toLowerCase())));
    });

    const totalWeight = filtered.reduce((s, m) => s + (WEIGHTS[m.t] || 0), 0);
    const rawScore = filtered.length ? Math.round(totalWeight / filtered.length) : 0;
    const riskScore = Math.min(100, rawScore + (allergenHits.length ? 15 : 0));

    const worst = filtered.reduce((w, m) =>
      (WEIGHTS[m.t] || 0) > (WEIGHTS[w?.t] || 0) ? m : w, null);

    return { filtered, allergenHits, riskScore, worst, foodName, ingredients };
  }

  function decideShouldWarn(analysis) {
    return analysis.filtered.length > 0 && analysis.riskScore > 0;
  }

  // ─── Risk helpers ──────────────────────────────────────────────────────────

  const RISK_COLORS  = { banned: '#E24B4A', allergen: '#EF9F27', concern: '#BA7517', review: '#378ADD', secret: '#7F77DD', safe: '#639922' };
  const RISK_BG      = { banned: '#FCEBEB', allergen: '#FAEEDA', concern: '#FFF8E1', review: '#E6F1FB', secret: '#EEEDFE' };
  const RISK_TEXT    = { banned: '#791F1F', allergen: '#633806', concern: '#412402', review: '#042C53', secret: '#26215C' };

  function riskLevel(score) {
    if (score >= 81) return 'Critical';
    if (score >= 61) return 'High risk';
    if (score >= 36) return 'Moderate';
    if (score >= 16) return 'Low concern';
    return 'Minimal';
  }

  // ─── Modal Warning ─────────────────────────────────────────────────────────

  function showModal(foodName, analysis) {
    removeModal();

    const { filtered, allergenHits, riskScore, worst } = analysis;
    const wt   = worst ? worst.t : 'concern';
    const wc   = RISK_COLORS[wt];
    const wbg  = RISK_BG[wt];
    const wtxt = RISK_TEXT[wt];
    const rl   = riskLevel(riskScore);

    const alertTitle = allergenHits.length
      ? `Allergen detected in ${foodName}`
      : `${filtered.length} safety flag${filtered.length !== 1 ? 's' : ''} in ${foodName}`;

    const ingHtml = filtered.map(m => `
      <div class="iiq-ing-row iiq-tier-${m.t}">
        <div class="iiq-ing-dot" style="background:${RISK_COLORS[m.t]}"></div>
        <div class="iiq-ing-info">
          <div class="iiq-ing-name">${m.n}</div>
          <div class="iiq-ing-badge iiq-badge-${m.t}">${m.badge}</div>
          <div class="iiq-ing-warn">${m.warn}</div>
        </div>
      </div>`).join('');

    const html = `
      <div class="iiq-modal-overlay" id="iiq-overlay">
        <div class="iiq-modal-sheet" role="dialog" aria-modal="true" aria-label="Ingredient safety alert">
          <div class="iiq-modal-handle"></div>

          <div class="iiq-modal-header" style="border-left: 3px solid ${wc}; background: ${wbg}">
            <div class="iiq-header-icon" style="background:${wbg}; color:${wc}">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L2 17h16L10 2z" stroke="${wc}" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 8v4" stroke="${wc}" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="14.5" r="0.75" fill="${wc}"/></svg>
            </div>
            <div>
              <div class="iiq-modal-title" style="color:${wtxt}">${alertTitle}</div>
              <div class="iiq-modal-sub">Powered by IngredientIQ · FDA/FSIS/EWG data</div>
            </div>
          </div>

          <div class="iiq-risk-bar-wrap">
            <div class="iiq-risk-bar-labels">
              <span>Risk score</span>
              <span style="color:${wc}">${riskScore}/100 — ${rl}</span>
            </div>
            <div class="iiq-risk-track">
              <div class="iiq-risk-fill" style="width:${riskScore}%; background:${wc}"></div>
            </div>
          </div>

          <div class="iiq-ing-list">${ingHtml}</div>

          <div class="iiq-modal-actions">
            <button class="iiq-btn iiq-btn-dismiss" id="iiq-dismiss-btn">Dismiss</button>
            ${filtered.some(m => ['banned','concern'].includes(m.t))
              ? `<button class="iiq-btn iiq-btn-alt" id="iiq-alt-btn">Find alternative</button>`
              : ''}
            <button class="iiq-btn iiq-btn-log" id="iiq-log-btn">Log anyway</button>
          </div>

          <div class="iiq-modal-footer">
            <span id="iiq-snooze-btn" class="iiq-snooze">Snooze warnings for 1 hour</span>
          </div>
        </div>
      </div>`;

    overlayEl = document.createElement('div');
    overlayEl.innerHTML = html;
    document.body.appendChild(overlayEl);

    document.getElementById('iiq-dismiss-btn').addEventListener('click', dismissAll);
    document.getElementById('iiq-log-btn').addEventListener('click', () => { dismissAll(); proceedWithLog(); });
    document.getElementById('iiq-snooze-btn').addEventListener('click', snoozeWarnings);
    const altBtn = document.getElementById('iiq-alt-btn');
    if (altBtn) altBtn.addEventListener('click', openAlternatives);
  }

  function removeModal() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  // ─── Banner Warning ─────────────────────────────────────────────────────────

  function injectBannerSlot() {
    const slot = document.createElement('div');
    slot.id = 'iiq-banner-slot';
    document.body.prepend(slot);
  }

  function showBanner(foodName, analysis) {
    removeBanner();

    const { filtered, allergenHits, riskScore, worst } = analysis;
    const wt   = worst ? worst.t : 'concern';
    const wc   = RISK_COLORS[wt];
    const wbg  = RISK_BG[wt];
    const wtxt = RISK_TEXT[wt];

    const summary = allergenHits.length
      ? `Allergen + ${filtered.length} flag${filtered.length !== 1 ? 's' : ''} in ${foodName}`
      : `${filtered.length} ingredient flag${filtered.length !== 1 ? 's' : ''} in ${foodName}`;

    const pillsHtml = filtered.map(m =>
      `<span class="iiq-banner-pill iiq-badge-${m.t}">${m.n}</span>`
    ).join('');

    const html = `
      <div class="iiq-banner" id="iiq-banner" style="border-left:3px solid ${wc}; background:${wbg}">
        <div class="iiq-banner-main">
          <div class="iiq-banner-dot" style="background:${wc}"></div>
          <div class="iiq-banner-text" style="color:${wtxt}">${summary}</div>
          <div class="iiq-banner-controls">
            <button class="iiq-banner-expand" id="iiq-banner-expand" style="color:${wc}">Details</button>
            <button class="iiq-banner-log" id="iiq-banner-log">Log anyway</button>
            <button class="iiq-banner-dismiss" id="iiq-banner-dismiss" style="color:${wc}" aria-label="Dismiss">×</button>
          </div>
        </div>
        <div class="iiq-banner-detail" id="iiq-banner-detail" style="display:none; border-top: 0.5px solid ${wc}40">
          <div class="iiq-banner-pills">${pillsHtml}</div>
        </div>
      </div>`;

    bannerEl = document.createElement('div');
    bannerEl.innerHTML = html;

    const slot = document.getElementById('iiq-banner-slot');
    if (slot) slot.appendChild(bannerEl);
    else document.body.prepend(bannerEl);

    let expanded = false;
    document.getElementById('iiq-banner-expand').addEventListener('click', () => {
      expanded = !expanded;
      document.getElementById('iiq-banner-detail').style.display = expanded ? 'block' : 'none';
      document.getElementById('iiq-banner-expand').textContent = expanded ? 'Hide' : 'Details';
    });
    document.getElementById('iiq-banner-log').addEventListener('click', () => { removeBanner(); proceedWithLog(); });
    document.getElementById('iiq-banner-dismiss').addEventListener('click', dismissAll);
  }

  function removeBanner() {
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  function dismissAll() {
    removeModal();
    removeBanner();
    currentWarning = null;
    pendingCallback = null;
  }

  function proceedWithLog() {
    if (pendingCallback) {
      pendingCallback();
      pendingCallback = null;
    }
    currentWarning = null;
  }

  function snoozeWarnings() {
    const until = Date.now() + 60 * 60 * 1000; // 1 hour
    chrome.storage.sync.set({ snoozeUntil: until });
    dismissAll();
  }

  function openAlternatives() {
    if (currentWarning) {
      const name = currentWarning.foodName;
      const flags = currentWarning.filtered.map(f => f.n).join(', ');
      window.open(
        `https://www.myfitnesspal.com/food/search?search=${encodeURIComponent(name + ' no ' + currentWarning.worst?.n)}`,
        '_blank'
      );
    }
    dismissAll();
  }

  // ─── Analyzing indicator ────────────────────────────────────────────────────

  function showAnalyzingIndicator() {
    const el = document.createElement('div');
    el.id = 'iiq-analyzing';
    el.className = 'iiq-analyzing-toast';
    el.innerHTML = `
      <div class="iiq-toast-spinner"></div>
      <span>Checking ingredients…</span>`;
    document.body.appendChild(el);
  }

  function hideAnalyzingIndicator() {
    const el = document.getElementById('iiq-analyzing');
    if (el) el.remove();
  }

  // ─── Listen for settings changes from popup ─────────────────────────────────

  chrome.storage.onChanged.addListener((changes) => {
    for (const key of Object.keys(changes)) {
      if (key in settings) settings[key] = changes[key].newValue;
    }
  });

  // ─── Start ─────────────────────────────────────────────────────────────────

  init();

})();
