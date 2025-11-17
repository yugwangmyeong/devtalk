import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetChatRooms() {
  try {
    console.log('🗑️  채팅방 초기화 시작...');

    // 1. 모든 메시지 삭제
    console.log('📨 메시지 삭제ssss 중...코드확인');
    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`✅ ${deletedMessages.count}개의 메시지 삭제 완료`);

    // 2. 모든 채팅방 멤버 삭제
    console.log('👥 채팅방 멤버 삭제 중...');
    const deletedMembers = await prisma.chatRoomMember.deleteMany({});
    console.log(`✅ ${deletedMembers.count}개의 채팅방 멤버 삭제 완료`);

    // 3. 모든 채팅방 삭제
    console.log('💬 채팅방 삭제 중...');
    const deletedRooms = await prisma.chatRoom.deleteMany({});
    console.log(`✅ ${deletedRooms.count}개의 채팅방 삭제 완료`);

    console.log('✨ 채팅방 초기화 완료!');
  } catch (error) {
    console.error('❌ 채팅방 초기화 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetChatRooms()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });

