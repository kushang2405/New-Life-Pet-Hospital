import type { Owner, Pet } from './api';

export type ReportType = 'BIO' | 'CBC';

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
