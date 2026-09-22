const en = {
  language: { zh: '中文', en: 'EN', switchTo: 'Switch language' },
  app: {
    title: 'Guandan Hand Grouping Score',
    quickActions: 'Quick actions',
    newDeal: 'New Deal',
    import: 'Import',
    godView: 'God View',
    closeGodView: 'Close View',
    godViewCompact: 'View',
    confirmGroup: 'Confirm Group',
    autoComplete: 'Auto Complete'
  },
  labels: {
    cardArea: 'Cards',
    currentLevel: 'Current Level',
    groupedHands: 'Grouped Hands',
    handImport: 'Import Hand',
    imageOcrImport: 'Image / OCR Import',
    jsonImport: 'JSON Import',
    user: 'User',
    ai: 'AI',
    score: 'points',
    totalScore: 'Total',
    threat: 'Threat',
    hands: 'hands',
    bombs: 'Bombs',
    opponent: 'Opponent',
    teammate: 'Teammate',
    self: 'Self',
    suggested: 'Suggestions',
    remove: 'Split',
    noHistory: 'No history yet'
  },
  combo: {
    single: 'Single',
    pair: 'Pair',
    triple: 'Triple',
    threeWithPair: 'Three with Pair',
    straight: 'Straight',
    wood: 'Consecutive Pairs',
    steel: 'Consecutive Triples',
    straightFlush: 'Straight Flush',
    bomb4: '4-card Bomb',
    bomb5: '5-card Bomb',
    bomb6: '6-card Bomb',
    bomb7: '7-card Bomb',
    bomb8: '8-card Bomb',
    tianwang: 'Joker Bomb',
    detail: '{{tripleRank}} with {{pairRank}}'
  },
  card: { smallJoker: 'Small Joker', bigJoker: 'Big Joker', joker: 'Joker' },
  import: {
    guidanceTitle: 'OCR guidance',
    guidanceOne: 'Upload a screenshot or photo of a 27-card hand',
    guidanceTwo: 'OCR works best with clear, high-contrast images',
    guidanceThree: 'You can correct recognition errors before import',
    status: {
      'loading-engine': 'Loading OCR engine...',
      recognizing: 'Recognizing image...',
      parsing: 'Parsing cards...',
      deduplicating: 'Removing duplicate detections...',
      review: 'Review required.'
    },
    reviewTitle: 'OCR Review',
    originalCount: '{{count}} detected before deduplication, {{deduplicated}} after',
    addNeeded: '; add {{count}} more',
    deleteNeeded: '; remove {{count}}',
    countCorrect: '; count is correct',
    add: 'Add',
    addSmallJoker: '+Small Joker',
    addBigJoker: '+Big Joker',
    confirm: 'Confirm Import ({{count}}/{{total}})',
    cancel: 'Cancel',
    removeCard: 'Remove card'
  },
  panels: {
    recentGames: 'Recent Games',
    stats: 'Statistics',
    suggestions: 'Suggestions',
    gapDistribution: 'Score Gap Distribution',
    groupedNone: 'No groups yet.',
    aiRecommended: 'AI Recommendation',
    aiEmpty: 'Complete your grouping to get an AI recommendation.',
    historyLevel: 'Level {{rank}}',
    optimal: 'Bested AI',
    gap: '{{count}} points behind',
    totalGames: 'Total games: {{count}}',
    hitRate: 'Best-match rate: {{value}}%',
    averageGap: 'Average gap: {{value}}',
    userHandsAvg: 'Average user hands: {{value}}',
    aiHandsAvg: 'Average AI hands: {{value}}',
    userBombAvg: 'Average user bombs: {{value}}',
    aiBombAvg: 'Average AI bombs: {{value}}',
    gapEqual: '=0 points',
    gapClose: '1-2 points',
    gapMedium: '3-5 points',
    gapWide: '6+ points'
  },
  ai: {
    solving: 'Expert is calculating',
    solvingProgress: 'Expert is calculating {{current}}/{{total}}',
    fromPrecompute:
      'Used the background result and found a higher-scoring AI recommendation ({{mode}}, round {{attempts}}); this game was saved.',
    recommendationFallback:
      'Found a higher-scoring AI recommendation ({{mode}}, round {{attempts}}, with fallback calculation); this game was saved.',
    recommendation:
      'Found a higher-scoring AI recommendation ({{mode}}, round {{attempts}}); this game was saved.',
    precomputedOnly:
      'Used the background result ({{mode}}); your grouping may already be near optimal.',
    noBetter:
      'Ran multiple {{mode}} searches but found no higher-scoring solution; your grouping may already be near optimal.',
    modeChanged:
      'AI search mode changed to {{mode}}; the current deal will be recalculated in the background.'
  },
  aiModes: { fast: 'Speed first', balanced: 'Balanced', quality: 'Quality first' },
  godView: {
    running: 'Calculating the full-table analysis, please wait...',
    failed: 'Analysis failed. Start a new deal or click God View again.',
    waiting: 'The table is precomputed after dealing. Click “God View” to inspect all four hands.',
    stale: 'Grouping changed; the current analysis may be stale.',
    refresh: 'Refresh analysis',
    endgame: '⚠ Endgame mode — opponents have four or fewer theoretical hands; every play matters',
    seat: '{{seat}} ({{role}})',
    seatScore: 'Total {{score}}',
    threatScore: 'Threat {{score}}',
    noSuggestion: 'No shape recommendation.',
    overviewOpponentBombs: 'Opponent bombs: {{count}}',
    overviewTeammateBombs: 'Teammate bombs: {{count}}',
    interruption: 'Interruption probability: {{value}}%',
    backup: 'Recapture value: {{value}}%',
    composition: 'Grouping analysis',
    compositionSummary:
      'Hands {{hands}}  Bombs {{bombs}}  Control {{key}}  Lock {{interruption}}%  Recapture {{recapture}}%',
    tribute: 'Tribute analysis',
    bestTribute: 'Best tribute: {{card}} (opponent bomb change {{delta}})',
    worstTribute: 'Worst tribute: {{card}} (opponent bomb change {{delta}})',
    importSeatHand: 'Import Hand ({{count}})',
    balancedExplanation: 'The current grouping is fairly balanced.',
    strongFire: 'Strong firepower ({{count}} bombs)',
    manySingles: 'Many singles ({{count}}); they are easy to control',
    strongOpponent: 'Opponents have strong bombs; protect your position first'
  },
  notices: {
    waitingAi: 'AI is calculating; please wait for the current analysis.',
    newDeal:
      'New deal started at level {{rank}}. AI and God View are precomputing in the background.',
    historyLoadFailed: 'Failed to load history.',
    expertBusy: 'The expert is calculating; please wait.',
    aiBusy: 'AI is calculating; please wait.',
    exportSuccess: 'History exported.',
    exportFailed: 'Export failed.',
    importedHand: '{{source}} succeeded: imported 27 cards at level {{rank}}.',
    imageRecognition: 'Recognizing the hand image, please wait...',
    ocrReview:
      'OCR found {{raw}} detections and {{deduplicated}} cards after deduplication. Review and confirm the import.',
    imageImportFailed: 'Image OCR import failed.',
    importFailed: 'Import failed.',
    cancelOcr: 'Image OCR import cancelled.',
    historyImported: 'History import completed; processed {{count}} records.',
    scoringBusy: 'The expert is calculating; please do not submit again.',
    incomplete: '{{count}} cards remain unassigned. Complete all 27 cards.',
    scoreSaved: 'Scoring completed, but saving history failed.',
    aiFailed: 'AI calculation failed. Please retry.',
    searchBusy: 'AI is calculating; search mode cannot be changed yet.',
    selectCards: 'Select cards to group first.',
    invalidCombo: 'The current selection is not a valid hand shape.',
    groupFailed: 'Grouping failed. Please select again.',
    groupedComplete: 'Grouping is complete and an AI recommendation is available.',
    autoCompleteFailed: 'Auto-complete failed. Finish grouping manually.',
    autoCompleteSummary:
      'Auto-completed: {{triples}} triples, {{pairs}} pairs, and {{singles}} singles. Submitting for an AI recommendation.',
    missingGodViewData: 'This deal does not have all four hands, so God View cannot open.',
    godViewFailed: 'God View analysis failed. Please retry.',
    chooseImage: 'Choose an image file for OCR import.',
    chooseJson: 'Choose a JSON file to import.'
  },
  errors: {
    unsupportedImage: 'This environment does not support image recognition.',
    tesseractLoad: 'The OCR component failed to load. Check your network and retry.',
    tesseractInit: 'The OCR component failed to initialize.',
    invalidJson: 'Import failed: invalid JSON format.',
    missingCards: 'Import failed: no hand-card array was found in the JSON.',
    noValidCards: 'Import failed: no valid cards were parsed.',
    overCapacity: 'Import failed: a card exceeds the two-deck limit.',
    wrongCardCount: 'Import failed: a hand must contain 27 cards; {{count}} were found.',
    noText: 'Recognition failed: no text was extracted from the image.',
    noCardText: 'Recognition failed: no recognizable card text was detected.',
    defaultImport: 'Import failed.'
  },
  statsSuggestions: {
    fewSamples:
      'There are few sample games; complete at least 20 games before drawing preference conclusions.',
    largeGap:
      'Your average gap versus AI is large; practice reducing hand count and preserving high-value bombs.',
    fewerBombs: 'You tend to break bombs to complete shapes; try preserving more bombs.',
    moreHands:
      'Your average hand count is higher than AI; consider Straights and Consecutive Pairs to reduce it.',
    wildcardSingles:
      'You keep Heart Level Wildcards as singles relatively often; try using them in higher-value shapes.',
    stable: 'Your grouping habits are stable; keep improving hand-count control in complex deals.',
    empty: 'No history yet. Start grouping hands to build training data.'
  },
  errorBoundary: {
    title: 'The app encountered an error',
    message: 'Refresh the page and try again. If the problem continues, clear your browser cache.',
    reload: 'Refresh page'
  },
  seats: { E: 'East', S: 'South', W: 'West', N: 'North' }
};

export default en;
