// @ts-nocheck
import { storage } from "./storage";
import type { InsertDancer, InsertTeacher, InsertRoutine, InsertCompetition, InsertRunSlot, InsertConventionClass, InsertAnnouncement } from "@server/schema";

async function seed() {
  console.log("Starting database seed...");

  // Seed Dancers
  const dancersData: InsertDancer[] = [
    { firstName: "Emma", lastName: "Johnson", age: 15, level: "Teen", status: "Active", parentName: "Sarah Johnson", parentPhone: "555-0101", parentEmail: "sarah.j@email.com" },
    { firstName: "Olivia", lastName: "Smith", age: 12, level: "Junior", status: "Active", parentName: "Mike Smith", parentPhone: "555-0102", parentEmail: "mike.s@email.com" },
    { firstName: "Ava", lastName: "Williams", age: 8, level: "Mini", status: "Active", parentName: "Lisa Williams", parentPhone: "555-0103", parentEmail: "lisa.w@email.com" },
    { firstName: "Sophia", lastName: "Brown", age: 17, level: "Senior", status: "Active", parentName: "David Brown", parentPhone: "555-0104", parentEmail: "david.b@email.com" },
    { firstName: "Isabella", lastName: "Davis", age: 14, level: "Teen", status: "Active", parentName: "Jennifer Davis", parentPhone: "555-0105", parentEmail: "jennifer.d@email.com" },
    { firstName: "Mia", lastName: "Garcia", age: 10, level: "Junior", status: "Active", parentName: "Carlos Garcia", parentPhone: "555-0106", parentEmail: "carlos.g@email.com" },
    { firstName: "Charlotte", lastName: "Martinez", age: 16, level: "Teen", status: "Active", parentName: "Maria Martinez", parentPhone: "555-0107", parentEmail: "maria.m@email.com" },
    { firstName: "Amelia", lastName: "Anderson", age: 13, level: "Teen", status: "Active", parentName: "Robert Anderson", parentPhone: "555-0108", parentEmail: "robert.a@email.com" },
  ];

  const dancers = [];
  for (const dancerData of dancersData) {
    const dancer = await storage.createDancer(dancerData);
    dancers.push(dancer);
    console.log(`Created dancer: ${dancer.firstName} ${dancer.lastName}`);
  }

  // Seed Teachers
  const teachersData: InsertTeacher[] = [
    { name: "Ms. Rachel", role: "Director", classes: ["Contemporary", "Jazz", "Lyrical"], isAvailableForSolo: true },
    { name: "Mr. Derek", role: "Hip Hop Instructor", classes: ["Hip Hop", "Breaking"], isAvailableForSolo: true },
    { name: "Ms. Julia", role: "Ballet Instructor", classes: ["Ballet", "Pointe"], isAvailableForSolo: true },
    { name: "Ms. Amanda", role: "Tap Instructor", classes: ["Tap"], isAvailableForSolo: false },
  ];

  const teachers = [];
  for (const teacherData of teachersData) {
    const teacher = await storage.createTeacher(teacherData);
    teachers.push(teacher);
    console.log(`Created teacher: ${teacher.name}`);
  }

  // Seed Routines
  const routinesData: InsertRoutine[] = [
    { 
      name: "Wings", 
      style: "Contemporary", 
      type: "Small Group", 
      dancerIds: [dancers[0].id, dancers[1].id, dancers[4].id, dancers[5].id],
      paidDancerIds: [dancers[0].id, dancers[1].id],
      costumeFee: "125.00",
      costumeName: "White flowing dress"
    },
    { 
      name: "Rhythm Nation", 
      style: "Hip Hop", 
      type: "Large Group", 
      dancerIds: [dancers[0].id, dancers[1].id, dancers[2].id, dancers[3].id, dancers[4].id, dancers[5].id, dancers[6].id],
      paidDancerIds: [dancers[0].id, dancers[2].id, dancers[4].id],
      costumeFee: "95.00",
      costumeName: "Black and white streetwear"
    },
    { 
      name: "Breathe Me", 
      style: "Lyrical", 
      type: "Solo", 
      dancerIds: [dancers[3].id],
      paidDancerIds: [dancers[3].id],
      costumeFee: "150.00",
      costumeName: "Blue flowing gown"
    },
    { 
      name: "Signed Sealed Delivered", 
      style: "Jazz", 
      type: "Trio", 
      dancerIds: [dancers[1].id, dancers[4].id, dancers[7].id],
      paidDancerIds: [dancers[1].id],
      costumeFee: "110.00",
      costumeName: "Purple sequin dress"
    },
  ];

  const routines = [];
  for (const routineData of routinesData) {
    const routine = await storage.createRoutine(routineData);
    routines.push(routine);
    console.log(`Created routine: ${routine.name}`);
  }

  // Seed Competitions
  const competitionsData: InsertCompetition[] = [
    { 
      name: "Velocity Dance Convention - Palm Springs", 
      location: "Palm Springs, CA", 
      startDate: "2025-02-14", 
      endDate: "2025-02-16",
      status: "Upcoming"
    },
    { 
      name: "Nuvo Dance Convention - Las Vegas", 
      location: "Las Vegas, NV", 
      startDate: "2025-03-07", 
      endDate: "2025-03-09",
      status: "Upcoming"
    },
    { 
      name: "JUMP Dance Convention - Phoenix", 
      location: "Phoenix, AZ", 
      startDate: "2025-04-11", 
      endDate: "2025-04-13",
      status: "Upcoming"
    },
  ];

  const competitions = [];
  for (const compData of competitionsData) {
    const comp = await storage.createCompetition(compData);
    competitions.push(comp);
    console.log(`Created competition: ${comp.name}`);
  }

  // Seed Run Slots for Velocity Palm Springs
  const velocityId = competitions[0].id;
  const runSlotsData: InsertRunSlot[] = [
    {
      competitionId: velocityId,
      routineId: routines[0].id,
      day: "Friday",
      time: "2:15 PM",
      stage: "Main Stage",
      orderNumber: 45,
      category: "Teen Small Group",
      isStudioRoutine: true,
      studio: "Studio Maestro",
      notes: ""
    },
    {
      competitionId: velocityId,
      routineId: null,
      day: "Friday",
      time: "2:30 PM",
      stage: "Main Stage",
      orderNumber: 46,
      category: "Teen Small Group",
      isStudioRoutine: false,
      studio: "Dance Dynamics",
      notes: ""
    },
    {
      competitionId: velocityId,
      routineId: routines[1].id,
      day: "Saturday",
      time: "10:00 AM",
      stage: "Main Stage",
      orderNumber: 12,
      category: "Teen Large Group",
      isStudioRoutine: true,
      studio: "Studio Maestro",
      notes: ""
    },
    {
      competitionId: velocityId,
      routineId: routines[2].id,
      day: "Saturday",
      time: "3:45 PM",
      stage: "Side Stage",
      orderNumber: 78,
      category: "Senior Solo",
      isStudioRoutine: true,
      studio: "Studio Maestro",
      notes: "",
      placement: "1st Overall",
      specialAward: "Judges Choice"
    },
    {
      competitionId: velocityId,
      routineId: null,
      day: "Saturday",
      time: "4:00 PM",
      stage: "Side Stage",
      orderNumber: 79,
      category: "Senior Solo",
      isStudioRoutine: false,
      studio: "Elite Dance Academy",
      notes: ""
    },
  ];

  for (const slotData of runSlotsData) {
    const slot = await storage.createRunSlot(slotData);
    console.log(`Created run slot: ${slot.day} ${slot.time} - ${slot.category}`);
  }

  // Seed Convention Classes for Velocity
  const conventionClassesData: InsertConventionClass[] = [
    {
      competitionId: velocityId,
      day: "Friday",
      time: "9:00 AM",
      name: "Contemporary Fusion",
      teacher: "Travis Wall",
      room: "Ballroom A",
      level: "Teen/Senior"
    },
    {
      competitionId: velocityId,
      day: "Friday",
      time: "11:00 AM",
      name: "Hip Hop Grooves",
      teacher: "Willdabeast Adams",
      room: "Ballroom B",
      level: "All Levels"
    },
    {
      competitionId: velocityId,
      day: "Saturday",
      time: "9:00 AM",
      name: "Jazz Technique",
      teacher: "Mandy Moore",
      room: "Ballroom A",
      level: "Junior/Teen"
    },
  ];

  for (const classData of conventionClassesData) {
    const convClass = await storage.createConventionClass(classData);
    console.log(`Created convention class: ${convClass.name} with ${convClass.teacher}`);
  }

  // Seed Announcements
  const announcementsData: InsertAnnouncement[] = [
    {
      title: "Velocity Palm Springs Registration Deadline",
      content: "All competition fees and routine registrations for Velocity Dance Convention in Palm Springs must be submitted by January 31st. Please ensure all costume fees are paid by this date as well.",
      date: new Date("2025-01-15T10:00:00"),
      tags: ["Competition", "Studio"],
      isPinned: true
    },
    {
      title: "Studio Closed - Presidents Day Weekend",
      content: "The studio will be closed February 15-17 for Presidents Day weekend. Regular classes resume Monday, February 18th.",
      date: new Date("2025-01-20T14:30:00"),
      tags: ["Studio"],
      isPinned: true
    },
    {
      title: "New Hip Hop Class Starting!",
      content: "Mr. Derek is launching a new advanced hip hop class for Teen/Senior dancers starting March 1st. Tuesdays 6:30-8:00 PM. Limited spots available - sign up at the front desk!",
      date: new Date("2025-02-01T09:00:00"),
      tags: ["Studio", "Teen"],
      isPinned: false
    },
  ];

  for (const announcementData of announcementsData) {
    const announcement = await storage.createAnnouncement(announcementData);
    console.log(`Created announcement: ${announcement.title}`);
  }

  console.log("Database seed completed successfully!");
}

seed().catch(console.error);
