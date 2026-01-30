import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, MapPin, User, Calendar as CalendarIcon, Search, Star, CheckCircle2, XCircle, Edit2, Upload, DollarSign, Calendar, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  useStudioClasses, 
  useCreateStudioClass, 
  useUpdateStudioClass, 
  useDeleteStudioClass,
  useTeachers, 
  useCreateTeacher, 
  useUpdateTeacher, 
  usePracticeBookings, 
  useCreatePracticeBooking, 
  useUpdatePracticeBooking,
  useDeletePracticeBooking,
  useCompetitions
} from "@/hooks/useData";
import type { StudioClass, Teacher, PracticeBooking, InsertStudioClass, InsertTeacher, InsertPracticeBooking } from "@server/schema";
import { toast } from "react-hot-toast";

const LEVEL_OPTIONS = ["Mini", "Junior", "Teen", "Senior", "All Levels"];

export default function Studio() {
  const { data: classes = [], isLoading: classesLoading } = useStudioClasses();
  const { data: teachers = [], isLoading: teachersLoading } = useTeachers();
  const { data: bookings = [], isLoading: bookingsLoading } = usePracticeBookings();
  const { data: competitions = [], isLoading: competitionsLoading } = useCompetitions();

  const getTeacherName = (teacherId: string | null | undefined) => {
    if (!teacherId) return "Unknown";
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unknown";
  };
  
  const createStudioClass = useCreateStudioClass();
  const updateStudioClass = useUpdateStudioClass();
  const deleteStudioClass = useDeleteStudioClass();
  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const createPracticeBooking = useCreatePracticeBooking();
  const updatePracticeBooking = useUpdatePracticeBooking();
  const deletePracticeBooking = useDeletePracticeBooking();

  const [activeTab, setActiveTab] = useState("classes");
  
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false);
  const [isTeacherScheduleOpen, setIsTeacherScheduleOpen] = useState(false);
  const [selectedTeacherForSchedule, setSelectedTeacherForSchedule] = useState<Teacher | null>(null);
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState(0); // 0 = current week, 1 = next week, etc.

  // Delete confirmation states
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'class' | 'booking', id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const [newClass, setNewClass] = useState<Partial<InsertStudioClass>>({ type: "Weekly", level: "All Levels" });
  const [selectedLevels, setSelectedLevels] = useState<string[]>(["All Levels"]);
  const [newTeacher, setNewTeacher] = useState<Partial<InsertTeacher & {avatarFile?: File}>>({ isAvailableForSolo: false });
  const [newBooking, setNewBooking] = useState<Partial<InsertPracticeBooking>>({});
  
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  // Loading states for button feedback
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => {
      if (prev.includes(level)) {
        return prev.filter(l => l !== level);
      } else {
        return [...prev, level];
      }
    });
  };

  const handleAddClass = async () => {
    // Validation
    if (!newClass.name?.trim()) {
      toast.error("Please enter a class name");
      return;
    }
    if (!newClass.day) {
      toast.error("Please select a day");
      return;
    }
    if (!newClass.time) {
      toast.error("Please select a time");
      return;
    }
    
    if (newClass.type === "Weekly" && !newClass.teacherId) {
      toast.error("Please select a teacher for weekly classes");
      return;
    }
    
    if (selectedLevels.length === 0) {
      toast.error("Please select at least one level");
      return;
    }
    
    const levelString = selectedLevels.join(", ");
    
    setIsSavingClass(true);
    
    try {
      if (editingClassId) {
        await updateStudioClass.mutateAsync({
          id: editingClassId,
          data: {
            ...newClass,
            level: levelString
          }
        });
        toast.success("Class updated successfully!");
        setEditingClassId(null);
      } else {
        await createStudioClass.mutateAsync({
          name: newClass.name!,
          day: newClass.day!,
          time: newClass.time!,
          level: levelString,
          type: newClass.type || "Weekly",
          description: newClass.description || "",
          cost: newClass.cost || "",
          teacherId: newClass.teacherId || null
        });
        toast.success("Class created successfully!");
      }
      setIsAddClassOpen(false);
      setNewClass({ type: "Weekly", level: "All Levels" });
      setSelectedLevels(["All Levels"]);
    } catch (error: any) {
      console.error("Error saving class:", error);
      toast.error(error?.message || "Failed to save class. Please try again.");
    } finally {
      setIsSavingClass(false);
    }
  };

  const openEditClass = (cls: StudioClass) => {
    setNewClass(cls);
    setEditingClassId(cls.id);
    const levels = cls.level.split(", ").filter(Boolean);
    setSelectedLevels(levels.length > 0 ? levels : ["All Levels"]);
    setIsAddClassOpen(true);
  };

  const handleDeleteClass = async (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    
    setDeleteConfirm({type: 'class', id: classId, name: cls.name});
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'class') {
        await deleteStudioClass.mutateAsync(deleteConfirm.id);
        toast.success('Class deleted successfully!');
      } else if (deleteConfirm.type === 'booking') {
        await deletePracticeBooking.mutateAsync(deleteConfirm.id);
        toast.success('Booking deleted successfully!');
      }
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error?.message || 'Failed to delete. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Convert to base64 for preview/storage
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewTeacher({
        ...newTeacher,
        avatarUrl: reader.result as string,
        avatarFile: file
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTeacher = async () => {
    // Validation
    if (!newTeacher.firstName?.trim()) {
      toast.error("Please enter teacher first name");
      return;
    }
    if (!newTeacher.lastName?.trim()) {
      toast.error("Please enter teacher last name");
      return;
    }
    if (!newTeacher.specialty?.trim()) {
      toast.error("Please enter teacher specialty");
      return;
    }
    
    setIsSavingTeacher(true);
    
    try {
      const teacherData = {
        firstName: newTeacher.firstName.trim(),
        lastName: newTeacher.lastName.trim(),
        name: `${newTeacher.firstName.trim()} ${newTeacher.lastName.trim()}`,
        role: newTeacher.specialty?.trim() || "",
        specialty: newTeacher.specialty?.trim(),
        email: newTeacher.email?.trim() || "",
        phone: newTeacher.phone?.trim() || "",
        isAvailableForSolo: newTeacher.isAvailableForSolo || false,
        avatarUrl: newTeacher.avatarUrl || "",
        classes: newTeacher.classes || []
      };

      if (editingTeacherId) {
        await updateTeacher.mutateAsync({ 
          id: editingTeacherId, 
          data: teacherData
        });
        toast.success("Teacher updated successfully!");
        setEditingTeacherId(null);
      } else {
        await createTeacher.mutateAsync(teacherData);
        toast.success("Teacher added successfully!");
      }
      
      setIsAddTeacherOpen(false);
      setNewTeacher({ isAvailableForSolo: false });
    } catch (error: any) {
      console.error("Error saving teacher:", error);
      toast.error(error?.message || "Failed to save teacher. Please try again.");
    } finally {
      setIsSavingTeacher(false);
    }
  };

  const openEditTeacher = (teacher: Teacher) => {
    setNewTeacher({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      specialty: teacher.specialty,
      email: teacher.email,
      phone: teacher.phone,
      isAvailableForSolo: teacher.isAvailableForSolo,
      classes: teacher.classes,
      avatarUrl: teacher.avatarUrl
    });
    setEditingTeacherId(teacher.id);
    setIsAddTeacherOpen(true);
  };

  const handleAddBooking = async () => {
    // Validation
    if (!newBooking.title?.trim()) {
      toast.error("Please enter a booking title");
      return;
    }
    if (!newBooking.date) {
      toast.error("Please select a date");
      return;
    }
    if (!newBooking.startTime) {
      toast.error("Please select a start time");
      return;
    }
    if (!newBooking.endTime) {
      toast.error("Please select an end time");
      return;
    }
    
    setIsSavingBooking(true);
    
    try {
      if (editingBookingId) {
        await updatePracticeBooking.mutateAsync({ id: editingBookingId, data: newBooking as InsertPracticeBooking });
        toast.success("Booking updated successfully!");
        setEditingBookingId(null);
      } else {
        await createPracticeBooking.mutateAsync({
          title: newBooking.title!,
          date: newBooking.date!,
          startTime: newBooking.startTime!,
          endTime: newBooking.endTime!,
          room: newBooking.room || "Main Studio",
          bookedBy: newBooking.bookedBy || "Studio",
          purpose: newBooking.purpose || ""
        });
        toast.success("Booking created successfully!");
      }
      setIsAddBookingOpen(false);
      setNewBooking({});
    } catch (error: any) {
      console.error("Error saving booking:", error);
      toast.error(error?.message || "Failed to save booking. Please try again.");
    } finally {
      setIsSavingBooking(false);
    }
  };

  const openEditBooking = (booking: PracticeBooking) => {
    setNewBooking(booking);
    setEditingBookingId(booking.id);
    setIsAddBookingOpen(true);
  };

  const handleDeleteBooking = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    setDeleteConfirm({type: 'booking', id: bookingId, name: booking.title || 'this booking'});
  };

  if (classesLoading || teachersLoading || bookingsLoading || competitionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  const weeklyClasses = classes.filter(c => c.type === "Weekly");
  const specialEvents = classes.filter(c => c.type === "Special Event");

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Studio</h1>
          <p className="text-muted-foreground">Manage your studio's classes, teachers, and schedule.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white/50 border p-1 h-auto mb-6">
            <TabsTrigger 
              value="classes"
              className="py-2 px-6 rounded-md data-[state=active]:bg-[#FF9F7F] data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Classes
            </TabsTrigger>
            <TabsTrigger 
              value="teachers"
              className="py-2 px-6 rounded-md data-[state=active]:bg-[#FF9F7F] data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Teachers
            </TabsTrigger>
            <TabsTrigger 
              value="bookings"
              className="py-2 px-6 rounded-md data-[state=active]:bg-[#FF9F7F] data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors"
            >
              Practice Bookings
            </TabsTrigger>
          </TabsList>

          {/* CLASSES TAB */}
          <TabsContent value="classes" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Weekly Classes</h2>
              <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white" aria-label="Add new class">
                    <Plus className="w-4 h-4 mr-2" /> Add Class
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingClassId ? "Edit Class" : "Add New Class"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Class Name</Label>
                      <Input 
                        placeholder="e.g. Ballet Basics" 
                        value={newClass.name || ""} 
                        onChange={e => setNewClass({...newClass, name: e.target.value})} 
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Day</Label>
                        <Select value={newClass.day} onValueChange={v => setNewClass({...newClass, day: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Input 
                          type="time" 
                          value={newClass.time || ""} 
                          onChange={e => setNewClass({...newClass, time: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={newClass.type} onValueChange={v => setNewClass({...newClass, type: v as "Weekly" | "Special Event"})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Weekly">Weekly</SelectItem>
                          <SelectItem value="Special Event">Special Event</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Levels</Label>
                      <div className="flex flex-wrap gap-2">
                        {LEVEL_OPTIONS.map(level => (
                          <Badge 
                            key={level}
                            variant={selectedLevels.includes(level) ? "default" : "outline"}
                            className="cursor-pointer hover:bg-primary/90"
                            onClick={() => toggleLevel(level)}
                          >
                            {level}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {newClass.type === "Weekly" && (
                      <div className="space-y-2">
                        <Label>Teacher</Label>
                        <Select value={newClass.teacherId || ""} onValueChange={v => setNewClass({...newClass, teacherId: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.firstName} {t.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Description (Optional)</Label>
                      <Textarea 
                        placeholder="Class details..." 
                        value={newClass.description || ""} 
                        onChange={e => setNewClass({...newClass, description: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cost (Optional)</Label>
                      <Input 
                        placeholder="e.g. $50/month" 
                        value={newClass.cost || ""} 
                        onChange={e => setNewClass({...newClass, cost: e.target.value})} 
                      />
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleAddClass}
                      disabled={isSavingClass}
                      aria-label="Save class"
                    >
                      {isSavingClass ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        editingClassId ? "Update Class" : "Add Class"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {weeklyClasses.map(cls => (
                <Card key={cls.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{cls.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {cls.day} at {cls.time}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditClass(cls)} aria-label={`Edit ${cls.name}`}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClass(cls.id)} aria-label={`Delete ${cls.name}`}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      {getTeacherName(cls.teacherId)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cls.level.split(", ").map(lvl => (
                        <Badge key={lvl} variant="secondary" className="text-xs">{lvl}</Badge>
                      ))}
                    </div>
                    {cls.cost && (
                      <div className="text-sm font-medium text-primary">{cls.cost}</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="pt-6 space-y-4">
              <h2 className="text-xl font-semibold">Special Events</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {specialEvents.map(evt => (
                  <Card key={evt.id} className="border-l-4 border-l-orange-400">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{evt.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {evt.day} at {evt.time}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditClass(evt)} aria-label={`Edit ${evt.name}`}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteClass(evt.id)} aria-label={`Delete ${evt.name}`}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {evt.description && (
                        <p className="text-sm text-muted-foreground">{evt.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* TEACHERS TAB */}
          <TabsContent value="teachers" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Studio Teachers</h2>
              <Dialog open={isAddTeacherOpen} onOpenChange={setIsAddTeacherOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white" aria-label="Add new teacher">
                    <Plus className="w-4 h-4 mr-2" /> Add Teacher
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingTeacherId ? "Edit Teacher" : "Add New Teacher"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Profile Photo</Label>
                      <div className="flex items-center gap-4">
                        {newTeacher.avatarUrl && (
                          <img 
                            src={newTeacher.avatarUrl} 
                            alt="Teacher photo" 
                            className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                          />
                        )}
                        <div className="flex-1">
                          <Input 
                            type="file" 
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="cursor-pointer"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Max 5MB. JPG, PNG, or GIF.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input 
                          placeholder="First name" 
                          value={newTeacher.firstName || ""} 
                          onChange={e => setNewTeacher({...newTeacher, firstName: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input 
                          placeholder="Last name" 
                          value={newTeacher.lastName || ""} 
                          onChange={e => setNewTeacher({...newTeacher, lastName: e.target.value})} 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Specialty</Label>
                      <Input 
                        placeholder="e.g. Ballet, Jazz, Contemporary" 
                        value={newTeacher.specialty || ""} 
                        onChange={e => setNewTeacher({...newTeacher, specialty: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Email (Optional)</Label>
                      <Input 
                        type="email"
                        placeholder="teacher@example.com" 
                        value={newTeacher.email || ""} 
                        onChange={e => setNewTeacher({...newTeacher, email: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Phone (Optional)</Label>
                      <Input 
                        type="tel"
                        placeholder="555-0100" 
                        value={newTeacher.phone || ""} 
                        onChange={e => setNewTeacher({...newTeacher, phone: e.target.value})} 
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={newTeacher.isAvailableForSolo || false}
                        onCheckedChange={c => setNewTeacher({...newTeacher, isAvailableForSolo: c})}
                      />
                      <Label>Available for Private/Solo Lessons</Label>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleSaveTeacher}
                      disabled={isSavingTeacher}
                      aria-label="Save teacher"
                    >
                      {isSavingTeacher ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        editingTeacherId ? "Update Teacher" : "Add Teacher"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {teachers.map(teacher => (
                <Card key={teacher.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      {teacher.avatarUrl ? (
                        <img 
                          src={teacher.avatarUrl} 
                          alt={`${teacher.firstName} ${teacher.lastName}`}
                          className="w-24 h-24 rounded-full object-cover border-4 border-gray-100"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold">
                          {teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-lg">{teacher.firstName} {teacher.lastName}</h3>
                        <p className="text-sm text-muted-foreground">{teacher.specialty}</p>
                      </div>
                      {teacher.isAvailableForSolo && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <Star className="w-3 h-3 mr-1" /> Available for Privates
                        </Badge>
                      )}
                      <div className="flex gap-2 w-full">
                        {teacher.isAvailableForSolo && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1" 
                            onClick={() => {
                              setSelectedTeacherForSchedule(teacher);
                              setIsTeacherScheduleOpen(true);
                            }}
                            aria-label={`View ${teacher.firstName} ${teacher.lastName} schedule`}
                          >
                            <Calendar className="w-4 h-4 mr-2" /> Schedule
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1" 
                          onClick={() => openEditTeacher(teacher)}
                          aria-label={`Edit ${teacher.firstName} ${teacher.lastName}`}
                        >
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* BOOKINGS TAB */}
          <TabsContent value="bookings" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Practice Room Bookings</h2>
              <Dialog open={isAddBookingOpen} onOpenChange={setIsAddBookingOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white" aria-label="Add new booking">
                    <Plus className="w-4 h-4 mr-2" /> Book Practice Time
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingBookingId ? "Edit Booking" : "Book Practice Time"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Title/Purpose</Label>
                      <Input 
                        placeholder="e.g. Solo Practice - Emma" 
                        value={newBooking.title || ""} 
                        onChange={e => setNewBooking({...newBooking, title: e.target.value})} 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input 
                        type="date" 
                        value={newBooking.date || ""} 
                        onChange={e => setNewBooking({...newBooking, date: e.target.value})} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input 
                          type="time" 
                          value={newBooking.startTime || ""} 
                          onChange={e => setNewBooking({...newBooking, startTime: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <Input 
                          type="time" 
                          value={newBooking.endTime || ""} 
                          onChange={e => setNewBooking({...newBooking, endTime: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Room</Label>
                      <Select value={newBooking.room} onValueChange={v => setNewBooking({...newBooking, room: v})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Main Studio">Main Studio</SelectItem>
                          <SelectItem value="Studio A">Studio A</SelectItem>
                          <SelectItem value="Studio B">Studio B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Dancer/Student Name *</Label>
                      <Input 
                        placeholder="Enter dancer's name" 
                        value={newBooking.bookedBy || ""} 
                        onChange={e => setNewBooking({...newBooking, bookedBy: e.target.value})} 
                      />
                      <p className="text-xs text-muted-foreground">This name will appear in the schedule</p>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleAddBooking}
                      disabled={isSavingBooking}
                      aria-label="Save booking"
                    >
                      {isSavingBooking ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        editingBookingId ? "Update Booking" : "Book Time"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {bookings.map(booking => (
                <Card key={booking.id} className="border-l-4 border-l-blue-400">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{booking.title}</h3>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-4 h-4" />
                            {new Date(booking.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {booking.startTime} - {booking.endTime}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {booking.room}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {booking.bookedBy}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditBooking(booking)}
                          aria-label={`Edit ${booking.title}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteBooking(booking.id)}
                          aria-label={`Delete ${booking.title}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {deleteConfirm?.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete}
                disabled={isDeleting}
                aria-label="Confirm delete"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Teacher Solo Schedule Modal */}
        <Dialog open={isTeacherScheduleOpen} onOpenChange={(open) => {
          setIsTeacherScheduleOpen(open);
          if (!open) setScheduleWeekOffset(0); // Reset to current week when closing
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                {selectedTeacherForSchedule && (
                  <>Private Lesson Schedule - {selectedTeacherForSchedule.firstName} {selectedTeacherForSchedule.lastName}</>
                )}
              </DialogTitle>
              <DialogDescription>
                View and manage private lesson bookings for this teacher
              </DialogDescription>
            </DialogHeader>
            
            {selectedTeacherForSchedule && (
              <div className="space-y-4 py-4 overflow-y-auto">
                {/* Week Navigation */}
                <div className="flex items-center justify-between pb-2 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScheduleWeekOffset(Math.max(0, scheduleWeekOffset - 1))}
                    disabled={scheduleWeekOffset === 0}
                    aria-label="Previous week"
                  >
                    ← Previous Week
                  </Button>
                  <div className="text-sm font-medium">
                    {scheduleWeekOffset === 0 ? "This Week" : `Week of ${(() => {
                      const today = new Date();
                      const startOfWeek = new Date(today);
                      startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (scheduleWeekOffset * 7));
                      return `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()}`;
                    })()}`}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScheduleWeekOffset(Math.min(3, scheduleWeekOffset + 1))}
                    disabled={scheduleWeekOffset === 3}
                    aria-label="Next week"
                  >
                    Next Week →
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day, dayIndex) => {
                    // Get date for this day of selected week
                    const today = new Date();
                    const currentDay = today.getDay(); // 0 = Sunday
                    const diff = dayIndex + 1 - currentDay + (scheduleWeekOffset * 7); // +1 because DAYS starts with Monday
                    const targetDate = new Date(today);
                    targetDate.setDate(today.getDate() + diff);
                    const dateString = targetDate.toISOString().split('T')[0];

                    // Check if this date is blocked by competition (1 day before to 1 day after)
                    const isCompetitionBlocked = competitions.some(comp => {
                      const startDate = new Date(comp.startDate);
                      const endDate = new Date(comp.endDate);
                      
                      // Block day before start
                      const dayBefore = new Date(startDate);
                      dayBefore.setDate(dayBefore.getDate() - 1);
                      
                      // Block day after end
                      const dayAfter = new Date(endDate);
                      dayAfter.setDate(dayAfter.getDate() + 1);
                      
                      const checkDate = new Date(dateString);
                      return checkDate >= dayBefore && checkDate <= dayAfter;
                    });

                    // Get competition name if blocked
                    const blockingCompetition = competitions.find(comp => {
                      const startDate = new Date(comp.startDate);
                      const endDate = new Date(comp.endDate);
                      const dayBefore = new Date(startDate);
                      dayBefore.setDate(dayBefore.getDate() - 1);
                      const dayAfter = new Date(endDate);
                      dayAfter.setDate(dayAfter.getDate() + 1);
                      const checkDate = new Date(dateString);
                      return checkDate >= dayBefore && checkDate <= dayAfter;
                    });

                    return (
                      <div key={day} className="space-y-2">
                        <div className="text-center">
                          <div className={cn(
                            "font-semibold text-sm p-2 rounded",
                            isCompetitionBlocked ? "bg-red-200 text-red-800" : "bg-secondary/30"
                          )}>
                            {day.slice(0, 3)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {targetDate.getMonth() + 1}/{targetDate.getDate()}
                          </div>
                        </div>
                        
                        {isCompetitionBlocked ? (
                          <div className="text-xs text-center p-2 bg-red-100 border-2 border-red-300 rounded text-red-800">
                            <div className="font-semibold">Competition</div>
                            <div className="text-[10px] mt-1">{blockingCompetition?.name}</div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {/* Time slots from 9 AM to 8 PM */}
                            {Array.from({ length: 12 }, (_, i) => {
                              const hour = 9 + i;
                              const timeString = `${hour.toString().padStart(2, '0')}:00`;
                              const displayTime = hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
                              
                              // Check if this time conflicts with a weekly class
                              const hasClassConflict = classes.some(cls => 
                                cls.day === day && 
                                cls.time === timeString &&
                                cls.type === "Weekly"
                              );

                              const conflictingClass = classes.find(cls => 
                                cls.day === day && 
                                cls.time === timeString &&
                                cls.type === "Weekly"
                              );
                              
                              // Check if this time slot is booked for this teacher
                              const booking = bookings.find(b => 
                                (b.room === `Private - ${selectedTeacherForSchedule.firstName}` || 
                                 b.title?.includes(selectedTeacherForSchedule.firstName)) &&
                                b.date === dateString &&
                                b.startTime === timeString
                              );
                              
                              const isBooked = !!booking;

                              // If there's a class conflict, show as blocked
                              if (hasClassConflict) {
                                return (
                                  <div
                                    key={timeString}
                                    className="text-xs p-1 rounded border-2 bg-gray-300 border-gray-500 cursor-not-allowed opacity-75"
                                    title={`Class: ${conflictingClass?.name}`}
                                  >
                                    <div className="font-mono text-gray-700 font-semibold">{displayTime.slice(0, -3)}</div>
                                    <div className="text-[9px] text-gray-700 truncate font-medium">Class</div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={timeString}
                                  className={cn(
                                    "text-xs p-1 rounded cursor-pointer border-2 transition-colors",
                                    isBooked 
                                      ? "bg-gray-200 border-gray-400 hover:bg-gray-300" 
                                      : "bg-green-100 border-green-400 hover:bg-green-200"
                                  )}
                                  onClick={() => {
                                    if (isBooked && booking) {
                                      // Show booking details or allow editing
                                      openEditBooking(booking);
                                    } else {
                                      // Open new booking form pre-filled
                                      setNewBooking({
                                        title: `Private Lesson - ${selectedTeacherForSchedule.firstName}`,
                                        date: dateString,
                                        startTime: timeString,
                                        endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
                                        room: `Private - ${selectedTeacherForSchedule.firstName}`,
                                        bookedBy: ""
                                      });
                                      setIsAddBookingOpen(true);
                                    }
                                  }}
                                >
                                  <div className={cn(
                                    "font-mono font-semibold",
                                    isBooked ? "text-gray-700" : "text-green-700"
                                  )}>
                                    {displayTime.slice(0, -3)}
                                  </div>
                                  {isBooked && booking && (
                                    <div className="text-[10px] font-bold truncate mt-0.5 text-gray-800">
                                      {booking.bookedBy || "Booked"}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 border-2 border-gray-400 rounded"></div>
                    <span>Booked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 border-2 border-gray-500 rounded"></div>
                    <span>Class Time</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
                    <span>Competition</span>
                  </div>
                  <div className="ml-auto text-xs">
                    Click available slots to book • Navigate up to 4 weeks ahead
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}