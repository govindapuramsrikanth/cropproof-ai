export type Language = 'en' | 'te'

export interface AppLabels {
  appTitle: string
  subtitle: string
  disclaimerBanner: string
  heroEyebrow: string
  demoCase: string
  demoLoading: string
  liveClock: string
  unconfirmedDraftTitle: string
  unconfirmedDraftMessage: string
  telemetry: {
    title: string
    description: string
    capture: string
    capturing: string
    gpsCoordinates: string
    accuracy: string
    rainfall72h: string
    observedAt: string
    currentWeather: string
    countdown: string
    countdownEstimate: string
    countdownElapsed: string
    locationConsent: string
    districtFallback: string
    unavailable: string
  }
  visual: {
    chooseCrop: string
    chooseCalamity: string
    selected: string
    tapToSelect: string
    paddy: string
    cotton: string
    maize: string
    chili: string
    flood: string
    hailstorm: string
    unseasonalRain: string
    postHarvestRain: string
  }
  samplePhoto: string
  samplePhotoLoading: string
  samplePhotoDisclaimer: string
  steps: {
    voiceTextIntake: string
    confirmDetails: string
    policyFarmerStories: string
    evidenceUpload: string
    readinessPdf: string
  }
  fields: {
    crop: string
    calamity: string
    incidentDate: string
    district: string
    village: string
    affectedArea: string
    insuranceStatus: string
  }
  actions: {
    startSpeaking: string
    stop: string
    readAloud: string
    confirmDetails: string
    downloadPdf: string
  }
}

export const labels: Record<Language, AppLabels> = {
  en: {
    appTitle: 'CropProof AI',
    subtitle: 'Voice-Guided Crop-Loss Documentation & Claim Readiness',
    disclaimerBanner:
      'Independent Claim Preparation Tool — Not a Government or Insurer Portal',
    heroEyebrow: 'TELANGANA FARMER COMMAND CENTER',
    demoCase: 'Load 1-Click Demo Case',
    demoLoading: 'Loading demo case…',
    liveClock: 'TELANGANA LOCAL TIME',
    unconfirmedDraftTitle: 'Unconfirmed Draft',
    unconfirmedDraftMessage:
      'Please verify every detail below before policy rules run.',
    telemetry: {
      title: 'True Live Proof',
      description: 'Device geolocation and live Open-Meteo rainfall telemetry',
      capture: 'Capture Live GPS & Weather',
      capturing: 'Capturing live proof…',
      gpsCoordinates: 'GPS coordinates',
      accuracy: 'GPS accuracy',
      rainfall72h: 'Live rainfall · past 72 hours',
      observedAt: 'Weather observed at',
      currentWeather: 'Current conditions',
      countdown: '72-hour reporting countdown',
      countdownEstimate: 'Date-based estimate; exact incident time is not recorded.',
      countdownElapsed: 'Estimated window elapsed; contact your insurer or reporting channel.',
      locationConsent:
        'When you capture live proof, the coordinates are sent to Open-Meteo to retrieve weather data.',
      districtFallback: 'Device location unavailable; using a Telangana district estimate.',
      unavailable: 'Not available',
    },
    visual: {
      chooseCrop: 'Tap to choose your crop',
      chooseCalamity: 'Tap to choose what happened',
      selected: 'Selected',
      tapToSelect: 'Tap to select',
      paddy: 'Paddy',
      cotton: 'Cotton',
      maize: 'Maize',
      chili: 'Chili',
      flood: 'Flood / Inundation',
      hailstorm: 'Hailstorm',
      unseasonalRain: 'Unseasonal / Heavy Rain',
      postHarvestRain: 'Post-harvest Rain',
    },
    samplePhoto: 'Use Sample Field Photo',
    samplePhotoLoading: 'Preparing sample…',
    samplePhotoDisclaimer: 'Illustrative sample only — not a photograph of this field.',
    steps: {
      voiceTextIntake: 'Voice/Text Intake',
      confirmDetails: 'Confirm Details',
      policyFarmerStories: 'Policy & Farmer Stories',
      evidenceUpload: 'Evidence Upload',
      readinessPdf: 'Readiness PDF',
    },
    fields: {
      crop: 'Crop',
      calamity: 'Calamity',
      incidentDate: 'Incident Date',
      district: 'District',
      village: 'Village',
      affectedArea: 'Affected Area (Acres)',
      insuranceStatus: 'Insurance Status',
    },
    actions: {
      startSpeaking: 'Start Speaking',
      stop: 'Stop',
      readAloud: 'Read Aloud',
      confirmDetails: 'Confirm Details',
      downloadPdf: 'Download PDF',
    },
  },
  te: {
    appTitle: 'CropProof AI',
    subtitle: 'వాయిస్ మార్గదర్శకంతో పంట నష్టం వివరాలు & క్లెయిమ్ సిద్ధత',
    disclaimerBanner:
      'స్వతంత్ర క్లెయిమ్ సిద్ధం సాధనం — ఇది ప్రభుత్వ లేదా బీమా సంస్థ పోర్టల్ కాదు',
    heroEyebrow: 'తెలంగాణ రైతు కమాండ్ సెంటర్',
    demoCase: 'ఒక్క క్లిక్ డెమో కేసు',
    demoLoading: 'డెమో కేసును లోడ్ చేస్తోంది…',
    liveClock: 'తెలంగాణ స్థానిక సమయం',
    unconfirmedDraftTitle: 'నిర్ధారించని ముసాయిదా',
    unconfirmedDraftMessage:
      'పాలసీ నియమాలు అమలులోకి రావడానికి ముందు, దయచేసి ప్రతి వివరాన్ని పరిశీలించండి.',
    telemetry: {
      title: 'నిజమైన ప్రత్యక్ష ఆధారం',
      description: 'పరికర స్థానం మరియు Open-Meteo ప్రత్యక్ష వర్షపాతం సమాచారం',
      capture: 'ప్రత్యక్ష GPS & వాతావరణాన్ని పొందండి',
      capturing: 'ప్రత్యక్ష ఆధారం పొందుతోంది…',
      gpsCoordinates: 'GPS అక్షాంశాలు',
      accuracy: 'GPS ఖచ్చితత్వం',
      rainfall72h: 'గత 72 గంటల వర్షపాతం',
      observedAt: 'వాతావరణ పరిశీలన సమయం',
      currentWeather: 'ప్రస్తుత వాతావరణం',
      countdown: '72 గంటల నివేదన కౌంట్‌డౌన్',
      countdownEstimate: 'తేదీ ఆధారిత అంచనా; ఖచ్చితమైన సంఘటన సమయం నమోదు కాలేదు.',
      countdownElapsed: 'అంచనా గడువు ముగిసింది; మీ బీమా సంస్థ లేదా నివేదన మార్గాన్ని సంప్రదించండి.',
      locationConsent:
        'ప్రత్యక్ష ఆధారం పొందినప్పుడు, వాతావరణ సమాచారం కోసం మీ స్థాన వివరాలు Open-Meteoకు పంపబడతాయి.',
      districtFallback: 'పరికర స్థానం అందుబాటులో లేదు; తెలంగాణ జిల్లా అంచనాను ఉపయోగిస్తున్నాం.',
      unavailable: 'అందుబాటులో లేదు',
    },
    visual: {
      chooseCrop: 'మీ పంటను ఎంచుకోవడానికి నొక్కండి',
      chooseCalamity: 'ఏమి జరిగిందో ఎంచుకోవడానికి నొక్కండి',
      selected: 'ఎంచుకున్నారు',
      tapToSelect: 'ఎంచుకోవడానికి నొక్కండి',
      paddy: 'వరి',
      cotton: 'పత్తి',
      maize: 'మొక్కజొన్న',
      chili: 'మిరప',
      flood: 'వరద / ముంపు',
      hailstorm: 'వడగళ్ల వర్షం',
      unseasonalRain: 'అకాల / భారీ వర్షం',
      postHarvestRain: 'కోత తర్వాత వర్షం',
    },
    samplePhoto: 'నమూనా పొలం ఫోటోను ఉపయోగించండి',
    samplePhotoLoading: 'నమూనా సిద్ధం చేస్తోంది…',
    samplePhotoDisclaimer: 'ఇది ఉదాహరణ మాత్రమే — ఈ పొలం నిజమైన ఫోటో కాదు.',
    steps: {
      voiceTextIntake: 'వాయిస్/టెక్స్ట్ ద్వారా వివరాలు',
      confirmDetails: 'వివరాలను నిర్ధారించండి',
      policyFarmerStories: 'పాలసీ & రైతుల కథలు',
      evidenceUpload: 'ఆధారాలను అప్‌లోడ్ చేయండి',
      readinessPdf: 'సిద్ధత PDF',
    },
    fields: {
      crop: 'పంట',
      calamity: 'విపత్తు',
      incidentDate: 'సంఘటన తేదీ',
      district: 'జిల్లా',
      village: 'గ్రామం',
      affectedArea: 'నష్టపోయిన విస్తీర్ణం',
      insuranceStatus: 'బీమా స్థితి',
    },
    actions: {
      startSpeaking: 'మాట్లాడండి',
      stop: 'ఆపండి',
      readAloud: 'వినిపించండి',
      confirmDetails: 'వివరాలు నిర్ధారించండి',
      downloadPdf: 'PDF డౌన్‌లోడ్ చేయండి',
    },
  },
}
