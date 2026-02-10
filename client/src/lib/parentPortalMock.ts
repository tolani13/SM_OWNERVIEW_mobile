import type {
  AgeRange,
  BillingActivity,
  BillingSummary,
  ClassListing,
  Contact,
  Policy,
  PolicyAgreement,
} from "@/types/parentPortal";

export const parentPolicies: Policy[] = [
  {
    id: "pol-payment",
    type: "PAYMENT",
    title: "Payment Policy",
    summary: "Tuition due dates, late fee handling, and autopay guidance.",
    appliesTo: "All enrolled students",
    requiresAgreement: true,
    bodyHtml:
      "<h3>Payment Policy</h3><p>Monthly tuition is due on the 1st of each month. A grace period through the 5th applies before late fees are assessed.</p><p>Payments can be made by card, ACH, or cash at front desk. Returned payments may incur additional fees.</p><p>This is placeholder text and should be replaced with finalized policy language.</p>",
  },
  {
    id: "pol-risk",
    type: "ASSUMPTION_OF_RISK",
    title: "Assumption of Risk",
    summary: "Participation includes normal physical activity risks in dance training.",
    appliesTo: "All classes, rehearsals, performances",
    requiresAgreement: true,
    bodyHtml:
      "<h3>Assumption of Risk</h3><p>Dance involves movement and physical exertion. Participants acknowledge normal risks of instruction and rehearsal.</p><p>Families are expected to disclose relevant medical conditions and follow instructor safety direction.</p><p>This is placeholder text and should be reviewed by legal counsel.</p>",
  },
  {
    id: "pol-photo",
    type: "PHOTO_VIDEO",
    title: "Photo / Video Release",
    summary: "Authorizes studio media usage for recital, social, and marketing.",
    appliesTo: "Events, classes, performances",
    requiresAgreement: true,
    bodyHtml:
      "<h3>Photo & Video Release</h3><p>Studio Maestro may capture photos/video for recital archives and marketing content.</p><p>Families can request limited usage restrictions through studio administration.</p><p>This is placeholder text pending final release form language.</p>",
  },
  {
    id: "pol-medical",
    type: "MEDICAL_EMERGENCIES",
    title: "Medical Emergencies",
    summary: "Emergency contact authorization and first-aid escalation process.",
    appliesTo: "On-site classes and events",
    requiresAgreement: true,
    bodyHtml:
      "<h3>Medical Emergency Policy</h3><p>In urgent situations, staff may contact emergency services and listed guardians immediately.</p><p>Parents/guardians are responsible for current contact and medical alert details.</p><p>This is placeholder text and should be replaced with your approved policy.</p>",
  },
];

export const parentPolicyAgreements: PolicyAgreement[] = [
  {
    policyId: "pol-payment",
    agreedOn: new Date().toISOString(),
    agreedBy: "Tina Monroe",
  },
  {
    policyId: "pol-risk",
    agreedOn: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    agreedBy: "Tina Monroe",
  },
];

export const parentBillingSummary: BillingSummary = {
  totalBalance: 145.0,
  lastPaymentAmount: 220.0,
  lastPaymentDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
};

export const parentBillingActivity: BillingActivity[] = [
  {
    id: "ba-1",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    type: "TUITION_FEE",
    description: "February Tuition",
    amount: 220,
    paid: 220,
    balanceAfter: 0,
  },
  {
    id: "ba-2",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    type: "COSTUME_FEE",
    description: "Neon Pulse Costume",
    amount: 95,
    paid: 0,
    balanceAfter: 95,
  },
  {
    id: "ba-3",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 16).toISOString(),
    type: "RECITAL_FEES",
    description: "Recital Package",
    amount: 50,
    paid: 0,
    balanceAfter: 145,
  },
  {
    id: "ba-4",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    type: "PAYMENT",
    description: "Card Payment",
    amount: -220,
    paid: 220,
    balanceAfter: 145,
  },
];

export const parentContacts: Contact[] = [
  {
    id: "ct-1",
    role: "MOTHER",
    isAuthorizedPickup: true,
    fullName: "Tina Monroe",
    addressLine1: "1224 Pine Ridge Dr",
    city: "Charlotte",
    state: "NC",
    postalCode: "28270",
    email: "tina.monroe@example.com",
    mobilePhone: "555-2101",
    workPhone: "555-2201",
  },
  {
    id: "ct-2",
    role: "FATHER",
    isAuthorizedPickup: true,
    fullName: "Andrew Monroe",
    addressLine1: "1224 Pine Ridge Dr",
    city: "Charlotte",
    state: "NC",
    postalCode: "28270",
    email: "andrew.monroe@example.com",
    mobilePhone: "555-2109",
  },
  {
    id: "ct-3",
    role: "GUARDIAN",
    isAuthorizedPickup: false,
    fullName: "Nia Harper",
    addressLine1: "44 Oak View Lane",
    city: "Matthews",
    state: "NC",
    postalCode: "28105",
    email: "nia.harper@example.com",
    homePhone: "555-8821",
  },
];

export const parentAgeRanges: AgeRange[] = [
  { id: "ar-1", studentName: "Aria Monroe", ageLabel: "10 yrs" },
  { id: "ar-2", studentName: "Zoey Patel", ageLabel: "11 yrs" },
];

export const parentClassListings: ClassListing[] = [
  {
    id: "cl-1",
    className: "Jazz Tech",
    forLabel: "Ages 9–12",
    sessionLabel: "2025–26 Season",
    scheduleWhen: "Mon 5:30–6:15 PM",
    where: "Studio A",
    withTeacher: "Jade Cole",
    tuition: 125,
  },
  {
    id: "cl-2",
    className: "Ballet Foundations",
    forLabel: "Ages 8–11",
    sessionLabel: "2025–26 Season",
    scheduleWhen: "Wed 4:45–5:30 PM",
    where: "Studio B",
    withTeacher: "Miles Turner",
    tuition: 115,
  },
  {
    id: "cl-3",
    className: "Hip Hop Crew",
    forLabel: "Ages 10–13",
    sessionLabel: "2025–26 Season",
    scheduleWhen: "Thu 6:00–6:45 PM",
    where: "Studio C",
    withTeacher: "Miles Turner",
    tuition: 130,
  },
];
