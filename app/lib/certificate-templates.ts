export const CERTIFICATE_TYPES = ['Microchip', 'Spaying', 'Castration', 'Health'] as const;

export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export type LetterheadSettings = {
  logoDataUrl: string;
  clinicName: string;
  address: string;
  email: string;
  phone: string;
  doctorName: string;
  doctorPosition: string;
};

export type CertificateDetails = {
  certificateType: CertificateType;
  certificateDate: string;
  certificateNo: string;
  ownerName: string;
  ownerPhone: string;
  ownerAddress: string;
  petName: string;
  petBreed: string;
  petSpecies: string;
  petSex: string;
  chipNumber: string;
};

export type SavedCertificate = CertificateDetails & {
  id: string;
  ownerId: string;
  petId: string;
  includeHeader: boolean;
  pdfData: string;
  createdAt: string;
};

export type CertificateSummary = Omit<SavedCertificate, 'pdfData'>;

export type CertificateContent = {
  title: string;
  layout: 'paragraph' | 'details';
  paragraph?: string;
  statement?: string;
  checkboxes: string[];
  closing: string[];
};

export const DEFAULT_LETTERHEAD: LetterheadSettings = {
  logoDataUrl: '',
  clinicName: 'New Life Pet Hospital',
  address: 'Opp. Amisha hotel, Between Delhigate & Lal Darwaja, Una Pani Road, Near Railway Station, Surat, Gujarat',
  email: 'newlifepethospital@gmail.com',
  phone: '9586852475',
  doctorName: 'Dr. Arshi K. Vala',
  doctorPosition: 'M.V.Sc (Vet.) (Surgery and Radiology)',
};

export function buildCertificateContent(details: CertificateDetails, doctorName: string): CertificateContent {
  const { certificateType: type, ownerName, ownerPhone, ownerAddress, petName, petBreed, petSpecies, petSex, certificateDate, chipNumber } = details;
  const statement = `I ${doctorName}, DO HEREBY CERTIFY THAT ON THE DATE MENTIONED ABOVE THAT,`;

  if (type === 'Microchip') {
    return {
      title: 'Microchip Certificate',
      layout: 'paragraph',
      paragraph: `THIS CERTIFICATE IS ALLOTED TO ${ownerName.toUpperCase()} HAVING CONTACT NUMBER ${ownerPhone} AND HAVING A RESIDENCE AT ${ownerAddress.toUpperCase()} WHO OWNS A PET NAMED AS ${petName.toUpperCase()} AND IS OF BREED ${petBreed.toUpperCase()}, SPECIES ${petSpecies.toUpperCase()}, SEX ${petSex.toUpperCase()}.`,
      statement,
      checkboxes: [
        'I HAVE PLACED THE MICRO-CHIP IN THE ABOVE MENTIONED ANIMAL AND / OR',
        `I HAVE SCANNED THE MICROCHIP IN THE ABOVE MENTIONED ANIMAL ON ${certificateDate} AND IT HAS READ AS PET IDENTIFICATION CHIP NUMBER AS ${chipNumber.toUpperCase()}.`,
      ],
      closing: [],
    };
  }

  if (type === 'Spaying') {
    return {
      title: 'Spaying Certificate',
      layout: 'details',
      statement,
      checkboxes: [
        'BOTH OVARIES, ASSOCIATED STRUCTURE AND UTERUS HAVE BEEN REMOVED FROM THE ABOVE DEFINED ANIMAL, AND / OR',
        'I HAVE DONE AN EXTERNAL EXAMINATION OF THE ABOVE DEFINED ANIMAL AND I HEREBY DO CERTIFY WITH THE BEST OF MY KNOWLEDGE THAT SHE HAS BEEN PROPERLY NEUTERED AND IS NO LONGER ENTIRE.',
      ],
      closing: [],
    };
  }

  if (type === 'Castration') {
    return {
      title: 'Castration Certificate',
      layout: 'details',
      statement,
      checkboxes: [
        'BOTH TESTICLES, ASSOCIATED STRUCTURE AND A LENGTH OF ADJOINING SPERMATIC CORD HAVE BEEN REMOVED FROM THE ABOVE DEFINED ANIMAL, AND / OR',
        'I HAVE DONE AN EXTERNAL EXAMINATION OF THE ABOVE DEFINED ANIMAL AND I HEREBY DO CERTIFY WITH THE BEST OF MY KNOWLEDGE THAT HE HAS BEEN PROPERLY CASTRATED AND IS NO LONGER ENTIRE.',
      ],
      closing: [],
    };
  }

  return {
    title: 'Health Certificate',
    layout: 'details',
    checkboxes: [],
    closing: [
      'THIS IS TO CERTIFY THAT THE ABOVE MENTIONED PET HAS BEEN EXAMINED AT MY CLINIC AND FOUND TO BE FIT AND HEALTHY. HE / SHE DOES NOT SHOW ANY EVIDENCE OF COMMUNICABLE DISEASE OR ANY INFECTION DURING MY EXAMINATION. HE / SHE IS FREE FROM CARDIOPULMONARY DISEASE CONDITION AND IS FIT TO TRAVEL BY ROAD OR ANY OTHER MEANS OF TRAVEL.',
      'HE / SHE IS DULY VACCINATED BY ANTI-RABIES AND VARIOUS OTHER DISEASES AND IS ALSO DEWORMED FROM TIME TO TIME.',
    ],
  };
}
