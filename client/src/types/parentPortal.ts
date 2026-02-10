export type PolicyType =
  | "PAYMENT"
  | "ASSUMPTION_OF_RISK"
  | "PHOTO_VIDEO"
  | "MEDICAL_EMERGENCIES";

export interface Policy {
  id: string;
  type: PolicyType;
  title: string;
  summary: string;
  appliesTo: string;
  bodyHtml: string;
  requiresAgreement: boolean;
}

export interface PolicyAgreement {
  policyId: string;
  agreedOn: string;
  agreedBy: string;
}

export interface BillingSummary {
  totalBalance: number;
  lastPaymentAmount: number;
  lastPaymentDate: string | null;
}

export interface BillingActivity {
  id: string;
  date: string;
  type: "PAYMENT" | "TUITION_FEE" | "RECITAL_FEES" | "COSTUME_FEE" | "OTHER";
  description: string;
  amount: number;
  paid: number;
  balanceAfter: number;
}

export type ContactRole = "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER";

export interface Contact {
  id: string;
  role: ContactRole;
  isAuthorizedPickup: boolean;
  fullName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  email: string;
  mobilePhone?: string;
  workPhone?: string;
  homePhone?: string;
}

export interface AgeRange {
  id: string;
  studentName: string;
  ageLabel: string;
}

export interface ClassListing {
  id: string;
  className: string;
  forLabel: string;
  sessionLabel: string;
  scheduleWhen: string;
  where: string;
  withTeacher: string;
  tuition: number;
}
