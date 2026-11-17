import type { Owner, Pet } from './api';

export type ReportType = 'BIO' | 'CBC' | 'OTHER';

export const OTHER_TEST_TYPES = [
  'CANINE FREE T4',
  'Canine Progesterone',
  'TROPONIN-I',
  'CANINE TSH',
  'CANINE TT4',
] as const;

export type OtherTestType = (typeof OTHER_TEST_TYPES)[number];

export type OtherTestDefinition = {
  name: OtherTestType;
  section: string;
  testName: string;
  unit: string;
  referenceRange: string;
  interpretation: string;
};

export const OTHER_TEST_DEFINITIONS: Record<OtherTestType, OtherTestDefinition> = {
  'CANINE FREE T4': {
    name: 'CANINE FREE T4',
    section: 'CANINE FREE T4',
    testName: 'FREE T4',
    unit: 'ng/dL',
    referenceRange: '0.6-2.6',
    interpretation: `Interpretation:

Low Free T4: Hypothyroidism

High Free T4: Hyperthyroidism`,
  },
  'Canine Progesterone': {
    name: 'Canine Progesterone',
    section: 'Canine Progesterone',
    testName: 'Canine Progesterone',
    unit: 'ng/ml',
    referenceRange: '1-20',
    interpretation: `Report remark:

Canine progesterone concentration should be interpreted with clinical findings and serial progesterone measurements for accurate assessment of estrous stage, ovulation, and breeding timing.

***Interpretation***
< 1 ng/mL      Basal / early proestrus
1–2 ng/mL      Rising; approaching LH surge
2–4 ng/mL      Around LH surge
4–10 ng/mL     Ovulation period
10–20 ng/mL    Post-ovulation / fertile period
> 20 ng/mL     Luteal phase / pregnancy may be present`,
  },
  'TROPONIN-I': {
    name: 'TROPONIN-I',
    section: 'TROPONIN-I',
    testName: 'Troponin-I',
    unit: 'ng/ml',
    referenceRange: '< 0.10',
    interpretation: `Troponin is a complex that regulates the contraction of striated muscle. It consists of 3 subunits (C, T, and I) that are located periodically along the thin filament of the myofibrils.
Troponin I inhibits actomyosin ATPase. Troponin I is an inhibitory protein and exhibits in 3 isoforms: cardiac muscle, slow-twitch skeletal muscle, and fast-twitch skeletal muscle. The cardiac form of troponin I has 31 amino acid residues on its N-terminal, not present in the skeletal forms, which allow for specific polyclonal and monoclonal antibody development. The cardiac specificity of this isoform improves the accuracy of diagnosis in patients with acute or chronic skeletal muscle injury and possible concomitant myocardial injury.
Troponin I is the only troponin isotope present in the myocardium and is not expressed during any developmental stage in skeletal muscle. Troponin I is released into the bloodstream within hours of the onset of symptoms of myocardial infarction or ischemic damage. It can be detected at 3 to 6 hours following onset of chest pain with peak concentrations at 12 to 16 hours, and remains elevated for 5 to 9 days.`,
  },
  'CANINE TSH': {
    name: 'CANINE TSH',
    section: 'CANINE TSH',
    testName: 'CANINE TSH',
    unit: 'ng/ml',
    referenceRange: '0 -0.41',
    interpretation: `Interpretation :
Increased canine TSH may support primary hypothyroidism when associated with low TT4/FT4. Interpret with clinical findings and thyroid hormone results.`,
  },
  'CANINE TT4': {
    name: 'CANINE TT4',
    section: 'CANINE TT4',
    testName: 'CANINE T4',
    unit: 'µg/dL',
    referenceRange: '1.0-4.0',
    interpretation: `Interpretation:

Low Total T4: Hypothyroidism

High Total T4: Hyperthyroidism`,
  },
};

export type ReportAnalyte = {
  section: string;
  name: string;
  result: string;
  unit: string;
  referenceRange: string;
  remarks: string;
  confidence?: number;
  needsReview?: boolean;
};

export type OcrExtractResult = {
  rows: ReportAnalyte[];
  warnings: string[];
  rawText: string;
};

export type PatientDetails = {
  sampleNo: string;
  date: string;
  ageGender: string;
  registeredOn: string;
  sampleType: string;
  referredBy: string;
  doctorName: string;
  doctorPosition: string;
  uhid: string;
};

export type ReportDraft = {
  reportType: ReportType;
  otherTestType?: string;
  interpretation?: string;
  title: string;
  owner: Owner;
  pet: Pet;
  patientDetails: PatientDetails;
  analytes: ReportAnalyte[];
  logoDataUrl?: string;
};

export type SavedReport = {
  id: string;
  reportType: ReportType;
  otherTestType?: string;
  interpretation?: string;
  title: string;
  ownerId: string;
  petId: string;
  petSnapshot: Pet;
  ownerSnapshot: Owner;
  patientDetails: PatientDetails;
  analytes: ReportAnalyte[];
  sourceImageName: string;
  ocrText: string;
  logoData: string;
  pdfData: string;
  createdAt: string;
};
