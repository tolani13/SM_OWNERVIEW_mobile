import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerPDFParserRoutes } from "./pdf-parser-routes";
import { registerRunSheetRoutes } from "./run-sheet-routes";
import { z } from "zod";
import type {
  InsertDancer,
  InsertTeacher,
  InsertRoutine,
  InsertCompetition,
  InsertCompetitionRegistration,
  InsertRunSlot,
  InsertConventionClass,
  InsertStudioClass,
  InsertPracticeBooking,
  InsertAnnouncement,
  InsertFee,
  Routine
} from "./schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const feeStructureSchema = z.object({
    solo: z.string(),
    duetTrio: z.string(),
    group: z.string(),
    largeGroup: z.string(),
    line: z.string(),
    production: z.string(),
    photoFee: z.string().optional()
  });
  // ========== DANCERS ==========
  app.get("/api/dancers", async (req, res) => {
    try {
      const dancers = await storage.getDancers();
      res.json(dancers);
    } catch (error: any) {
      console.error("Get dancers error:", error);
      res.status(500).json({ error: "Failed to fetch dancers" });
    }
  });

  app.get("/api/dancers/:id", async (req, res) => {
    try {
      const dancer = await storage.getDancer(req.params.id);
      if (!dancer) {
        return res.status(404).json({ error: "Dancer not found" });
      }
      res.json(dancer);
    } catch (error: any) {
      console.error("Get dancer error:", error);
      res.status(500).json({ error: "Failed to fetch dancer" });
    }
  });

  app.post("/api/dancers", async (req, res) => {
    try {
      const dancer = await storage.createDancer(req.body as InsertDancer);
      res.status(201).json(dancer);
    } catch (error: any) {
      console.error("Create dancer error:", error);
      res.status(400).json({ error: error?.message || "Invalid dancer data" });
    }
  });

  app.patch("/api/dancers/:id", async (req, res) => {
    try {
      const dancer = await storage.updateDancer(req.params.id, req.body);
      if (!dancer) {
        return res.status(404).json({ error: "Dancer not found" });
      }
      res.json(dancer);
    } catch (error: any) {
      console.error("Update dancer error:", error);
      res.status(400).json({ error: "Failed to update dancer" });
    }
  });

  app.delete("/api/dancers/:id", async (req, res) => {
    try {
      await storage.deleteDancer(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete dancer error:", error);
      res.status(500).json({ error: "Failed to delete dancer" });
    }
  });

  // ========== TEACHERS ==========
  app.get("/api/teachers", async (req, res) => {
    try {
      const teachers = await storage.getTeachers();
      res.json(teachers);
    } catch (error: any) {
      console.error("Get teachers error:", error);
      res.status(500).json({ error: "Failed to fetch teachers" });
    }
  });

  app.post("/api/teachers", async (req, res) => {
    try {
      const teacher = await storage.createTeacher(req.body as InsertTeacher);
      res.status(201).json(teacher);
    } catch (error: any) {
      console.error("Create teacher error:", error);
      res.status(400).json({ error: error?.message || "Invalid teacher data" });
    }
  });

  app.patch("/api/teachers/:id", async (req, res) => {
    try {
      const teacher = await storage.updateTeacher(req.params.id, req.body);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      res.json(teacher);
    } catch (error: any) {
      console.error("Update teacher error:", error);
      res.status(400).json({ error: "Failed to update teacher" });
    }
  });

  app.delete("/api/teachers/:id", async (req, res) => {
    try {
      await storage.deleteTeacher(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete teacher error:", error);
      res.status(500).json({ error: "Failed to delete teacher" });
    }
  });

  // ========== ROUTINES ==========
  app.get("/api/routines", async (req, res) => {
    try {
      const routines = await storage.getRoutines();
      res.json(routines);
    } catch (error: any) {
      console.error("Get routines error:", error);
      res.status(500).json({ error: "Failed to fetch routines" });
    }
  });

  app.post("/api/routines", async (req, res) => {
    try {
      const routine = await storage.createRoutine(req.body as InsertRoutine);
      
      // Auto-create costume fees for each dancer
      if (routine.costumeFee && parseFloat(routine.costumeFee) > 0 && routine.dancerIds.length > 0) {
        const costumeFeeAmount = routine.costumeFee;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        
        for (const dancerId of routine.dancerIds) {
          await storage.createFee({
            type: "Costume",
            amount: costumeFeeAmount,
            paid: false,
            dueDate: dueDate.toISOString().split('T')[0],
            dancerId: dancerId,
            routineId: routine.id
          });
        }
      }
      
      res.status(201).json(routine);
    } catch (error: any) {
      console.error("Create routine error:", error);
      res.status(400).json({ error: "Invalid routine data" });
    }
  });

  app.patch("/api/routines/:id", async (req, res) => {
    try {
      const existingRoutine = await storage.getRoutine(req.params.id);
      if (!existingRoutine) {
        return res.status(404).json({ error: "Routine not found" });
      }

      const routine = await storage.updateRoutine(req.params.id, req.body);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }

      // Sync costume fees if dancers or costumeFee changed
      const dancersChanged = req.body.dancerIds && 
        JSON.stringify(req.body.dancerIds.sort()) !== JSON.stringify(existingRoutine.dancerIds.sort());
      const feeChanged = req.body.costumeFee && req.body.costumeFee !== existingRoutine.costumeFee;

      if (dancersChanged || feeChanged) {
        const allFees = await storage.getFees();
        const existingCostumeFees = allFees.filter(f => f.routineId === routine.id && f.type === "Costume");
        
        const currentDancerIds = routine.dancerIds || [];
        const costumeFeeAmount = routine.costumeFee || "0";
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        for (const fee of existingCostumeFees) {
          if (!currentDancerIds.includes(fee.dancerId)) {
            await storage.deleteFee(fee.id);
          }
        }

        if (parseFloat(costumeFeeAmount) > 0) {
          for (const dancerId of currentDancerIds) {
            const existingFee = existingCostumeFees.find(f => f.dancerId === dancerId);
            
            if (existingFee) {
              if (feeChanged) {
                await storage.updateFee(existingFee.id, { amount: costumeFeeAmount });
              }
            } else {
              await storage.createFee({
                type: "Costume",
                amount: costumeFeeAmount,
                paid: false,
                dueDate: dueDate.toISOString().split('T')[0],
                dancerId: dancerId,
                routineId: routine.id
              });
            }
          }
        }
      }

      res.json(routine);
    } catch (error: any) {
      console.error("Update routine error:", error);
      res.status(400).json({ error: "Failed to update routine" });
    }
  });

  app.delete("/api/routines/:id", async (req, res) => {
    try {
      const allFees = await storage.getFees();
      const costumeFees = allFees.filter(f => f.routineId === req.params.id && f.type === "Costume");
      for (const fee of costumeFees) {
        await storage.deleteFee(fee.id);
      }
      
      await storage.deleteRoutine(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete routine error:", error);
      res.status(500).json({ error: "Failed to delete routine" });
    }
  });

  // ========== COMPETITIONS ==========
  app.get("/api/competitions", async (req, res) => {
    try {
      const competitions = await storage.getCompetitions();
      res.json(competitions);
    } catch (error: any) {
      console.error("Get competitions error:", error);
      res.status(500).json({ error: "Failed to fetch competitions" });
    }
  });

  app.get("/api/competitions/:id", async (req, res) => {
    try {
      const competition = await storage.getCompetition(req.params.id);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }
      res.json(competition);
    } catch (error: any) {
      console.error("Get competition error:", error);
      res.status(500).json({ error: "Failed to fetch competition" });
    }
  });

  app.post("/api/competitions", async (req, res) => {
    try {
      const competition = await storage.createCompetition(req.body as InsertCompetition);
      res.status(201).json(competition);
    } catch (error: any) {
      console.error("Create competition error:", error);
      res.status(400).json({ error: "Invalid competition data" });
    }
  });

  app.patch("/api/competitions/:id", async (req, res) => {
    try {
      const competition = await storage.updateCompetition(req.params.id, req.body);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }
      res.json(competition);
    } catch (error: any) {
      console.error("Update competition error:", error);
      res.status(400).json({ error: "Failed to update competition" });
    }
  });

  app.delete("/api/competitions/:id", async (req, res) => {
    try {
      await storage.deleteCompetition(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete competition error:", error);
      res.status(500).json({ error: "Failed to delete competition" });
    }
  });

  // ========== COMPETITION REGISTRATIONS ==========
  app.get("/api/competition-registrations", async (req, res) => {
    try {
      const competitionId = req.query.competitionId as string | undefined;
      const registrations = await storage.getCompetitionRegistrations(competitionId);
      res.json(registrations);
    } catch (error: any) {
      console.error("Get registrations error:", error);
      res.status(500).json({ error: "Failed to fetch registrations" });
    }
  });

  app.post("/api/competition-registrations", async (req, res) => {
    try {
      const registration = await storage.createCompetitionRegistration(req.body as InsertCompetitionRegistration);
      res.status(201).json(registration);
    } catch (error: any) {
      console.error("Create registration error:", error);
      res.status(400).json({ error: "Invalid registration data" });
    }
  });

  app.delete("/api/competition-registrations/:id", async (req, res) => {
    try {
      await storage.deleteCompetitionRegistration(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete registration error:", error);
      res.status(500).json({ error: "Failed to delete registration" });
    }
  });

  // ========== GENERATE FEES ==========
  app.post("/api/competitions/:id/generate-fees", async (req, res) => {
    try {
      const competitionId = req.params.id;
      const competition = await storage.getCompetition(competitionId);
      
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      // Validate feeStructure shape if provided/overriding
      if (competition.feeStructure) {
        const parsed = feeStructureSchema.safeParse(competition.feeStructure);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid feeStructure on competition", details: parsed.error.flatten() });
        }
      }

      // Get all registrations for this competition
      const registrations = await storage.getCompetitionRegistrations(competitionId);
      
      // Get all routines to determine type
      const allRoutines = await storage.getRoutines();
      
      // Group registrations by dancer
      const dancerRegistrations: Record<string, typeof registrations> = {};
      for (const reg of registrations) {
        if (!dancerRegistrations[reg.dancerId]) {
          dancerRegistrations[reg.dancerId] = [];
        }
        dancerRegistrations[reg.dancerId].push(reg);
      }

      const feeStructure = competition.feeStructure as {
        solo: string;
        duetTrio: string;
        group: string;
        largeGroup: string;
        line: string;
        production: string;
        photoFee?: string;
      };

      const dueDate = competition.paymentDeadline || competition.startDate;

      // Create fees for each dancer
      for (const [dancerId, regs] of Object.entries(dancerRegistrations)) {
        // Create convention fee (one per dancer)
        if (competition.conventionFee && parseFloat(competition.conventionFee) > 0) {
          await storage.createFee({
            type: "Competition",
            amount: competition.conventionFee,
            paid: false,
            dueDate: dueDate,
            dancerId: dancerId,
            competitionId: competitionId,
            routineId: undefined
          });
        }

        // Create entry fee for each routine
        for (const reg of regs) {
          const routine = allRoutines.find(r => r.id === reg.routineId);
          if (!routine) continue;

          let feeAmount = "0";
          const routineType = routine.type;

          if (routineType === "Solo") feeAmount = feeStructure.solo;
          else if (routineType === "Duet" || routineType === "Trio") feeAmount = feeStructure.duetTrio;
          else if (routineType === "Small Group") feeAmount = feeStructure.group;
          else if (routineType === "Large Group") feeAmount = feeStructure.largeGroup;
          else if (routineType === "Line") feeAmount = feeStructure.line;
          else if (routineType === "Production") feeAmount = feeStructure.production;

          if (parseFloat(feeAmount) > 0) {
            await storage.createFee({
              type: "Competition",
              amount: feeAmount,
              paid: false,
              dueDate: dueDate,
              dancerId: dancerId,
              competitionId: competitionId,
              routineId: reg.routineId
            });
          }
        }

        // Create photo fee if applicable (one per dancer)
        if (feeStructure.photoFee && parseFloat(feeStructure.photoFee) > 0) {
          await storage.createFee({
            type: "Competition",
            amount: feeStructure.photoFee,
            paid: false,
            dueDate: dueDate,
            dancerId: dancerId,
            competitionId: competitionId,
            routineId: undefined
          });
        }
      }

      res.json({ success: true, message: "Fees generated successfully" });
    } catch (error: any) {
      console.error("Generate fees error:", error);
      res.status(500).json({ error: "Failed to generate fees" });
    }
  });

  // ========== RUN SLOTS ==========
  app.get("/api/run-slots", async (req, res) => {
    try {
      const competitionId = req.query.competitionId as string | undefined;
      const runSlots = await storage.getRunSlots(competitionId);
      res.json(runSlots);
    } catch (error: any) {
      console.error("Get run slots error:", error);
      res.status(500).json({ error: "Failed to fetch run slots" });
    }
  });

  app.post("/api/run-slots", async (req, res) => {
    try {
      const runSlot = await storage.createRunSlot(req.body as InsertRunSlot);
      res.status(201).json(runSlot);
    } catch (error: any) {
      console.error("Create run slot error:", error);
      res.status(400).json({ error: "Invalid run slot data" });
    }
  });

  app.patch("/api/run-slots/:id", async (req, res) => {
    try {
      const runSlot = await storage.updateRunSlot(req.params.id, req.body);
      if (!runSlot) {
        return res.status(404).json({ error: "Run slot not found" });
      }
      res.json(runSlot);
    } catch (error: any) {
      console.error("Update run slot error:", error);
      res.status(400).json({ error: "Failed to update run slot" });
    }
  });

  app.delete("/api/run-slots/:id", async (req, res) => {
    try {
      await storage.deleteRunSlot(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete run slot error:", error);
      res.status(500).json({ error: "Failed to delete run slot" });
    }
  });

  // ========== CONVENTION CLASSES ==========
  app.get("/api/convention-classes", async (req, res) => {
    try {
      const competitionId = req.query.competitionId as string | undefined;
      const classes = await storage.getConventionClasses(competitionId);
      res.json(classes);
    } catch (error: any) {
      console.error("Get convention classes error:", error);
      res.status(500).json({ error: "Failed to fetch convention classes" });
    }
  });

  app.post("/api/convention-classes", async (req, res) => {
    try {
      const conventionClass = await storage.createConventionClass(req.body as InsertConventionClass);
      res.status(201).json(conventionClass);
    } catch (error: any) {
      console.error("Create convention class error:", error);
      res.status(400).json({ error: "Invalid convention class data" });
    }
  });

  app.patch("/api/convention-classes/:id", async (req, res) => {
    try {
      const conventionClass = await storage.updateConventionClass(req.params.id, req.body);
      if (!conventionClass) {
        return res.status(404).json({ error: "Convention class not found" });
      }
      res.json(conventionClass);
    } catch (error: any) {
      console.error("Update convention class error:", error);
      res.status(400).json({ error: "Failed to update convention class" });
    }
  });

  app.delete("/api/convention-classes/:id", async (req, res) => {
    try {
      await storage.deleteConventionClass(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete convention class error:", error);
      res.status(500).json({ error: "Failed to delete convention class" });
    }
  });

  // ========== STUDIO CLASSES ==========
  app.get("/api/studio-classes", async (req, res) => {
    try {
      const classes = await storage.getStudioClasses();
      res.json(classes);
    } catch (error: any) {
      console.error("Get studio classes error:", error);
      res.status(500).json({ error: "Failed to fetch studio classes" });
    }
  });

  app.post("/api/studio-classes", async (req, res) => {
    try {
      const studioClass = await storage.createStudioClass(req.body as InsertStudioClass);
      res.status(201).json(studioClass);
    } catch (error: any) {
      console.error("Create studio class error:", error);
      res.status(400).json({ error: "Invalid studio class data" });
    }
  });

  app.patch("/api/studio-classes/:id", async (req, res) => {
    try {
      const studioClass = await storage.updateStudioClass(req.params.id, req.body);
      if (!studioClass) {
        return res.status(404).json({ error: "Studio class not found" });
      }
      res.json(studioClass);
    } catch (error: any) {
      console.error("Studio class update error:", error);
      res.status(400).json({ error: "Failed to update studio class" });
    }
  });

  app.delete("/api/studio-classes/:id", async (req, res) => {
    try {
      await storage.deleteStudioClass(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete studio class error:", error);
      res.status(500).json({ error: "Failed to delete studio class" });
    }
  });

  // ========== PRACTICE BOOKINGS ==========
  app.get("/api/practice-bookings", async (req, res) => {
    try {
      const bookings = await storage.getPracticeBookings();
      res.json(bookings);
    } catch (error: any) {
      console.error("Get practice bookings error:", error);
      res.status(500).json({ error: "Failed to fetch practice bookings" });
    }
  });

  app.post("/api/practice-bookings", async (req, res) => {
    try {
      const booking = await storage.createPracticeBooking(req.body as InsertPracticeBooking);
      res.status(201).json(booking);
    } catch (error: any) {
      console.error("Create practice booking error:", error);
      res.status(400).json({ error: "Invalid booking data" });
    }
  });

  app.patch("/api/practice-bookings/:id", async (req, res) => {
    try {
      const booking = await storage.updatePracticeBooking(req.params.id, req.body);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error: any) {
      console.error("Update practice booking error:", error);
      res.status(400).json({ error: "Failed to update booking" });
    }
  });

  app.delete("/api/practice-bookings/:id", async (req, res) => {
    try {
      await storage.deletePracticeBooking(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete practice booking error:", error);
      res.status(500).json({ error: "Failed to delete booking" });
    }
  });

  // ========== ANNOUNCEMENTS ==========
  app.get("/api/announcements", async (req, res) => {
    try {
      const announcements = await storage.getAnnouncements();
      res.json(announcements);
    } catch (error: any) {
      console.error("Get announcements error:", error);
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  app.post("/api/announcements", async (req, res) => {
    try {
      const announcement = await storage.createAnnouncement(req.body as InsertAnnouncement);
      res.status(201).json(announcement);
    } catch (error: any) {
      console.error("Create announcement error:", error);
      res.status(400).json({ error: "Invalid announcement data" });
    }
  });

  app.patch("/api/announcements/:id", async (req, res) => {
    try {
      const announcement = await storage.updateAnnouncement(req.params.id, req.body);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      res.json(announcement);
    } catch (error: any) {
      console.error("Update announcement error:", error);
      res.status(400).json({ error: "Failed to update announcement" });
    }
  });

  app.delete("/api/announcements/:id", async (req, res) => {
    try {
      await storage.deleteAnnouncement(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete announcement error:", error);
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // ========== FEES ==========
  app.get("/api/fees", async (req, res) => {
    try {
      const dancerId = req.query.dancerId as string | undefined;
      const fees = await storage.getFees(dancerId);
      res.json(fees);
    } catch (error: any) {
      console.error("Get fees error:", error);
      res.status(500).json({ error: "Failed to fetch fees" });
    }
  });

  app.post("/api/fees", async (req, res) => {
    try {
      const fee = await storage.createFee(req.body as InsertFee);
      res.status(201).json(fee);
    } catch (error: any) {
      console.error("Create fee error:", error);
      res.status(400).json({ error: "Invalid fee data" });
    }
  });

  app.patch("/api/fees/:id", async (req, res) => {
    try {
      const fee = await storage.updateFee(req.params.id, req.body);
      if (!fee) {
        return res.status(404).json({ error: "Fee not found" });
      }
      res.json(fee);
    } catch (error: any) {
      console.error("Update fee error:", error);
      res.status(400).json({ error: "Failed to update fee" });
    }
  });

  app.delete("/api/fees/:id", async (req, res) => {
    try {
      await storage.deleteFee(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete fee error:", error);
      res.status(500).json({ error: "Failed to delete fee" });
    }
  });

  // ========== PDF PARSER ROUTES (LEGACY) ==========
  registerPDFParserRoutes(app);

  // ========== RUN SHEET ROUTES (NEW SIMPLIFIED APPROACH) ==========
  registerRunSheetRoutes(app);

  return httpServer;
}
