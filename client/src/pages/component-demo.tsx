import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Music, Trophy, DollarSign, Plus } from 'lucide-react';
import {
  mockDancers,
  mockRoutines,
  mockCompetitions,
  mockStudioFees,
  mockCostumeFees,
  getActiveDancers,
  getUpcomingCompetitions,
  getTotalMonthlyRevenue,
  getUnpaidCostumes,
  getTotalCostumeRevenue,
  getPaidCostumeRevenue,
  getDancerName,
} from '@/lib/mockData';

export default function ComponentDemo() {
  const activeDancers = getActiveDancers();
  const upcomingComps = getUpcomingCompetitions();
  const monthlyRevenue = getTotalMonthlyRevenue();
  const unpaidCostumes = getUnpaidCostumes();
  const totalCostumeRevenue = getTotalCostumeRevenue();
  const paidCostumeRevenue = getPaidCostumeRevenue();

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Studio Dashboard"
          description="Studio Maestro - Competition Dance Management"
          actions={
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Quick Add
            </Button>
          }
        />

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Active Dancers"
            value={activeDancers.length}
            subtitle={`${mockDancers.length} total enrolled`}
            icon={<Users className="w-6 h-6" />}
          />
          <StatCard
            title="Routines"
            value={mockRoutines.length}
            subtitle={`${upcomingComps.length} competitions ahead`}
            icon={<Music className="w-6 h-6" />}
            variant="primary"
          />
          <StatCard
            title="Monthly Revenue"
            value={`$${monthlyRevenue.toLocaleString()}`}
            subtitle="Tuition income"
            icon={<DollarSign className="w-6 h-6" />}
            variant="success"
          />
          <StatCard
            title="Costume Fees"
            value={`$${paidCostumeRevenue.toLocaleString()}`}
            subtitle={`${unpaidCostumes} unpaid / $${totalCostumeRevenue.toLocaleString()} total`}
            icon={<Trophy className="w-6 h-6" />}
            variant="warning"
          />
        </div>

        {/* Dancers Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Dancers</CardTitle>
            <CardDescription>All enrolled dancers and their information</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Tuition</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDancers.slice(0, 10).map((dancer) => {
                  const fee = mockStudioFees.find(f => f.dancerId === dancer.id);
                  return (
                    <TableRow key={dancer.id}>
                      <TableCell className="font-medium">
                        {dancer.firstName} {dancer.lastName}
                      </TableCell>
                      <TableCell>{dancer.age}</TableCell>
                      <TableCell>{dancer.level}</TableCell>
                      <TableCell>${fee?.monthlyTuition}</TableCell>
                      <TableCell>
                        {fee && <StatusBadge status={fee.status} size="sm" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Routines Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Routines</CardTitle>
            <CardDescription>Competition routines for the season</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Routine Name</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Dancers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRoutines.map((routine) => (
                  <TableRow key={routine.id}>
                    <TableCell className="font-medium">{routine.name}</TableCell>
                    <TableCell>{routine.style}</TableCell>
                    <TableCell>{routine.category}</TableCell>
                    <TableCell>{routine.duration}</TableCell>
                    <TableCell>{routine.dancerIds.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Competitions Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Competitions</CardTitle>
            <CardDescription>Upcoming and past competition schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competition</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCompetitions.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell className="font-medium">{comp.name}</TableCell>
                    <TableCell>{comp.location}</TableCell>
                    <TableCell>{new Date(comp.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <StatusBadge status={comp.status} size="sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Costume Fees Table */}
        <Card>
          <CardHeader>
            <CardTitle>Costume Fees</CardTitle>
            <CardDescription>Outstanding costume payments for upcoming competitions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dancer</TableHead>
                  <TableHead>Competition</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCostumeFees.slice(0, 10).map((fee) => {
                  const comp = mockCompetitions.find(c => c.id === fee.competitionId);
                  return (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium">
                        {getDancerName(fee.dancerId)}
                      </TableCell>
                      <TableCell>{comp?.name}</TableCell>
                      <TableCell>${fee.amount}</TableCell>
                      <TableCell>
                        <StatusBadge status={fee.isPaid ? 'Paid' : 'Unpaid'} size="sm" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
