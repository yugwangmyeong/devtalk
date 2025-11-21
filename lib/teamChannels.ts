import { prisma } from '@/lib/prisma';
import { TeamChannelType } from '@prisma/client';

interface CreateTeamChannelOptions {
  teamId: string;
  name: string;
  type: TeamChannelType;
  description?: string | null;
}

export async function createTeamChannelWithMembers({
  teamId,
  name,
  type,
  description,
}: CreateTeamChannelOptions) {
  const acceptedMembers = await prisma.teamMember.findMany({
    where: {
      teamId,
      status: 'ACCEPTED',
    },
    select: {
      userId: true,
    },
  });

  const chatRoom = await prisma.chatRoom.create({
    data: {
      type: 'GROUP',
      name,
    },
  });

  if (acceptedMembers.length > 0) {
    await prisma.chatRoomMember.createMany({
      data: acceptedMembers.map(({ userId }) => ({
        userId,
        chatRoomId: chatRoom.id,
      })),
      skipDuplicates: true,
    });
  }

  const teamChannel = await prisma.teamChannel.create({
    data: {
      name,
      description: description ?? null,
      type,
      teamId,
      chatRoomId: chatRoom.id,
    },
  });

  return { teamChannel, chatRoom };
}

export async function ensureAnnouncementChannel(teamId: string) {
  let announcementChannel = await prisma.teamChannel.findFirst({
    where: {
      teamId,
      type: TeamChannelType.ANNOUNCEMENT,
    },
    include: {
      chatRoom: true,
    },
  });

  if (!announcementChannel) {
    await createTeamChannelWithMembers({
      teamId,
      name: '공지사항',
      type: TeamChannelType.ANNOUNCEMENT,
    });

    announcementChannel = await prisma.teamChannel.findFirst({
      where: {
        teamId,
        type: TeamChannelType.ANNOUNCEMENT,
      },
      include: {
        chatRoom: true,
      },
    });
  }

  return announcementChannel;
}

export async function ensureDefaultTeamChannels(teamId: string) {
  const defaults: Array<{ name: string; type: TeamChannelType }> = [
    { name: '일반채널', type: TeamChannelType.GENERAL },
    { name: '공지사항', type: TeamChannelType.ANNOUNCEMENT },
  ];

  for (const channel of defaults) {
    const exists = await prisma.teamChannel.findFirst({
      where: {
        teamId,
        type: channel.type,
      },
    });

    if (!exists) {
      await createTeamChannelWithMembers({
        teamId,
        name: channel.name,
        type: channel.type,
      });
    }
  }
}

