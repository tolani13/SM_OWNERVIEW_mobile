// Mock data for demo purposes

export interface Dancer {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  level: 'Mini' | 'Junior' | 'Teen' | 'Senior';
  isActive: boolean;
}

export interface Routine {
  id: string;
  name: string;
  style: 'Jazz' | 'Contemporary' | 'Lyrical' | 'Hip Hop' | 'Tap' | 'Ballet';
  category: 'Solo' | 'Duo' | 'Trio' | 'Small Group' | 'Large Group';
  dancerIds: string[];
  duration: string;
}

export interface Competition {
  id: string;
  name: string;
  location: string;
  date: string;
  status: 'Upcoming' | 'In Progress' | 'Completed';
}

export interface StudioFee {
  id: string;
  dancerId: string;
  monthlyTuition: number;
  status: 'Paid' | 'Unpaid' | 'Partial';
}

export interface CostumeFee {
  id: string;
  competitionId: string;
  dancerId: string;
  routineId: string;
  amount: number;
  isPaid: boolean;
}

export const mockDancers: Dancer[] = [
  { id: '1', firstName: 'Emma', lastName: 'Johnson', age: 15, level: 'Teen', isActive: true },
  { id: '2', firstName: 'Olivia', lastName: 'Smith', age: 14, level: 'Teen', isActive: true },
  { id: '3', firstName: 'Sophia', lastName: 'Williams', age: 12, level: 'Junior', isActive: true },
  { id: '4', firstName: 'Ava', lastName: 'Brown', age: 8, level: 'Mini', isActive: true },
  { id: '5', firstName: 'Isabella', lastName: 'Davis', age: 17, level: 'Senior', isActive: true },
  { id: '6', firstName: 'Mia', lastName: 'Miller', age: 13, level: 'Junior', isActive: true },
  { id: '7', firstName: 'Charlotte', lastName: 'Wilson', age: 16, level: 'Teen', isActive: true },
  { id: '8', firstName: 'Amelia', lastName: 'Moore', age: 9, level: 'Mini', isActive: true },
  { id: '9', firstName: 'Harper', lastName: 'Taylor', age: 15, level: 'Teen', isActive: true },
  { id: '10', firstName: 'Evelyn', lastName: 'Anderson', age: 11, level: 'Junior', isActive: true },
  { id: '11', firstName: 'Abigail', lastName: 'Thomas', age: 14, level: 'Teen', isActive: true },
  { id: '12', firstName: 'Emily', lastName: 'Jackson', age: 16, level: 'Teen', isActive: true },
  { id: '13', firstName: 'Ella', lastName: 'White', age: 10, level: 'Junior', isActive: false },
  { id: '14', firstName: 'Scarlett', lastName: 'Harris', age: 18, level: 'Senior', isActive: true },
  { id: '15', firstName: 'Grace', lastName: 'Martin', age: 7, level: 'Mini', isActive: true },
];

export const mockRoutines: Routine[] = [
  { id: '1', name: 'Wildfire', style: 'Contemporary', category: 'Solo', dancerIds: ['1'], duration: '2:45' },
  { id: '2', name: 'Electric Dreams', style: 'Jazz', category: 'Duo', dancerIds: ['1', '2'], duration: '3:00' },
  { id: '3', name: 'Gravity', style: 'Lyrical', category: 'Large Group', dancerIds: ['1', '2', '3', '6', '7', '9', '11'], duration: '3:30' },
  { id: '4', name: 'Tiny Dancers', style: 'Ballet', category: 'Trio', dancerIds: ['4', '8', '15'], duration: '2:30' },
  { id: '5', name: 'Street Heat', style: 'Hip Hop', category: 'Small Group', dancerIds: ['5', '7', '9', '12'], duration: '3:15' },
  { id: '6', name: 'River', style: 'Contemporary', category: 'Solo', dancerIds: ['5'], duration: '2:50' },
  { id: '7', name: 'Rhythm Nation', style: 'Tap', category: 'Large Group', dancerIds: ['2', '3', '6', '10', '11', '12', '14'], duration: '3:20' },
  { id: '8', name: 'Butterfly', style: 'Lyrical', category: 'Duo', dancerIds: ['3', '10'], duration: '2:55' },
  { id: '9', name: 'Shine', style: 'Jazz', category: 'Solo', dancerIds: ['7'], duration: '2:40' },
  { id: '10', name: 'Unity', style: 'Contemporary', category: 'Small Group', dancerIds: ['1', '5', '7', '14'], duration: '3:10' },
];

export const mockCompetitions: Competition[] = [
  { id: '1', name: 'Starpower Nationals', location: 'Orlando, FL', date: '2025-02-14', status: 'Upcoming' },
  { id: '2', name: 'Showstopper Dance', location: 'Atlanta, GA', date: '2025-03-07', status: 'Upcoming' },
  { id: '3', name: 'Beyond The Stars', location: 'Dallas, TX', date: '2025-04-04', status: 'Upcoming' },
  { id: '4', name: 'Dance Makers', location: 'Charlotte, NC', date: '2025-01-18', status: 'In Progress' },
  { id: '5', name: 'Velocity Dance', location: 'Nashville, TN', date: '2024-12-15', status: 'Completed' },
];

export const mockStudioFees: StudioFee[] = [
  { id: '1', dancerId: '1', monthlyTuition: 250, status: 'Paid' },
  { id: '2', dancerId: '2', monthlyTuition: 250, status: 'Paid' },
  { id: '3', dancerId: '3', monthlyTuition: 200, status: 'Unpaid' },
  { id: '4', dancerId: '4', monthlyTuition: 175, status: 'Paid' },
  { id: '5', dancerId: '5', monthlyTuition: 275, status: 'Partial' },
  { id: '6', dancerId: '6', monthlyTuition: 200, status: 'Paid' },
  { id: '7', dancerId: '7', monthlyTuition: 250, status: 'Paid' },
  { id: '8', dancerId: '8', monthlyTuition: 175, status: 'Unpaid' },
  { id: '9', dancerId: '9', monthlyTuition: 250, status: 'Paid' },
  { id: '10', dancerId: '10', monthlyTuition: 200, status: 'Paid' },
  { id: '11', dancerId: '11', monthlyTuition: 250, status: 'Partial' },
  { id: '12', dancerId: '12', monthlyTuition: 250, status: 'Paid' },
  { id: '13', dancerId: '13', monthlyTuition: 200, status: 'Unpaid' },
  { id: '14', dancerId: '14', monthlyTuition: 275, status: 'Paid' },
  { id: '15', dancerId: '15', monthlyTuition: 150, status: 'Paid' },
];

export const mockCostumeFees: CostumeFee[] = [
  { id: '1', competitionId: '1', dancerId: '1', routineId: '1', amount: 125, isPaid: true },
  { id: '2', competitionId: '1', dancerId: '1', routineId: '2', amount: 150, isPaid: true },
  { id: '3', competitionId: '1', dancerId: '2', routineId: '2', amount: 150, isPaid: false },
  { id: '4', competitionId: '1', dancerId: '1', routineId: '3', amount: 175, isPaid: true },
  { id: '5', competitionId: '1', dancerId: '2', routineId: '3', amount: 175, isPaid: true },
  { id: '6', competitionId: '1', dancerId: '3', routineId: '3', amount: 175, isPaid: false },
  { id: '7', competitionId: '1', dancerId: '4', routineId: '4', amount: 100, isPaid: true },
  { id: '8', competitionId: '1', dancerId: '8', routineId: '4', amount: 100, isPaid: true },
  { id: '9', competitionId: '2', dancerId: '5', routineId: '5', amount: 160, isPaid: false },
  { id: '10', competitionId: '2', dancerId: '7', routineId: '5', amount: 160, isPaid: false },
  { id: '11', competitionId: '2', dancerId: '5', routineId: '6', amount: 125, isPaid: true },
  { id: '12', competitionId: '2', dancerId: '7', routineId: '9', amount: 125, isPaid: false },
  { id: '13', competitionId: '3', dancerId: '1', routineId: '10', amount: 165, isPaid: false },
  { id: '14', competitionId: '3', dancerId: '5', routineId: '10', amount: 165, isPaid: false },
  { id: '15', competitionId: '3', dancerId: '7', routineId: '10', amount: 165, isPaid: false },
];

// Helper functions
export const getDancerName = (dancerId: string): string => {
  const dancer = mockDancers.find(d => d.id === dancerId);
  return dancer ? `${dancer.firstName} ${dancer.lastName}` : 'Unknown';
};

export const getRoutineName = (routineId: string): string => {
  const routine = mockRoutines.find(r => r.id === routineId);
  return routine ? routine.name : 'Unknown';
};

export const getCompetitionName = (competitionId: string): string => {
  const competition = mockCompetitions.find(c => c.id === competitionId);
  return competition ? competition.name : 'Unknown';
};

export const getActiveDancers = () => mockDancers.filter(d => d.isActive);

export const getUpcomingCompetitions = () => mockCompetitions.filter(c => c.status === 'Upcoming');

export const getTotalMonthlyRevenue = () => {
  return mockStudioFees
    .filter(fee => {
      const dancer = mockDancers.find(d => d.id === fee.dancerId);
      return dancer?.isActive;
    })
    .reduce((sum, fee) => sum + fee.monthlyTuition, 0);
};

export const getUnpaidCostumes = () => {
  return mockCostumeFees.filter(fee => !fee.isPaid).length;
};

export const getTotalCostumeRevenue = () => {
  return mockCostumeFees.reduce((sum, fee) => sum + fee.amount, 0);
};

export const getPaidCostumeRevenue = () => {
  return mockCostumeFees.filter(f => f.isPaid).reduce((sum, fee) => sum + fee.amount, 0);
};
