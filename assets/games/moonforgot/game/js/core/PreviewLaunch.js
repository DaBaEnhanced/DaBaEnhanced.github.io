export function configurePreviewRoom(project, roomId, playerCharacterId) {
  if (!roomId) return project;
  const room = project.rooms.get(roomId); if (!room) throw new Error(`Requested room '${roomId}' does not exist.`);
  if (playerCharacterId) {
    if (!project.characters.has(playerCharacterId)) throw new Error(`Requested player character '${playerCharacterId}' does not exist.`);
    room.playerCharacter = playerCharacterId;
  }
  project.game = { ...project.game, startRoom: roomId, startPosition: room.playerStart };
  return project;
}
