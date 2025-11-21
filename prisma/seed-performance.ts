/**
 * 성능 테스트용 랜덤 데이터 생성 스크립트
 * 
 * 사용법:
 *   tsx prisma/seed-performance.ts [userId]
 * 
 * 예시:
 *   tsx prisma/seed-performance.ts cmi2vo8pt000ati2clkey21im
 */

import { PrismaClient, TeamRole, TeamMemberStatus, ChatRoomType, EventAttendeeStatus, TeamChannelType } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

// 랜덤 이름 생성
const firstNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍'];
const lastNames = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '준서', '건우', '현우', '우진', '선우', '연우', '정우', '승우', '지훈', '준혁', '도현', '시현'];

function randomName(): string {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName}${lastName}`;
}

function randomEmail(name: string, index: number): string {
  return `test${index}${Math.floor(Math.random() * 1000)}@test.com`;
}

function randomTeamName(index: number): string {
  const prefixes = ['개발팀', '디자인팀', '기획팀', '마케팅팀', '운영팀', 'QA팀', '인프라팀', '데이터팀'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix} ${index}`;
}

function randomChannelName(index: number): string {
  const names = ['일반', '자유게시판', '질문', '정보공유', '프로젝트', '회의록', '자료실'];
  const name = names[Math.floor(Math.random() * names.length)];
  return index === 0 ? name : `${name}-${index}`;
}

function randomEventTitle(): string {
  const titles = [
    '정기 회의', '프로젝트 리뷰', '스프린트 계획', '코드 리뷰', '기술 세미나',
    '팀 빌딩', '온보딩 세션', '성과 평가', '로드맵 논의', '버그 수정 회의'
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

async function seedPerformanceData(targetUserId?: string) {
  console.log('🚀 성능 테스트용 랜덤 데이터 생성 시작...\n');

  // 타겟 사용자 찾기
  let targetUser;
  if (targetUserId) {
    targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      console.error(`❌ 사용자를 찾을 수 없습니다: ${targetUserId}`);
      process.exit(1);
    }
    console.log(`✅ 타겟 사용자: ${targetUser.email} (${targetUser.name || '이름 없음'})\n`);
  } else {
    // 첫 번째 사용자를 타겟으로 사용
    targetUser = await prisma.user.findFirst();
    if (!targetUser) {
      console.error('❌ 사용자가 없습니다. 먼저 회원가입을 해주세요.');
      process.exit(1);
    }
    console.log(`✅ 타겟 사용자: ${targetUser.email} (${targetUser.name || '이름 없음'})\n`);
  }

  const NUM_USERS = 50; // 추가 사용자 수
  const NUM_TEAMS = 30; // 팀 수
  const NUM_CHANNELS_PER_TEAM = 5; // 팀당 채널 수
  const NUM_EVENTS_PER_TEAM = 20; // 팀당 이벤트 수
  const NUM_MESSAGES_PER_CHANNEL = 10; // 채널당 메시지 수

  try {
    // 1. 사용자 생성
    console.log(`📝 ${NUM_USERS}명의 사용자 생성 중...`);
    const users = [targetUser];
    const defaultPassword = await hashPassword('test1234');

    for (let i = 0; i < NUM_USERS; i++) {
      const name = randomName();
      const email = randomEmail(name, i);
      
      try {
        const user = await prisma.user.create({
          data: {
            email,
            name,
            password: defaultPassword,
          },
        });
        users.push(user);
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`  ${i + 1}/${NUM_USERS}... `);
        }
      } catch (error: any) {
        if (error.code === 'P2002') {
          // 이미 존재하는 이메일/이름은 스킵
          continue;
        }
        throw error;
      }
    }
    console.log(`\n✅ ${users.length}명의 사용자 생성 완료\n`);

    // 2. 팀 생성 (타겟 사용자가 멤버로 포함)
    console.log(`📝 ${NUM_TEAMS}개의 팀 생성 중...`);
    const teams = [];

    for (let i = 0; i < NUM_TEAMS; i++) {
      const creator = users[Math.floor(Math.random() * users.length)];
      const teamName = randomTeamName(i + 1);

      // 팀 멤버 선택 (타겟 사용자 포함 + 랜덤 멤버 5-15명)
      const numMembers = 5 + Math.floor(Math.random() * 11);
      const selectedUsers = [targetUser];
      const otherUsers = users.filter(u => u.id !== targetUser.id);
      
      for (let j = 0; j < numMembers - 1 && j < otherUsers.length; j++) {
        const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
        if (!selectedUsers.find(u => u.id === randomUser.id)) {
          selectedUsers.push(randomUser);
        }
      }

      const team = await prisma.team.create({
        data: {
          name: teamName,
          description: `${teamName}의 설명입니다.`,
          creatorId: creator.id,
          members: {
            create: selectedUsers.map((user, index) => ({
              userId: user.id,
              role: user.id === creator.id ? 'OWNER' : index === 1 ? 'ADMIN' : 'MEMBER',
              status: 'ACCEPTED' as TeamMemberStatus,
            })),
          },
        },
      });

      teams.push(team);

      const defaultChannels = [
        { name: '일반채널', type: TeamChannelType.GENERAL },
        { name: '공지사항', type: TeamChannelType.ANNOUNCEMENT },
      ];

      for (const channelDef of defaultChannels) {
        const defaultChatRoom = await prisma.chatRoom.create({
          data: {
            type: 'GROUP' as ChatRoomType,
            name: channelDef.name,
            members: {
              create: selectedUsers.map(user => ({
                userId: user.id,
              })),
            },
          },
        });

        await prisma.teamChannel.create({
          data: {
            name: channelDef.name,
            teamId: team.id,
            chatRoomId: defaultChatRoom.id,
            type: channelDef.type,
          },
        });
      }

      // 각 팀에 채널 생성
      for (let j = 0; j < NUM_CHANNELS_PER_TEAM; j++) {
        const channelName = randomChannelName(j);
        
        // ChatRoom 생성
        const chatRoom = await prisma.chatRoom.create({
          data: {
            type: 'GROUP' as ChatRoomType,
            name: channelName,
            members: {
              create: selectedUsers.map(user => ({
                userId: user.id,
              })),
            },
          },
        });

        // TeamChannel 생성
        await prisma.teamChannel.create({
          data: {
            name: channelName,
            teamId: team.id,
            chatRoomId: chatRoom.id,
            type: TeamChannelType.GENERAL,
          },
        });

        // 채널에 메시지 생성
        for (let k = 0; k < NUM_MESSAGES_PER_CHANNEL; k++) {
          const messageUser = selectedUsers[Math.floor(Math.random() * selectedUsers.length)];
          await prisma.message.create({
            data: {
              content: `테스트 메시지 ${k + 1}: ${channelName} 채널의 메시지입니다.`,
              userId: messageUser.id,
              chatRoomId: chatRoom.id,
            },
          });
        }
      }

      // 각 팀에 이벤트 생성
      for (let j = 0; j < NUM_EVENTS_PER_TEAM; j++) {
        const eventCreator = selectedUsers[Math.floor(Math.random() * selectedUsers.length)];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 60) - 30); // -30일 ~ +30일
        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + Math.floor(Math.random() * 4) + 1); // 1-4시간

        // 이벤트 참석자 선택 (3-10명)
        const numAttendees = 3 + Math.floor(Math.random() * 8);
        const attendees = selectedUsers
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(numAttendees, selectedUsers.length));

        await prisma.event.create({
          data: {
            title: randomEventTitle(),
            description: `이벤트 설명 ${j + 1}`,
            startDate,
            endDate,
            allDay: Math.random() > 0.7,
            location: Math.random() > 0.5 ? `회의실 ${Math.floor(Math.random() * 10) + 1}` : null,
            teamId: team.id,
            createdById: eventCreator.id,
            attendees: {
              create: attendees.map(user => ({
                userId: user.id,
                status: user.id === eventCreator.id ? 'ACCEPTED' : 
                       Math.random() > 0.3 ? 'ACCEPTED' : 
                       Math.random() > 0.5 ? 'PENDING' : 'DECLINED',
              })),
            },
          },
        });
      }

      if ((i + 1) % 5 === 0) {
        process.stdout.write(`  ${i + 1}/${NUM_TEAMS}... `);
      }
    }

    console.log(`\n✅ ${teams.length}개의 팀 생성 완료`);
    console.log(`   - 각 팀당 ${NUM_CHANNELS_PER_TEAM}개 채널`);
    console.log(`   - 각 팀당 ${NUM_EVENTS_PER_TEAM}개 이벤트`);
    console.log(`   - 각 채널당 ${NUM_MESSAGES_PER_CHANNEL}개 메시지\n`);

    // 통계 출력
    const teamCount = await prisma.team.count();
    const teamMemberCount = await prisma.teamMember.count({
      where: { userId: targetUser.id, status: 'ACCEPTED' },
    });
    const eventCount = await prisma.event.count({
      where: {
        team: {
          members: {
            some: {
              userId: targetUser.id,
              status: 'ACCEPTED',
            },
          },
        },
      },
    });
    const channelCount = await prisma.teamChannel.count({
      where: {
        team: {
          members: {
            some: {
              userId: targetUser.id,
              status: 'ACCEPTED',
            },
          },
        },
      },
    });

    console.log('📊 생성된 데이터 통계:');
    console.log(`   - 총 팀 수: ${teamCount}`);
    console.log(`   - 타겟 사용자가 속한 팀: ${teamMemberCount}`);
    console.log(`   - 타겟 사용자가 볼 수 있는 이벤트: ${eventCount}`);
    console.log(`   - 타겟 사용자가 볼 수 있는 채널: ${channelCount}\n`);

    console.log('✅ 성능 테스트용 데이터 생성 완료!');
    console.log('\n💡 이제 Redis 캐시 효과를 테스트할 수 있습니다:');
    console.log('   npm run test:redis:improved\n');

  } catch (error) {
    console.error('❌ 데이터 생성 중 오류:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
const targetUserId = process.argv[2];
seedPerformanceData(targetUserId)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

