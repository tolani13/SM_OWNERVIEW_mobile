import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Users, 
  Music, 
  Trophy, 
  DollarSign, 
  CalendarDays,
  ArrowRight,
  Megaphone
} from "lucide-react";
import { Link } from "wouter";
import {
  useDancers,
  useRoutines,
  useCompetitions,
  useFees,
  useStudioClasses,
  usePracticeBookings,
} from "@/hooks/useData";

export default function Dashboard() {
  const { data: dancers = [], isLoading: dancersLoading } = useDancers();
  const { data: routines = [], isLoading: routinesLoading } = useRoutines();
  const { data: competitions = [], isLoading: competitionsLoading } = useCompetitions();
  const { data: fees = [], isLoading: feesLoading } = useFees();
  const { data: studioClasses = [], isLoading: studioClassesLoading } = useStudioClasses();
  const { data: practiceBookings = [], isLoading: practiceBookingsLoading } = usePracticeBookings();

  const activeDancers = dancers.filter(d => d.status === "Active").length;
  const activeRoutines = routines.length;
  const upcomingComps = competitions.filter(c => c.status === "Upcoming").length;
  
  // Calculate total monthly tuition (simplified)
  const totalTuition = fees
    .filter(f => f.type === "Tuition")
    .reduce((sum, f) => sum + parseFloat(f.amount || "0"), 0);

  const now = new Date();
  const todayWeekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const formatTime = (time?: string) => {
    if (!time) return "TBD";
    const [hour, minute] = time.split(":").map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return time;
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const getDurationMinutes = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);
    if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return null;
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    const diff = endTotal - startTotal;
    return diff > 0 ? diff : null;
  };

  const isPrivateOrSoloBooking = (booking: { title?: string | null; purpose?: string | null; room?: string | null }) => {
    const haystack = [booking.title, booking.purpose, booking.room]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes("private") || haystack.includes("solo");
  };

  const todaysClasses = studioClasses
    .filter((cls) => cls.day === todayWeekday)
    .sort((a, b) => a.time.localeCompare(b.time));

  const todaysBookings = practiceBookings
    .filter((booking) => booking.date === todayIso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const todaysPrivateInstruction = todaysBookings.filter(isPrivateOrSoloBooking);
  const bookingsToDisplay = todaysPrivateInstruction.length > 0 ? todaysPrivateInstruction : todaysBookings;

  const resolveDancerId = (booking: { bookedBy?: string | null } & Record<string, unknown>) => {
    const directDancerId = typeof booking.dancerId === "string" ? booking.dancerId : null;
    if (directDancerId) return directDancerId;

    const bookedBy = (booking.bookedBy || "").trim().toLowerCase();
    if (!bookedBy) return null;

    const matchedDancer = dancers.find(
      (dancer) => `${dancer.firstName} ${dancer.lastName}`.trim().toLowerCase() === bookedBy,
    );

    return matchedDancer?.id ?? null;
  };

  if (
    dancersLoading ||
    routinesLoading ||
    competitionsLoading ||
    feesLoading ||
    studioClassesLoading ||
    practiceBookingsLoading
  ) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Welcome back!</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening at the studio today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/dancers">
            <Card className="shadow-sm hover:shadow-md transition-shadow border-none bg-white cursor-pointer group h-full overflow-hidden">
              <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
              <CardContent className="p-6 flex flex-col gap-2">
                <span className="p-2 w-fit rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Dancers</p>
                  <h3 className="text-2xl font-bold">{activeDancers}</h3>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/routines">
            <Card className="shadow-sm hover:shadow-md transition-shadow border-none bg-white cursor-pointer group h-full overflow-hidden">
              <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
              <CardContent className="p-6 flex flex-col gap-2">
                <span className="p-2 w-fit rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                  <Music className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Routines</p>
                  <h3 className="text-2xl font-bold">{activeRoutines}</h3>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/competitions">
            <Card className="shadow-sm hover:shadow-md transition-shadow border-none bg-white cursor-pointer group h-full overflow-hidden">
              <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
              <CardContent className="p-6 flex flex-col gap-2">
                <span className="p-2 w-fit rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-100 transition-colors">
                  <Trophy className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Upcoming Comps</p>
                  <h3 className="text-2xl font-bold">{upcomingComps}</h3>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/finance">
            <Card className="shadow-sm hover:shadow-md transition-shadow border-none bg-white cursor-pointer group h-full overflow-hidden">
              <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
              <CardContent className="p-6 flex flex-col gap-2">
                <span className="p-2 w-fit rounded-lg bg-green-50 text-green-600 group-hover:bg-green-100 transition-colors">
                  <DollarSign className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monthly Tuition</p>
                  <h3 className="text-2xl font-bold">${totalTuition.toLocaleString()}</h3>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Next Events Section */}
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm h-full group overflow-hidden">
            <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <CalendarDays className="w-5 h-5 text-primary" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {competitions.filter(c => c.status === "Upcoming").slice(0, 3).map((comp) => (
                  <div key={comp.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary font-bold shrink-0">
                      <span className="text-xs uppercase">{new Date(comp.startDate).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-lg leading-none">{new Date(comp.startDate).getDate()}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{comp.name}</h4>
                      <p className="text-sm text-muted-foreground">{comp.location}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                 <Link href="/competitions">
                    <button className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                        View all competitions <ArrowRight className="w-4 h-4" />
                    </button>
                 </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm h-full bg-gradient-to-br from-primary/5 to-white group overflow-hidden">
            <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
            <CardHeader>
              <CardTitle className="font-display">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
               <div className="relative flex flex-col w-full min-h-32 bg-white rounded-xl shadow-sm border border-gray-100 p-3 gap-2 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
                  <div className="flex items-center gap-2 mt-2">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    <span className="font-medium text-sm">Private Instruction</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {bookingsToDisplay.length === 0 ? (
                      <p>No private instruction bookings today.</p>
                    ) : (
                      bookingsToDisplay.slice(0, 3).map((booking) => {
                        const duration = getDurationMinutes(booking.startTime, booking.endTime);
                        const dancerId = resolveDancerId(booking as Record<string, unknown> & { bookedBy?: string | null });
                        return (
                          <div key={booking.id} className="rounded-md bg-secondary/30 p-2">
                            <p className="font-medium text-foreground truncate">Booked by: {booking.bookedBy}</p>
                            <p className="truncate">Dancer ID: {dancerId || "Not linked"}</p>
                            <p>
                              {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                              {duration ? ` (${duration}m)` : ""}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
               </div>
               <Link href="/announcements">
                <button className="relative flex flex-col items-center justify-center w-full h-32 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary/50 transition-all text-center gap-2 overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-2 bg-primary origin-left group-hover:scale-x-105 transition-transform" />
                    <Megaphone className="w-6 h-6 text-primary mt-2" />
                    <span className="font-medium text-sm">Post Announcement</span>
                </button>
               </Link>
               <div className="relative flex flex-col w-full min-h-32 bg-white rounded-xl shadow-sm border border-gray-100 p-3 gap-2 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
                  <div className="flex items-center gap-2 mt-2">
                    <Users className="w-5 h-5 text-primary" />
                    <span className="font-medium text-sm">Today&apos;s Classes</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {todaysClasses.length === 0 ? (
                      <p>No classes scheduled today.</p>
                    ) : (
                      todaysClasses.slice(0, 3).map((studioClass) => (
                        <div key={studioClass.id} className="rounded-md bg-secondary/30 p-2">
                          <p className="font-medium text-foreground truncate">{studioClass.name}</p>
                          <p>{formatTime(studioClass.time)}</p>
                        </div>
                      ))
                    )}
                  </div>
               </div>
                <Link href="/routines">
                <button className="relative flex flex-col items-center justify-center w-full h-32 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary/50 transition-all text-center gap-2 overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-2 bg-primary origin-left group-hover:scale-x-105 transition-transform" />
                    <Music className="w-6 h-6 text-primary mt-2" />
                    <span className="font-medium text-sm">Create Routine</span>
                </button>
               </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}