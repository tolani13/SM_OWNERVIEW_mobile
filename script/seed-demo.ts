import "dotenv/config";
import { storage } from "../server/storage";

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedDemo() {
  console.log("🌱 Seeding demo data...");
  const now = new Date();
  const currentSeasonYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();

  // ---------- DANCERS ----------
  const existingDancers = await storage.getDancers();
  const dancerSeeds = [
    { firstName: "Aria", lastName: "Monroe", status: "Active", parentName: "Tina Monroe", parentEmail: "tina.monroe@example.com", parentPhone: "555-2101" },
    { firstName: "Zoey", lastName: "Patel", status: "Active", parentName: "Raj Patel", parentEmail: "raj.patel@example.com", parentPhone: "555-2102" },
    { firstName: "Lila", lastName: "Nguyen", status: "Active", parentName: "Linh Nguyen", parentEmail: "linh.nguyen@example.com", parentPhone: "555-2103" },
    { firstName: "Maya", lastName: "Brooks", status: "Active", parentName: "Chris Brooks", parentEmail: "chris.brooks@example.com", parentPhone: "555-2104" },
    { firstName: "Noah", lastName: "Rivera", status: "Active", parentName: "Elena Rivera", parentEmail: "elena.rivera@example.com", parentPhone: "555-2105" },
  ];

  const seededDancers: Array<{ id: string; firstName: string; lastName: string }> = [];
  for (const dancer of dancerSeeds) {
    const found = existingDancers.find(
      (d) => d.firstName === dancer.firstName && d.lastName === dancer.lastName,
    );
    if (found) {
      seededDancers.push(found);
      continue;
    }
    const created = await storage.createDancer(dancer as any);
    seededDancers.push(created);
    console.log(`  ✓ dancer: ${created.firstName} ${created.lastName}`);
  }

  // ---------- TEACHERS ----------
  const existingTeachers = await storage.getTeachers();
  const teacherSeeds = [
    {
      firstName: "Jade",
      lastName: "Cole",
      name: "Jade Cole",
      role: "Jazz / Contemporary",
      specialty: "Jazz, Contemporary",
      email: "jade.cole@demo.studio",
      phone: "555-3101",
      classes: ["Jazz", "Contemporary"],
      isAvailableForSolo: true,
      active: true,
    },
    {
      firstName: "Miles",
      lastName: "Turner",
      name: "Miles Turner",
      role: "Hip Hop",
      specialty: "Hip Hop",
      email: "miles.turner@demo.studio",
      phone: "555-3102",
      classes: ["Hip Hop"],
      isAvailableForSolo: true,
      active: true,
    },
  ];

  const seededTeachers: Array<{ id: string; firstName: string; lastName: string }> = [];
  for (const teacher of teacherSeeds) {
    const found = existingTeachers.find(
      (t) => t.firstName === teacher.firstName && t.lastName === teacher.lastName,
    );
    if (found) {
      seededTeachers.push(found);
      continue;
    }
    const created = await storage.createTeacher(teacher as any);
    seededTeachers.push(created);
    console.log(`  ✓ teacher: ${created.firstName} ${created.lastName}`);
  }

  // ---------- ROUTINES ----------
  const existingRoutines = await storage.getRoutines();
  const routineSeeds = [
    {
      name: "Midnight Skyline",
      style: "Contemporary",
      type: "Small Group",
      dancerIds: seededDancers.slice(0, 4).map((d) => d.id),
      costumeName: "Navy lyrical set",
      costumeFee: "135",
      paidDancerIds: seededDancers.slice(0, 2).map((d) => d.id),
    },
    {
      name: "Neon Pulse",
      style: "Hip Hop",
      type: "Large Group",
      dancerIds: seededDancers.map((d) => d.id),
      costumeName: "Street neon jackets",
      costumeFee: "95",
      paidDancerIds: [seededDancers[0]?.id].filter(Boolean),
    },
    {
      name: "Bloom",
      style: "Lyrical",
      type: "Solo",
      dancerIds: [seededDancers[0]?.id].filter(Boolean),
      costumeName: "Rose chiffon dress",
      costumeFee: "160",
      paidDancerIds: [seededDancers[0]?.id].filter(Boolean),
    },
  ];

  const seededRoutines: Array<{ id: string; name: string }> = [];
  for (const routine of routineSeeds) {
    const found = existingRoutines.find((r) => r.name === routine.name);
    if (found) {
      seededRoutines.push(found);
      continue;
    }
    const created = await storage.createRoutine(routine as any);
    seededRoutines.push(created);
    console.log(`  ✓ routine: ${created.name}`);
  }

  // ---------- COMPETITIONS ----------
  const existingCompetitions = await storage.getCompetitions();
  const competitionSeeds = [
    {
      name: "Demo Spotlight Nationals",
      location: "Charlotte, NC",
      startDate: plusDays(30),
      endDate: plusDays(33),
      status: "Upcoming",
      conventionFee: "295",
      paymentDeadline: plusDays(14),
      feeStructure: {
        solo: "145",
        duetTrio: "95",
        group: "62",
        largeGroup: "55",
        line: "48",
        production: "42",
        photoFee: "35",
      },
    },
    {
      name: "Demo City Dance Classic",
      location: "Atlanta, GA",
      startDate: plusDays(60),
      endDate: plusDays(62),
      status: "Upcoming",
      conventionFee: "0",
      paymentDeadline: plusDays(45),
      feeStructure: {
        solo: "120",
        duetTrio: "85",
        group: "58",
        largeGroup: "50",
        line: "45",
        production: "40",
        photoFee: "25",
      },
    },
  ];

  const seededCompetitions: Array<{ id: string; name: string }> = [];
  for (const competition of competitionSeeds) {
    const found = existingCompetitions.find((c) => c.name === competition.name);
    if (found) {
      seededCompetitions.push(found);
      continue;
    }
    const created = await storage.createCompetition(competition as any);
    seededCompetitions.push(created);
    console.log(`  ✓ competition: ${created.name}`);
  }

  const primaryCompetitionId = seededCompetitions[0]?.id;
  if (!primaryCompetitionId) {
    console.log("⚠️ No competition available; skipping dependent demo data.");
    return;
  }

  // ---------- REGISTRATIONS ----------
  const registrations = await storage.getCompetitionRegistrations(primaryCompetitionId);
  const registrationCombos = [
    { dancerId: seededDancers[0]?.id, routineId: seededRoutines[0]?.id },
    { dancerId: seededDancers[1]?.id, routineId: seededRoutines[0]?.id },
    { dancerId: seededDancers[2]?.id, routineId: seededRoutines[1]?.id },
    { dancerId: seededDancers[0]?.id, routineId: seededRoutines[2]?.id },
  ].filter((x) => x.dancerId && x.routineId) as Array<{ dancerId: string; routineId: string }>;

  for (const combo of registrationCombos) {
    const exists = registrations.find(
      (r) => r.dancerId === combo.dancerId && r.routineId === combo.routineId,
    );
    if (!exists) {
      await storage.createCompetitionRegistration({
        competitionId: primaryCompetitionId,
        dancerId: combo.dancerId,
        routineId: combo.routineId,
      });
    }
  }

  // ---------- RUN SHEET PREVIEW ENTRIES ----------
  const existingRunSheet = await storage.getCompetitionRunSheets(primaryCompetitionId);
  if (existingRunSheet.length === 0) {
    await storage.createCompetitionRunSheetsBulk([
      {
        competitionId: primaryCompetitionId,
        entryNumber: "101",
        routineName: "Midnight Skyline",
        division: "Teen",
        style: "Contemporary",
        groupSize: "Small Group",
        studioName: "Studio Maestro",
        performanceTime: "9:15",
        day: "Friday",
        notes: "Opening group",
      },
      {
        competitionId: primaryCompetitionId,
        entryNumber: "148",
        routineName: "Bloom",
        division: "Teen",
        style: "Lyrical",
        groupSize: "Solo",
        studioName: "Studio Maestro",
        performanceTime: "1:30",
        day: "Saturday",
        notes: "Need prop check",
      },
    ] as any);
    console.log("  ✓ run sheet demo rows added");
  }

  // ---------- CONVENTION CLASSES ----------
  const existingConventionClasses = await storage.getConventionClasses(primaryCompetitionId);
  if (existingConventionClasses.length === 0) {
    await storage.createConventionClassesBulk([
      {
        competitionId: primaryCompetitionId,
        className: "Advanced Jazz Combos",
        instructor: "Jade Cole",
        room: "Ballroom A",
        day: "Friday",
        startTime: "09:00",
        endTime: "10:00",
        duration: 60,
        style: "Jazz",
        division: "Teen/Senior",
        ageRange: "13-18",
        level: "Advanced",
        rawText: "Advanced Jazz Combos | Jade Cole",
      },
      {
        competitionId: primaryCompetitionId,
        className: "Hip Hop Foundations",
        instructor: "Miles Turner",
        room: "Ballroom B",
        day: "Friday",
        startTime: "10:15",
        endTime: "11:15",
        duration: 60,
        style: "Hip Hop",
        division: "Junior/Teen",
        ageRange: "9-15",
        level: "All Levels",
        rawText: "Hip Hop Foundations | Miles Turner",
      },
    ] as any);
    console.log("  ✓ convention class demo rows added");
  }

  // ---------- STUDIO CLASSES ----------
  const existingStudioClasses = await storage.getStudioClasses();
  const studioClassSeeds = [
    { name: "Teen Jazz Tech", level: "Teen", day: "Tuesday", time: "18:30", type: "Weekly", description: "Turns, leaps, conditioning", teacherId: seededTeachers[0]?.id },
    { name: "Mini Acro Basics", level: "Mini", day: "Thursday", time: "17:00", type: "Weekly", description: "Flexibility & acro fundamentals", teacherId: seededTeachers[1]?.id },
  ];
  for (const cls of studioClassSeeds) {
    const found = existingStudioClasses.find((c) => c.name === cls.name && c.day === cls.day && c.time === cls.time);
    if (!found) {
      await storage.createStudioClass(cls as any);
    }
  }

  // ---------- PRACTICE BOOKINGS ----------
  const existingBookings = await storage.getPracticeBookings();
  if (existingBookings.length < 2) {
    await storage.createPracticeBooking({
      title: "Neon Pulse cleaning",
      date: plusDays(5),
      startTime: "18:00",
      endTime: "19:00",
      room: "Studio A",
      bookedBy: "Jade Cole",
      purpose: "Competition prep",
    } as any);
    await storage.createPracticeBooking({
      title: "Solo private - Bloom",
      date: plusDays(6),
      startTime: "17:00",
      endTime: "17:45",
      room: "Studio B",
      bookedBy: "Miles Turner",
      purpose: "Solo polishing",
    } as any);
  }

  // ---------- ANNOUNCEMENTS ----------
  const existingAnnouncements = await storage.getAnnouncements();
  const announcementTitles = new Set(existingAnnouncements.map((a) => a.title));
  const announcements = [
    {
      title: "Demo Data Notice",
      content: "This account currently contains seeded demo data for UI walkthrough/testing.",
      date: new Date().toISOString(),
      tag: "Studio",
      status: "Active",
      isPinned: true,
    },
    {
      title: "Costume Fitting Week",
      content: "All group routines have fittings this week. Check rehearsal calendar for slots.",
      date: new Date().toISOString(),
      tag: "Competition",
      status: "Active",
      isPinned: false,
    },
  ];
  for (const item of announcements) {
    if (!announcementTitles.has(item.title)) {
      await storage.createAnnouncement(item as any);
    }
  }

  // ---------- FEES ----------
  const existingFees = await storage.getFees();
  const needFee = (type: string, dancerId: string, amount: string) =>
    !existingFees.some((f) => f.type === type && f.dancerId === dancerId && f.amount === amount);

  const feeSeeds = [
    {
      type: "Competition",
      amount: "145",
      paid: false,
      dueDate: plusDays(14),
      dancerId: seededDancers[0]?.id,
      competitionId: primaryCompetitionId,
      routineId: seededRoutines[2]?.id,
    },
    {
      type: "Costume",
      amount: "95",
      paid: true,
      dueDate: plusDays(10),
      dancerId: seededDancers[2]?.id,
      routineId: seededRoutines[1]?.id,
    },
  ].filter((f) => f.dancerId);

  for (const fee of feeSeeds) {
    if (needFee(fee.type, fee.dancerId as string, fee.amount)) {
      await storage.createFee(fee as any);
    }
  }

  // ---------- FINANCE HUB EVENTS ----------
  const existingEvents = await storage.getEvents(currentSeasonYear);
  const findEventByName = (name: string) => existingEvents.find((event) => event.name === name);

  const recitalEvent =
    findEventByName(`${currentSeasonYear} Spring Recital`) ||
    (await storage.createEvent({
      name: `${currentSeasonYear} Spring Recital`,
      type: "recital",
      seasonYear: currentSeasonYear,
      dueDate: plusDays(35),
    }));

  const regionalEvent =
    findEventByName("Next Regional Comp") ||
    (await storage.createEvent({
      name: "Next Regional Comp",
      type: "competition",
      seasonYear: currentSeasonYear,
      dueDate: plusDays(21),
    }));

  const nationalsEvent =
    findEventByName(`Nationals ${currentSeasonYear}`) ||
    (await storage.createEvent({
      name: `Nationals ${currentSeasonYear}`,
      type: "nationals",
      seasonYear: currentSeasonYear,
      dueDate: plusDays(75),
    }));

  // ---------- EVENT FEES + EVENT-LINKED TRANSACTIONS ----------
  const eventFeeSeeds: Array<{ dancerId: string; eventId: string; amount: number; payments: number[] }> = [
    {
      dancerId: seededDancers[0]?.id,
      eventId: regionalEvent.id,
      amount: 285,
      payments: [100],
    },
    {
      dancerId: seededDancers[1]?.id,
      eventId: recitalEvent.id,
      amount: 145,
      payments: [145],
    },
    {
      dancerId: seededDancers[2]?.id,
      eventId: nationalsEvent.id,
      amount: 525,
      payments: [],
    },
  ].filter((entry) => Boolean(entry.dancerId));

  for (const seed of eventFeeSeeds) {
    const existingEventFees = await storage.getEventFeesByDancer(seed.dancerId);
    const existingEventFee = existingEventFees.find((fee) => fee.eventId === seed.eventId);

    const eventFee =
      existingEventFee ||
      (await storage.createEventFeeWithCharge({
        dancerId: seed.dancerId,
        eventId: seed.eventId,
        amount: seed.amount,
        description: "Phase 1 seeded event charge",
      })).eventFee;

    const existingTransactions = await storage.getTransactions(seed.dancerId);

    for (const paymentAmount of seed.payments) {
      const alreadySeeded = existingTransactions.some(
        (tx) =>
          tx.type === "payment" &&
          tx.eventFeeId === eventFee.id &&
          Number(tx.amount) === paymentAmount &&
          (tx.description || "") === "Phase 1 seeded event payment",
      );

      if (!alreadySeeded) {
        await storage.createFinancePayment({
          dancerId: seed.dancerId,
          amount: paymentAmount,
          date: plusDays(-3),
          description: "Phase 1 seeded event payment",
          eventFeeId: eventFee.id,
        });
      }
    }
  }

  // ---------- LEDGER PAYMENTS (NON-EVENT) ----------
  const nonEventPaymentSeeds = [
    { dancerId: seededDancers[0]?.id, amount: 120, feeType: "tuition" as const, description: "Monthly tuition payment" },
    { dancerId: seededDancers[3]?.id, amount: 95, feeType: "costume" as const, description: "Costume payment" },
  ].filter((entry) => Boolean(entry.dancerId));

  for (const payment of nonEventPaymentSeeds) {
    const existingTransactions = await storage.getTransactions(payment.dancerId);
    const alreadySeeded = existingTransactions.some(
      (tx) =>
        tx.type === "payment" &&
        !tx.eventFeeId &&
        tx.feeType === payment.feeType &&
        Number(tx.amount) === payment.amount &&
        (tx.description || "") === payment.description,
    );

    if (!alreadySeeded) {
      await storage.createFinancePayment({
        dancerId: payment.dancerId,
        amount: payment.amount,
        feeType: payment.feeType,
        date: plusDays(-1),
        description: payment.description,
      });
    }
  }

  console.log("✅ Demo seed complete.");
}

seedDemo().catch((error) => {
  console.error("❌ Demo seed failed:", error);
  process.exit(1);
});
