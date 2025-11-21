import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('🗑️  데이터베이스 초기화 시작...');

    // 순서 중요: 외래 키 제약 조건 때문에 역순으로 삭제
    console.log('📨 메시지 삭제 중..ff.');
    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`✅ ${deletedMessages.count}개의 메시지 삭제 완료`);

    console.log('👥 채팅방 멤버 삭제 중...');
    const deletedMembers = await prisma.chatRoomMember.deleteMany({});
    console.log(`✅ ${deletedMembers.count}개의 채팅방 멤버 삭제 완료`);

    console.log('📺 팀 채널 삭제 중...');
    const deletedChannels = await prisma.teamChannel.deleteMany({});
    console.log(`✅ ${deletedChannels.count}개의 팀 채널 삭제 완료`);

    console.log('💬 채팅방 삭제 중...');
    const deletedRooms = await prisma.chatRoom.deleteMany({});
    console.log(`✅ ${deletedRooms.count}개의 채팅방 삭제 완료`);

    console.log('👥 팀 멤버 삭제 중...');
    const deletedTeamMembers = await prisma.teamMember.deleteMany({});
    console.log(`✅ ${deletedTeamMembers.count}개의 팀 멤버 삭제 완료`);

    console.log('🏢 팀 삭제 중...');
    const deletedTeams = await prisma.team.deleteMany({});
    console.log(`✅ ${deletedTeams.count}개의 팀 삭제 완료`);

    console.log('👤 사용자 삭제 중...');
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`✅ ${deletedUsers.count}개의 사용자 삭제 완료`);

    console.log('✨ 데이터베이스 초기화 완료!');
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });



