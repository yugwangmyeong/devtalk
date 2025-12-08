
import { dashboardQueue } from '@/lib/queue';
import { cache, getCacheKey } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { measurePerformance } from '@/lib/performance';

interface DashboardJobData {
  userId: string;
}


async function generateDashboardData(userId: string) {
  const teamMemberships = await prisma.teamMember.findMany({
    where: {
      userId,
      status: 'ACCEPTED',
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          iconUrl: true,
        },
      },
    },
  });

  const teamIds = teamMemberships.map((tm) => tm.team.id);

  if (teamIds.length === 0) {
    return {
      upcomingEvents: [],
      teamActivities: [],
    };
  }


  const [upcomingEvents, recentEvents, recentChannels, recentMembers] = await Promise.all([
    (async () => {
      const now = new Date();
      const twoWeeksLater = new Date(now);
      twoWeeksLater.setDate(now.getDate() + 14);

      const events = await prisma.event.findMany({
        where: {
          teamId: { in: teamIds },
          startDate: {
            gte: now,
            lte: twoWeeksLater,
          },
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
            },
          },
          creator: {
            select: {
              id: true,
              email: true,
              name: true,
              profileImageUrl: true,
            },
          },
          attendees: {
            where: {
              userId,
            },
            select: {
              status: true,
            },
          },
        },
        orderBy: {
          startDate: 'asc',
        },
        take: 10,
      });

      return events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        allDay: event.allDay,
        location: event.location,
        teamId: event.teamId,
        team: event.team,
        creator: event.creator,
        myStatus: event.attendees[0]?.status || null,
      }));
    })(),

    (async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return await prisma.event.findMany({
        where: {
          teamId: { in: teamIds },
          createdAt: { gte: thirtyDaysAgo },
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
            },
          },
          creator: {
            select: {
              id: true,
              email: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      });
    })(),

    (async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return await prisma.teamChannel.findMany({
        where: {
          teamId: { in: teamIds },
          createdAt: { gte: thirtyDaysAgo },
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      });
    })(),

    (async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return await prisma.teamMember.findMany({
        where: {
          teamId: { in: teamIds },
          status: 'ACCEPTED',
          joinedAt: { gte: thirtyDaysAgo },
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: {
          joinedAt: 'desc',
        },
        take: 5,
      });
    })(),
  ]);

  const activities: Array<{
    type: 'event' | 'channel' | 'member';
    id: string;
    team: { id: string; name: string; iconUrl: string | null };
    user?: { id: string; email: string; name: string | null; profileImageUrl: string | null };
    title: string;
    createdAt: string;
  }> = [];

  recentEvents.forEach((event) => {
    activities.push({
      type: 'event',
      id: event.id,
      team: event.team,
      user: event.creator,
      title: event.title,
      createdAt: event.createdAt.toISOString(),
    });
  });

  recentChannels.forEach((channel) => {
    activities.push({
      type: 'channel',
      id: channel.id,
      team: channel.team,
      title: channel.name,
      createdAt: channel.createdAt.toISOString(),
    });
  });

  recentMembers.forEach((member) => {
    activities.push({
      type: 'member',
      id: member.id,
      team: member.team,
      user: member.user,
      title: `${member.user.name || member.user.email}님이 팀에 합류했습니다`,
      createdAt: member.joinedAt.toISOString(),
    });
  });

  activities.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const teamActivities = activities.slice(0, 10);

  return {
    upcomingEvents,
    teamActivities,
  };
}

export async function startDashboardWorker() {
  console.log('[Worker] Dashboard worker started');

  while (true) {
    try {
    
      const job = await dashboardQueue.dequeue(5);
      if (!job) {
        continue;
      }

      console.log(`[Worker] Processing job: ${job.id}`);

      const { result, duration } = await measurePerformance('dashboard-worker', async () => {
        const jobData = job.data as DashboardJobData;
        return await generateDashboardData(jobData.userId);
      });

    
      const cacheKey = getCacheKey('dashboard', job.data.userId);
      await cache.set(cacheKey, result, 300);

      console.log(`[Worker] Job completed: ${job.id} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      console.error('[Worker] Error processing job:', error);
    
    }
  }
}


if (require.main === module) {
  startDashboardWorker().catch((error) => {
    console.error('[Worker] Fatal error:', error);
    process.exit(1);
  });
}

